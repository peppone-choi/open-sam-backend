import { Router, Request, Response } from 'express';
import { General } from '../../models';

const router = Router();

router.get('/basic-info', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        generalID: 0,
        myNationID: 0,
        isChief: false,
        officerLevel: 0,
        permission: 0,
      });
    }

    const general: any = await (General as any).findOne({ owner: userId })
      .select('no nation officerLevel belong penalty permission')
      .lean();

    if (!general) {
      return res.json({
        generalID: 0,
        myNationID: 0,
        isChief: false,
        officerLevel: 0,
        permission: 0,
      });
    }

    const permission = general.officerLevel >= 5 ? 2 : general.officerLevel >= 1 ? 1 : 0;

    res.json({
      generalID: general.no,
      myNationID: general.nation,
      isChief: general.officerLevel === 12,
      officerLevel: general.officerLevel,
      permission,
    });
  } catch (error) {
    console.error('Error in basic-info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
