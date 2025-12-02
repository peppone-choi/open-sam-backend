// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { General } from '../../models';
import { saveGeneral } from '../../common/cache/model-cache.helper';

const router = Router();

router.post('/vacation/set', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId });
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const killturn = 30;
    general.killturn = killturn * 3;
    // CQRS: 캐시에 저장
    const sessionId = general.session_id || 'sangokushi_default';
    const generalNo = general.no || general.data?.no;
    await saveGeneral(sessionId, generalNo, general.toObject());

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in vacation/set:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
