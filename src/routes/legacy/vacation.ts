import { Router, Request, Response } from 'express';
import { General } from '../../models';

const router = Router();

router.post('/vacation/set', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await (General as any).findOne({ owner: userId });
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const killturn = 30;
    (general as any).killturn = killturn * 3;
    await general.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in vacation/set:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
