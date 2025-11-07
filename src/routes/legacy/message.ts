import { Router, Request, Response } from 'express';
import { Message, General } from '../../models';

const router = Router();

router.get('/message/list', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ owner: userId }).select('no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { mailbox = 'recv', page = 1 } = req.query;
    const limit = 20;
    const skip = (Number(page) - 1) * limit;

    const query: any = mailbox === 'recv' 
      ? { to: general.no }
      : { from: general.no };

    const messages = await Message.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      result: true,
      messages,
    });
  } catch (error) {
    console.error('Error in message/list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/message/send', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ owner: userId }).select('no name').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { targetId, message } = req.body;

    const newMessage = new Message({
      from: general.no,
      to: targetId,
      message,
      date: new Date(),
      isRead: false,
    });

    await newMessage.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in message/send:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.delete('/message/:messageId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { messageId } = req.params;

    await Message.deleteOne({ _id: messageId });

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in message/delete:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
