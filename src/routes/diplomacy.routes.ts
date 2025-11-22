import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import { DiplomacyLetterService } from '../services/diplomacy/DiplomacyLetter.service';

const router = Router();

// NgDiplomacy 모델이 없을 수 있으므로 임시로 직접 처리
// FUTURE: NgDiplomacy 모델 확인 및 생성

/**
 * 외교문서 목록 조회
 */
router.post('/get-letter', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const result = await DiplomacyLetterService.listLetters(String(userId), sessionId);

    res.json({
      success: true,
      result: true,
      letters: result.letters,
      canSeeDetail: result.canSeeDetail
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * 외교문서 전송
 */
router.post('/send-letter', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const destNationId = req.body.destNationID ?? req.body.destNationId;
    const result = await DiplomacyLetterService.sendLetter(String(userId), sessionId, {
      prevNo: req.body.prevNo,
      destNationId: Number(destNationId),
      brief: req.body.brief,
      detail: req.body.detail,
    });

    res.json(result);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    console.error('Error in diplomacy/send-letter:', error);
    res.status(status).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/diplomacy/respond-letter:
 *   post:
 *     summary: 외교 서한 응답
 *     tags: [Diplomacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - letterNo
 *               - action
 *             properties:
 *               letterNo:
 *                 type: number
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: 응답 성공
 */
router.post('/respond-letter', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo, action } = req.body;
    const result = await DiplomacyLetterService.respondLetter(String(userId), sessionId, {
      letterNo,
      action
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    console.error('Error in diplomacy/respond-letter:', error);
    res.status(status).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/diplomacy/process:
 *   post:
 *     summary: 외교 처리
 *     tags: [Diplomacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - letterNo
 *               - action
 *             properties:
 *               letterNo:
 *                 type: number
 *               action:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: 처리 성공
 */
router.post('/process', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { letterNo, action, data } = req.body;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';

    if (!letterNo || !action) {
      return res.status(400).json({ result: false, reason: '필수 파라미터가 누락되었습니다.' });
    }

    // 외교 처리 (동맹, 전쟁 등)
    const { ProcessDiplomacyService } = await import('../services/diplomacy/ProcessDiplomacy.service');
    const result = await ProcessDiplomacyService.execute({
      session_id: sessionId,
      letterNo,
      action,
      data
    }, req.user);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('Error in diplomacy/process:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

export default router;

