import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { GetJoinInfoService } from '../services/general/GetJoinInfo.service';
import { JoinService } from '../services/general/Join.service';

const router = Router();

/**
 * @swagger
 * /api/join/get-nations:
 *   post:
 *     summary: 장수 생성 가능한 국가 목록 조회
 *     tags: [Join]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverID:
 *                 type: string
 *               session_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 국가 목록 조회 성공
 */
router.post('/get-nations', optionalAuth, async (req, res) => {
  try {
    // serverID를 session_id로 매핑 (프론트엔드 호환성)
    const params = {
      ...req.body,
      ...req.query,
      session_id: req.body.session_id || req.query.session_id || req.body.serverID || req.query.serverID || 'sangokushi_default',
    };
    
    const result = await GetJoinInfoService.execute(params, req.user);
    
    // GetJoinInfoService는 nations를 반환하므로 형식 맞춤
    if (result.result && result.nations) {
      res.json({
        result: true,
        nations: result.nations,
        statLimits: result.statLimits,
        cities: result.cities || [],
      });
    } else {
      res.json({
        result: false,
        nations: [],
        reason: result.reason || '국가 목록을 불러올 수 없습니다',
      });
    }
  } catch (error: any) {
    res.status(400).json({
      result: false,
      nations: [],
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/join/create-general:
 *   post:
 *     summary: 장수 생성
 *     tags: [Join]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - nation
 *             properties:
 *               name:
 *                 type: string
 *               nation:
 *                 type: number
 *               icon:
 *                 type: number
 *               npcType:
 *                 type: number
 *               serverID:
 *                 type: string
 *               session_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 장수 생성 성공
 */
router.post('/create-general', optionalAuth, async (req, res) => {
  try {
    // serverID를 session_id로 매핑
    const params = {
      ...req.body,
      session_id: req.body.session_id || req.body.serverID || 'sangokushi_default',
    };
    
    const result = await JoinService.execute(params, req.user);
    
    if (result.success) {
      res.json({
        result: true,
        reason: result.message || '장수 생성 성공',
        general: result.general,
      });
    } else {
      res.status(400).json({
        result: false,
        reason: result.message || '장수 생성에 실패했습니다',
      });
    }
  } catch (error: any) {
    res.status(400).json({
      result: false,
      reason: error.message,
    });
  }
});

export default router;

