import { Auction } from '../../models/auction.model';

export class GetActiveResourceAuctionListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      const auctions = await (Auction as any).find({
        session_id: sessionId,
        type: { $in: ['BuyRice', 'SellRice'] },
        finished: false
      }).sort({ closeDate: 1 });

      const buyRiceList = [];
      const sellRiceList = [];

      for (const auction of auctions) {
        const highestBid = auction.bids.length > 0
          ? auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
          : null;

        const auctionData = {
          id: auction._id,
          type: auction.type,
          hostGeneralID: auction.hostGeneralId,
          hostName: auction.hostName,
          openDate: auction.openDate,
          closeDate: auction.closeDate,
          amount: auction.amount,
          startBidAmount: auction.startBidAmount,
          finishBidAmount: auction.finishBidAmount,
          highestBid: highestBid ? {
            amount: highestBid.amount,
            date: highestBid.date,
            generalID: highestBid.generalId,
            generalName: highestBid.generalName
          } : null
        };

        if (auction.type === 'BuyRice') {
          buyRiceList.push(auctionData);
        } else {
          sellRiceList.push(auctionData);
        }
      }

      const recentAuctions = await (Auction as any).find({
        session_id: sessionId,
        type: { $in: ['BuyRice', 'SellRice'] },
        finished: true
      })
        .sort({ updatedAt: -1 })
        .limit(20);

      const recentLogs = recentAuctions.map(a => {
        const highestBid = a.bids.length > 0
          ? a.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
          : null;
        
        return {
          id: a._id,
          type: a.type,
          hostName: a.hostName,
          amount: a.amount,
          highestBid: highestBid ? {
            generalName: highestBid.generalName,
            amount: highestBid.amount
          } : null,
          closeDate: a.closeDate
        };
      });

      return {
        success: true,
        result: true,
        buyRice: buyRiceList,
        sellRice: sellRiceList,
        recentLogs: recentLogs,
        generalID: generalId
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
