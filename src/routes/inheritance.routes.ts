// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { General } from '../models/general.model';
import { Session } from '../models/session.model';
import { authenticate } from '../middleware/auth';
import { kvStorageRepository } from '../repositories/kvstorage.repository';
import { UserRecord } from '../models/user_record.model';

const router = Router();

// 유산 포인트 조회
router.post('/get-point', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const sessionId = req.body.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, error: '로그인이 필요합니다' });
    }
    
    const general = await General.findOne({ 
      session_id: sessionId,
      owner: String(userId) 
    });
    
    if (!general) {
      return res.status(404).json({ result: false, error: '장수를 찾을 수 없습니다' });
    }

    // 1) 계승 포인트 총액은 KVStorage를 우선 사용 (PHP j_inheritPoint.php 호환)
    const inheritStor = await kvStorageRepository.findOneByFilter({
      session_id: sessionId,
      key: `inheritance_${userId}`,
    });

    let totalPoint = 0;
    const previousValue = inheritStor?.value?.previous;
    if (Array.isArray(previousValue)) {
      totalPoint = Number(previousValue[0] || 0);
    } else if (typeof previousValue === 'number') {
      totalPoint = Number(previousValue);
    }

    // KVStorage에 값이 없으면 기존 general.data.inherit_points를 폴백으로 사용
    if (!Number.isFinite(totalPoint) || totalPoint < 0) {
      totalPoint = Number(general.data?.inherit_points || 0);
    }

    // 2) 최근 유산 포인트 내역 (UserRecord.log_type = 'inheritPoint')
    const logs = await UserRecord.find({
      session_id: sessionId,
      user_id: String(userId),
      log_type: 'inheritPoint',
    })
      .sort({ id: -1 })
      .limit(10)
      .lean();

    const extractPoint = (text?: string): number => {
      if (!text) return 0;
      const match = text.match(/(\d+)\s*포인트/);
      if (match) return Number(match[1]);
      const anyNumber = text.match(/(\d+)/);
      return anyNumber ? Number(anyNumber[1]) : 0;
    };

    const inheritList = logs.map((log: any) => ({
      id: log.id,
      type: 'inheritPoint',
      reason: log.text,
      amount: extractPoint(log.text),
      date: log.date || log.created_at,
    }));
    
    res.json({
      result: true,
      totalPoint,
      inheritList,
    });
  } catch (error: any) {
    res.status(500).json({ result: false, error: error.message });
  }
});

// 유산 포인트 사용
router.post('/use-point', authenticate, async (req, res) => {
  try {
    const { amount, type } = req.body;
    const userId = req.user?.userId || req.user?.id;
    const sessionId = req.body.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다' });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        result: false, 
        reason: '유효하지 않은 금액입니다' 
      });
    }

    const general = await General.findOne({ 
      session_id: sessionId,
      owner: String(userId) 
    });
    
    if (!general) {
      return res.status(404).json({ 
        result: false, 
        reason: '장수를 찾을 수 없습니다' 
      });
    }

    const currentPoints = general.data?.inherit_points || 0;
    
    if (currentPoints < amount) {
      return res.status(400).json({ 
        result: false, 
        reason: `유산 포인트가 부족합니다. 필요: ${amount}, 보유: ${currentPoints}` 
      });
    }

    general.data.inherit_points = currentPoints - amount;
    await general.save();

    res.json({
      result: true,
      remainingPoints: general.data.inherit_points
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

// 턴 시각 변경 (유산 사용)
/**
 * @swagger
 * /api/inheritance/change-turn-time:
 *   post:
 *     summary: Inheritance 생성
 *     description: |
 *       Inheritance 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Inheritance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/change-turn-time', async (req, res) => {
  try {
    const { generalId, hour, minute } = req.body;
    
    const general = await General.findOne({ no: generalId });
    if (!general) {
      return res.status(404).json({ error: '장수를 찾을 수 없습니다' });
    }
    
    const session = await Session.findOne({ session_id: general.session_id });
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    // 턴제 모드인지 확인
    if (session.game_mode !== 'turn') {
      return res.status(400).json({ error: '턴제 모드에서만 사용 가능합니다' });
    }
    
    // 턴 시각 변경 허용 여부 확인
    if (!session.turn_config?.allow_custom) {
      return res.status(400).json({ error: '이 서버는 턴 시각 변경이 불가능합니다' });
    }
    
    // 유산 차감 로직 (유산 포인트 차감)
    const inheritCost = 1000; // 기본 비용
    const inheritPoints = general.data?.inherit_points || 0;
    
    if (inheritPoints < inheritCost) {
      return res.status(400).json({ 
        error: `유산 포인트가 부족합니다. 필요: ${inheritCost}, 보유: ${inheritPoints}` 
      });
    }
    
    general.data.inherit_points = (general.data.inherit_points || 0) - inheritCost;
    
    // 턴 시각 변경
    general.custom_turn_hour = hour;
    general.custom_turn_minute = minute;
    await general.save();
    
    res.json({
      message: '턴 시각 변경 성공',
      newTurnTime: `${hour}:${minute.toString().padStart(2, '0')}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
