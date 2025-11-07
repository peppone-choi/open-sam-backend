import { Router, Request, Response } from 'express';
import { Troop, General } from '../../models';

const router = Router();

router.post('/troop/create', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ owner: userId })
      .select('no nation')
      .lean();

    if (!general || !general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const { name } = req.body;

    const troop = new Troop({
      troopLeader: general.no,
      nation: general.nation,
      name: name || '부대',
    });

    await troop.save();

    await General.updateOne({ _id: general._id }, { troop: general.no });

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in troop/create:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/troop/:troopId/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId });
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { troopId } = req.params;

    general.troop = parseInt(troopId);
    await general.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in troop/join:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/troop/leave', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId });
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    general.troop = 0;
    await general.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in troop/leave:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
