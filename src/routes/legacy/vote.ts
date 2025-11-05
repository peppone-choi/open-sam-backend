import { Router, Request, Response } from 'express';
import { Vote, VoteComment, General } from '../../models';

const router = Router();

router.get('/vote/list', async (req: Request, res: Response) => {
  try {
    const votes: any[] = await (Vote as any).find({})
      .sort({ createdAt: -1 })
      .lean();

    for (const vote of votes) {
      const comments = await (VoteComment as any).find({ voteId: vote._id }).lean();
      vote.comments = comments;
    }

    res.json({
      result: true,
      votes,
    });
  } catch (error) {
    console.error('Error in vote/list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/vote/:voteId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await (General as any).findOne({ owner: userId })
      .select('no nation name')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { voteId } = req.params;
    const { selection } = req.body;

    const existingVote = await (Vote as any).findOne({
      voteId,
      generalId: general.no,
    });

    if (existingVote) {
      return res.status(400).json({ result: false, reason: '이미 투표했습니다.' });
    }

    const vote = new Vote({
      voteId,
      generalId: general.no,
      nationId: general.nation,
      selection,
    });

    await vote.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in vote:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
