import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import { DiplomacyLetterService } from '../services/diplomacy/DiplomacyLetter.service';
import { 
  validate, 
  diplomacySendLetterSchema, 
  diplomacyRespondSchema, 
  diplomacyProcessSchema,
  preventMongoInjection 
} from '../middleware/validation.middleware';

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
router.post('/send-letter', authenticate, preventMongoInjection('body'), validate(diplomacySendLetterSchema), async (req, res) => {
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
router.post('/respond-letter', authenticate, preventMongoInjection('body'), validate(diplomacyRespondSchema), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo, action, reason } = req.body;
    const result = await DiplomacyLetterService.respondLetter(String(userId), sessionId, {
      letterNo,
      action,
      reason
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
 * /api/diplomacy/rollback-letter:
 *   post:
 *     summary: 외교 서신 회수 (발신자가 proposed 상태의 서신 회수)
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
 *             properties:
 *               letterNo:
 *                 type: number
 *     responses:
 *       200:
 *         description: 회수 성공
 */
router.post('/rollback-letter', authenticate, preventMongoInjection('body'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo } = req.body;

    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '서한 번호가 필요합니다.' });
    }

    const result = await DiplomacyLetterService.rollbackLetter(String(userId), sessionId, letterNo);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    console.error('Error in diplomacy/rollback-letter:', error);
    res.status(status).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/diplomacy/destroy-letter:
 *   post:
 *     summary: 외교 서신 파기 (activated 상태의 서신 파기 - 양국 동의 필요)
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
 *             properties:
 *               letterNo:
 *                 type: number
 *     responses:
 *       200:
 *         description: 파기 성공/요청
 */
router.post('/destroy-letter', authenticate, preventMongoInjection('body'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo } = req.body;

    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '서한 번호가 필요합니다.' });
    }

    const result = await DiplomacyLetterService.destroyLetter(String(userId), sessionId, letterNo);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    console.error('Error in diplomacy/destroy-letter:', error);
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
router.post('/process', authenticate, preventMongoInjection('body'), validate(diplomacyProcessSchema), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { letterNo, action, data } = req.body;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';

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

/**
 * @swagger
 * /api/diplomacy/rollback-letter:
 *   post:
 *     summary: 외교 서한 회수
 *     description: 내가 보낸 외교 서한을 회수합니다. (상태가 proposed인 경우에만)
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
 *             properties:
 *               letterNo:
 *                 type: number
 *     responses:
 *       200:
 *         description: 회수 성공
 */
router.post('/rollback-letter', authenticate, preventMongoInjection('body'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo } = req.body;

    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '서한 번호가 필요합니다.' });
    }

    // 내 장수 조회
    const { General } = await import('../models/general.model');
    const general = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    });

    if (!general || !general.data?.nation) {
      return res.status(400).json({ result: false, reason: '소속 국가가 없습니다.' });
    }

    const nationId = general.data.nation;
    const officerLevel = general.data.officer_level || 0;

    // 수뇌부 권한 체크
    if (officerLevel < 5) {
      return res.json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    // 서한 조회 (내 국가에서 보낸 proposed 상태만)
    const { NgDiplomacy } = await import('../models');
    const letter = await NgDiplomacy.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': letterNo },
        { no: letterNo }
      ],
      'data.srcNationId': nationId,
      'data.state': 'proposed'
    });

    if (!letter) {
      return res.json({ result: false, reason: '서신이 없습니다.' });
    }

    // 회수 처리
    const aux = letter.data?.aux ? JSON.parse(JSON.stringify(letter.data.aux)) : {};
    aux.reason = {
      who: general.data.no || general.no,
      action: 'cancelled',
      reason: '회수'
    };

    await NgDiplomacy.updateOne(
      { _id: letter._id },
      {
        $set: {
          'data.state': 'cancelled',
          'data.status': 'cancelled',
          'data.aux': aux
        }
      }
    );

    res.json({ result: true, reason: 'success' });
  } catch (error: any) {
    console.error('Error in diplomacy/rollback-letter:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/diplomacy/destroy-letter:
 *   post:
 *     summary: 외교 서한 파기
 *     description: 활성화된 외교 서한을 파기 요청합니다. 양측 동의 시 파기됩니다.
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
 *             properties:
 *               letterNo:
 *                 type: number
 *     responses:
 *       200:
 *         description: 파기 요청/완료 성공
 */
router.post('/destroy-letter', authenticate, preventMongoInjection('body'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { letterNo } = req.body;

    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '서한 번호가 필요합니다.' });
    }

    // 내 장수 조회
    const { General } = await import('../models/general.model');
    const general = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    });

    if (!general || !general.data?.nation) {
      return res.status(400).json({ result: false, reason: '소속 국가가 없습니다.' });
    }

    const nationId = general.data.nation;
    const officerLevel = general.data.officer_level || 0;

    // 수뇌부 권한 체크
    if (officerLevel < 5) {
      return res.json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    // 서한 조회 (내 국가 관련 activated 상태)
    const { NgDiplomacy } = await import('../models');
    const letter = await NgDiplomacy.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': letterNo },
        { no: letterNo }
      ],
      $or: [
        { 'data.srcNationId': nationId },
        { 'data.destNationId': nationId }
      ],
      'data.state': 'activated'
    });

    if (!letter) {
      return res.json({ result: false, reason: '서신이 없습니다.' });
    }

    const aux = letter.data?.aux ? JSON.parse(JSON.stringify(letter.data.aux)) : {};
    const stateOpt = aux.state_opt || null;

    // 이미 파기 요청한 경우 체크
    if ((stateOpt === 'try_destroy_src' && letter.data?.srcNationId === nationId) ||
        (stateOpt === 'try_destroy_dest' && letter.data?.destNationId === nationId)) {
      return res.json({ result: false, reason: '이미 파기 신청을 했습니다.' });
    }

    let lastState: string;

    // 양측 모두 파기 요청 시 실제 파기
    if (stateOpt === 'try_destroy_src' || stateOpt === 'try_destroy_dest') {
      aux.reason = {
        who: general.data.no || general.no,
        action: 'destroy',
        reason: '파기'
      };

      await NgDiplomacy.updateOne(
        { _id: letter._id },
        {
          $set: {
            'data.state': 'cancelled',
            'data.status': 'cancelled',
            'data.aux': aux
          }
        }
      );
      lastState = 'cancelled';
    } else {
      // 파기 요청 상태로 변경
      if (letter.data?.srcNationId === nationId) {
        aux.state_opt = 'try_destroy_src';
      } else {
        aux.state_opt = 'try_destroy_dest';
      }

      await NgDiplomacy.updateOne(
        { _id: letter._id },
        { $set: { 'data.aux': aux } }
      );
      lastState = 'activated';
    }

    res.json({
      result: true,
      reason: 'success',
      state: lastState
    });
  } catch (error: any) {
    console.error('Error in diplomacy/destroy-letter:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/diplomacy/history:
 *   post:
 *     summary: 외교 히스토리 조회
 *     tags: [Diplomacy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nationId:
 *                 type: number
 *                 description: 특정 국가와의 히스토리만 조회 (선택사항)
 *               limit:
 *                 type: number
 *                 default: 50
 *     responses:
 *       200:
 *         description: 히스토리 목록
 */
router.post('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.body.session_id || req.query.session_id || 'sangokushi_default') as string;
    const { nationId, limit = 50 } = req.body;

    // 사용자의 국가 조회
    const { General } = await import('../models/general.model');
    const general = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    });

    if (!general || !general.data?.nation) {
      return res.status(400).json({ result: false, reason: '소속 국가가 없습니다.' });
    }

    const myNationId = general.data.nation;

    const { DiplomacyMessageService } = await import('../services/diplomacy/DiplomacyMessage.service');
    
    let history;
    if (nationId && nationId !== myNationId) {
      // 특정 국가와의 양자 히스토리
      history = await DiplomacyMessageService.getBilateralHistory(sessionId, myNationId, nationId, limit);
    } else {
      // 내 국가의 전체 히스토리
      history = await DiplomacyMessageService.getDiplomacyHistory(sessionId, myNationId, limit);
    }

    res.json({
      success: true,
      result: true,
      history
    });
  } catch (error: any) {
    console.error('Error in diplomacy/history:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

export default router;

