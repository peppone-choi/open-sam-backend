/**
 * Tournament API 라우트
 * 토너먼트 관련 API
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { TournamentService } from '../services/tournament.service';

const router = Router();

/**
 * @swagger
 * /api/tournament/info:
 *   post:
 *     summary: 토너먼트 정보 조회
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 */
router.post('/info', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    
    const result = await TournamentService.getTournamentInfo(sessionId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/tournament/apply:
 *   post:
 *     summary: 토너먼트 신청
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 */
router.post('/apply', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const generalNo = req.body.generalNo || req.user?.generalId;
    
    if (!generalNo) {
      return res.status(400).json({
        result: false,
        reason: '장수 ID가 필요합니다'
      });
    }

    const result = await TournamentService.applyForTournament(sessionId, generalNo);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/tournament/cancel:
 *   post:
 *     summary: 토너먼트 신청 취소
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cancel', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const generalNo = req.body.generalNo || req.user?.generalId;
    
    if (!generalNo) {
      return res.status(400).json({
        result: false,
        reason: '장수 ID가 필요합니다'
      });
    }

    const result = await TournamentService.cancelTournamentApplication(sessionId, generalNo);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/tournament/bracket:
 *   post:
 *     summary: 토너먼트 대진표 조회
 *     tags: [Tournament]
 */
router.post('/bracket', async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    
    const result = await TournamentService.getTournamentBracket(sessionId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

export default router;


