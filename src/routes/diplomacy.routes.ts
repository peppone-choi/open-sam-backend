import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { General, Nation, NgDiplomacy } from '../models';
import { checkPermission } from '../utils/permission-helper';

const GeneralModel = General as any;
const NationModel = Nation as any;
const NgDiplomacyModel = NgDiplomacy as any;

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

    const general = await GeneralModel.findOne({ owner: String(userId) })
      .select('data.nation data.officer_level data.permission data.penalty')
      .lean();

    if (!general || !general.data?.nation || general.data.nation === 0) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const nationId = general.data.nation;

    const perm = checkPermission(general);
    const canSeeDetail = perm.level >= 3;
 
     // 외교문서 조회
     const letters: any[] = await NgDiplomacyModel.find({
      session_id: sessionId,
      $or: [
        { 'data.srcNationId': nationId },
        { 'data.destNationId': nationId },
      ],
      'data.state': { $ne: 'cancelled' },
    })
      .sort({ 'data.date': -1 })
      .lean();

    // 국가 정보 매핑
    const nationMap: Record<number, string> = {};
    const nationIds = new Set<number>();
    letters.forEach((letter: any) => {
      const letterData = letter.data || {};
      if (letterData.srcNationId) nationIds.add(letterData.srcNationId);
      if (letterData.destNationId) nationIds.add(letterData.destNationId);
    });

    if (nationIds.size > 0) {
      const nations = await NationModel.find({
        session_id: sessionId,
        $or: Array.from(nationIds).map(id => [
          { 'data.nation': id },
          { nation: id }
        ]).flat()
      }).lean();

      nations.forEach((nation: any) => {
        const id = nation.data?.nation || nation.nation;
        const name = nation.data?.name || nation.name || '무명';
        nationMap[id] = name;
      });
    }

    const letterList = letters.map((letter: any) => {
      const letterData = letter.data || {};
      const state = letterData.state || 'proposed';
      let status: string;
      if (state === 'activated') {
        status = 'accepted';
      } else if (state === 'cancelled') {
        status = 'rejected';
      } else if (state === 'replaced') {
        status = 'replaced';
      } else {
        status = 'pending';
      }

      const rawDetail = letterData.detail || '';
      const detail = canSeeDetail ? rawDetail : (rawDetail ? '(권한이 부족합니다)' : '');

      return {
        no: letterData.no || letter._id,
        fromNation: nationMap[letterData.srcNationId] || `국가 ${letterData.srcNationId}`,
        toNation: nationMap[letterData.destNationId] || `국가 ${letterData.destNationId}`,
        brief: letterData.brief || letterData.text || '',
        detail,
        date: letterData.date || letter.createdAt || new Date(),
        status,
      };
    });

    res.json({
      success: true,
      result: true,
      letters: letterList,
    });
  } catch (error: any) {
    console.error('Error in diplomacy/get-letter:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
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

    const general: any = await GeneralModel.findOne({ owner: String(userId) })
      .select('no data.nation data.officer_level data.permission data.penalty')
      .lean();

    if (!general || !general.data?.nation || general.data.nation === 0) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const perm = checkPermission(general);
    if (perm.level < 4) {
      return res.status(403).json({ result: false, reason: perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }
 
     const { prevNo, destNationID, brief, detail } = req.body;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const srcNationId = general.data.nation;

    if (!destNationID || destNationID === srcNationId) {
      return res.status(400).json({ result: false, reason: destNationID === srcNationId ? '자국으로 보낼 수 없습니다.' : '올바르지 않은 국가입니다.' });
    }

    const trimmedBrief = (brief || '').trim();
    const trimmedDetail = (detail || '').trim();

    if (!trimmedBrief) {
      return res.status(400).json({ result: false, reason: '요약문이 비어있습니다' });
    }

    // 외교문서 번호 생성
    const lastLetter = await NgDiplomacyModel.findOne({ session_id: sessionId })
      .sort({ 'data.no': -1 })
      .select('data.no')
      .lean();
    const letterNo = (lastLetter?.data?.no || 0) + 1;

    // 외교문서 저장
    await NgDiplomacyModel.create({
      session_id: sessionId,
      data: {
        no: letterNo,
        srcNationId: srcNationId,
        destNationId: destNationID,
        prevNo: prevNo || null,
        brief: trimmedBrief,
        detail: trimmedDetail,
        date: new Date(),
        state: 'proposed',
      }
    });

    res.json({
      result: true,
      reason: '외교문서가 전송되었습니다.',
    });
  } catch (error: any) {
    console.error('Error in diplomacy/send-letter:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
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

    const { letterNo, action } = req.body;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';

    if (!letterNo || !action) {
      return res.status(400).json({ result: false, reason: '필수 파라미터가 누락되었습니다.' });
    }

    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ result: false, reason: '유효하지 않은 액션입니다.' });
    }

    // 외교 서한 조회
    const letter = await NgDiplomacyModel.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': letterNo },
        { _id: letterNo }
      ]
    });

    if (!letter) {
      return res.status(404).json({ result: false, reason: '외교 서한을 찾을 수 없습니다.' });
    }

    const letterData = letter.data || {};
    const general = await GeneralModel.findOne({ owner: String(userId) }).lean();
    
    if (!general || general.data?.nation !== letterData.destNationId) {
      return res.status(403).json({ result: false, reason: '권한이 없습니다.' });
    }

    // 서한 상태 업데이트
    await NgDiplomacyModel.updateOne(
      { _id: letter._id },
      { 
        $set: { 
          'data.status': action === 'accept' ? 'accepted' : 'rejected',
          'data.responseDate': new Date()
        } 
      }
    );

    res.json({
      success: true,
      result: true,
      reason: `외교 서한이 ${action === 'accept' ? '수락' : '거절'}되었습니다.`,
    });
  } catch (error: any) {
    console.error('Error in diplomacy/respond-letter:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
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

    // 외교 서한 조회
    const letter = await NgDiplomacyModel.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': letterNo },
        { _id: letterNo }
      ]
    });

    if (!letter) {
      return res.status(404).json({ result: false, reason: '외교 서한을 찾을 수 없습니다.' });
    }

    const letterData = letter.data || {};
    const general = await GeneralModel.findOne({ owner: String(userId) }).lean();
    
    if (!general || general.data?.nation !== letterData.destNationId) {
      return res.status(403).json({ result: false, reason: '권한이 없습니다.' });
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

