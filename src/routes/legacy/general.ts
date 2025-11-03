import { Router, Request, Response } from 'express';
import { General, Nation, City } from '../../models';

const router = Router();

router.get('/general-list', async (req: Request, res: Response) => {
  try {
    const generals = await (General as any).find({ npc: 0 })
      .select('no name nation city leadership strength intel crew crewtype officerLevel')
      .lean();

    res.json({
      result: true,
      generals,
    });
  } catch (error) {
    console.error('Error in general-list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/general-log', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await (General as any).findOne({ owner: userId }).select('no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const logs: any[] = [];

    res.json({
      result: true,
      logs,
    });
  } catch (error) {
    console.error('Error in general-log:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
