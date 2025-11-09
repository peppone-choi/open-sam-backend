// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { GeneralTurn, General } from '../../models';

const router = Router();

router.get('/command/reserved', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId }).select('no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const commands: any[] = await GeneralTurn.find({ generalId: general.no })
      .sort({ turnIdx: 1 })
      .lean();

    res.json({
      result: true,
      commands: commands.map(cmd => ({
        turn: cmd.turnIdx,
        action: cmd.action,
        arg: cmd.arg,
        brief: cmd.brief,
      })),
    });
  } catch (error) {
    console.error('Error in command/reserved:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/command/push', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId }).select('no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { action, arg, brief } = req.body;

    const nextTurn: any = await GeneralTurn.findOne({ generalId: general.no })
      .sort({ turnIdx: -1 })
      .lean();

    const turnIdx = nextTurn ? nextTurn.turnIdx + 1 : 0;

    const command = new GeneralTurn({
      generalId: general.no,
      turnIdx,
      action,
      arg: arg || {},
      brief: brief || action,
    });

    await command.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in command/push:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.delete('/command/:turnIdx', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId }).select('no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const turnIdx = parseInt(req.params.turnIdx);

    await GeneralTurn.deleteOne({
      generalId: general.no,
      turnIdx,
    });

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in command/delete:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
