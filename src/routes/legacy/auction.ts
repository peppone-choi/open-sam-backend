import { Router, Request, Response } from 'express';
import { NgAuction, NgAuctionBid, General } from '../../models';

const router = Router();

router.get('/auction/list', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    const query: any = { finished: false };
    if (type) {
      query.type = type;
    }

    const auctions = await (NgAuction as any).find(query)
      .sort({ openDate: -1 })
      .lean();

    for (const auction of auctions) {
      const bids = await NgAuctionBid.countDocuments({ auctionId: auction._id });
      (auction as any).bidCount = bids;
      
      const topBid = await (NgAuctionBid as any).findOne({ auctionId: auction._id })
        .sort({ amount: -1 })
        .lean();
      if (topBid) {
        (auction as any).currentBid = topBid.amount;
      }
    }

    res.json({
      result: true,
      auctions,
    });
  } catch (error) {
    console.error('Error in auction/list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/auction/bid', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await (General as any).findOne({ owner: userId }).lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { auctionId, amount } = req.body;

    const bid = new NgAuctionBid({
      auctionId,
      owner: userId,
      generalId: general.no,
      amount,
      date: new Date(),
      aux: {},
    });

    await bid.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in auction/bid:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
