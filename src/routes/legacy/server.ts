import { Router, Request, Response } from 'express';
import { General, Plock, Session } from '../../models';

const router = Router();

router.get('/server/basic-info', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const session = await Session.findOne({ session_id: sessionId }).lean();
    
    if (!session) {
      return res.json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }

    const sessionData = session.config || session.data || {};
    const plock: any = await Plock.findOne({ type: 'GAME' }).lean();
    
    // 레거시 형식과 동일하게 반환
    const serverInfo = {
      result: true,
      server_id: sessionId,
      server_nick: sessionId,
      year: sessionData.year || sessionData.current_year || 184,
      month: sessionData.month || sessionData.current_month || 1,
      startyear: sessionData.startyear || 184,
      turnterm: sessionData.turnterm || 600,
      killturn: sessionData.killturn || 0,
      maxgeneral: sessionData.maxgeneral || 50,
      scenario: sessionData.scenario || 0,
      fiction: sessionData.fiction || false,
      npcmode: sessionData.npcmode || 0,
      show_img_level: sessionData.show_img_level || 0,
      block_general_create: sessionData.block_general_create || 0,
      isunited: sessionData.isunited || 0,
      status: session.status || 'unknown',
      serverLocked: plock?.plock === 1,
      lastExecuted: plock?.locktime || session.updatedAt,
    };

    res.json(serverInfo);
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
