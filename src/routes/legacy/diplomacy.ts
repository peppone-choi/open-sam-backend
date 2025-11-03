import { Router, Request, Response } from 'express';
import { NgDiplomacy, General, Nation } from '../../models';

const router = Router();

router.get('/diplomacy/letters', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await (General as any).findOne({ owner: userId }).select('nation').lean();
    if (!general || !general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const letters = await (NgDiplomacy as any).find({
      $or: [
        { srcNationId: general.nation },
        { destNationId: general.nation },
      ],
    })
      .sort({ date: -1 })
      .lean();

    res.json({
      result: true,
      letters,
    });
  } catch (error) {
    console.error('Error in diplomacy/letters:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/diplomacy/send', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await (General as any).findOne({ owner: userId })
      .select('nation officerLevel')
      .lean();

    if (!general || !general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    if (general.officerLevel < 5) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다.' });
    }

    const { targetNationId, type, message } = req.body;

    const diplomacy = new NgDiplomacy({
      srcNationId: general.nation,
      destNationId: targetNationId,
      type,
      message: message || '',
      date: new Date(),
      status: 'pending',
    });

    await diplomacy.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in diplomacy/send:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
