import { Router, Request, Response } from 'express';
import { General, Plock } from '../../models';

const router = Router();

router.get('/server/basic-info', async (req: Request, res: Response) => {
  try {
    const plock: any = await Plock.findOne({ type: 'GAME' }).lean();
    
    const serverInfo = {
      year: 192,
      month: 1,
      turnTime: 60,
      serverLocked: plock?.plock === 1,
      lastExecuted: plock?.locktime || new Date(),
    };

    res.json({
      result: true,
      ...serverInfo,
    });
  } catch (error) {
    console.error('Error in server/basic-info:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/server/status', async (req: Request, res: Response) => {
  try {
    const totalGenerals = await General.countDocuments({ npc: 0 });
    const totalNPC = await General.countDocuments({ npc: 1 });
    const plock: any = await Plock.findOne({ type: 'GAME' }).lean();

    res.json({
      result: true,
      status: {
        totalGenerals,
        totalNPC,
        serverLocked: plock?.plock === 1,
        lastExecuted: plock?.locktime,
      },
    });
  } catch (error) {
    console.error('Error in server/status:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
