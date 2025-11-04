import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BetService } from '../services/betting/Bet.service';
import { GetBettingDetailService } from '../services/betting/GetBettingDetail.service';
import { GetBettingListService } from '../services/betting/GetBettingList.service';

const router = Router();

/**
 * @swagger
 * /api/betting/bet:
 *   post:
 *     summary: 베팅 참여
 *     description: |
 *       전투 결과, 장수 대결, 이벤트 등에 베팅합니다. 승리 시 배당금을 받습니다.
 *       
 *       **베팅 종류:**
 *       - 전투 승패: 어느 국가가 이길까?
 *       - 장수 대결: 1대1 대결 승자
 *       - 도시 점령: 누가 먼저 점령?
 *       - 랭킹 예측: 다음 턴 1위는?
 *       
 *       **베팅 규칙:**
 *       - 최소 베팅: 100 금
 *       - 최대 베팅: 10000 금
 *       - 배당률: 참여 비율에 따라 변동
 *       - 결과 확정 후 자동 지급
 *       
 *       **배당 계산:**
 *       - 총 베팅액 / 승자 측 베팅액
 *       - 수수료 5% 차감
 *       - 최소 배당: 1.1배
 *       
 *       **사용 시나리오:**
 *       1. 전투 베팅: 위나라 vs 촉나라
 *       2. 장수 베팅: 여포 vs 조조
 *       3. 이벤트: 첫 도시 점령자
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - betting_id
 *               - choice
 *               - amount
 *             properties:
 *               betting_id:
 *                 type: number
 *                 description: 베팅 이벤트 ID
 *               choice:
 *                 type: string
 *                 description: 선택 (A, B 등)
 *               amount:
 *                 type: number
 *                 description: 베팅 금액
 *     responses:
 *       200:
 *         description: 베팅 성공
 *       400:
 *         description: 잘못된 요청 (금액 부족, 마감된 베팅 등)
 *       401:
 *         description: 인증 실패
 */
router.post('/bet', authenticate, async (req, res) => {
  try {
    const result = await BetService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/betting/get-betting-detail:
 *   get:
 *     summary: 베팅 상세 정보 조회
 *     description: |
 *       특정 베팅 이벤트의 상세 정보를 조회합니다.
 *       
 *       **조회 정보:**
 *       - 베팅 주제 및 설명
 *       - 선택지별 배당률
 *       - 현재 베팅 현황
 *       - 마감 시간
 *       - 내 베팅 내역
 *       
 *       **실시간 배당률:**
 *       - 베팅 참여 시마다 변동
 *       - 폴링으로 업데이트 권장
 *     tags: [Betting]
 *     parameters:
 *       - in: query
 *         name: betting_id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 조회 성공
 *       404:
 *         description: 베팅을 찾을 수 없음
 */
router.get('/get-betting-detail', authenticate, async (req, res) => {
  try {
    const result = await GetBettingDetailService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/betting/get-betting-list:
 *   get:
 *     summary: 베팅 목록 조회
 *     description: |
 *       현재 진행 중인 베팅 이벤트 목록을 조회합니다.
 *       
 *       **목록 정보:**
 *       - 진행 중 베팅
 *       - 마감 임박 베팅
 *       - 인기 베팅 (참여자 많은)
 *       - 고배당 베팅
 *       
 *       **필터:**
 *       - 카테고리 (전투, 장수, 이벤트)
 *       - 상태 (진행중, 마감, 결과확정)
 *       - 정렬 (마감임박순, 인기순)
 *     tags: [Betting]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed, settled]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 목록 조회 성공
 */
router.get('/get-betting-list', authenticate, async (req, res) => {
  try {
    const result = await GetBettingListService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/get-list', authenticate, async (req, res) => {
  try {
    const result = await GetBettingListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
