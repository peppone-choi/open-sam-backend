import { Auction } from '../../models/auction.model';
import { General } from '../../models/general.model';

export class BidUniqueAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    const { auctionID, amount, extendCloseDate } = data;
    
    try {
      if (!auctionID || !amount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      const auction = await Auction.findOne({
        _id: auctionID,
        session_id: sessionId,
        type: 'UniqueItem'
      });

      if (!auction) {
        throw new Error('경매를 찾을 수 없습니다.');
      }

      if (auction.finished) {
        throw new Error('경매가 이미 끝났습니다.');
      }

      const now = new Date();
      if (auction.closeDate < now) {
        throw new Error('경매가 이미 끝났습니다.');
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const highestBid = auction.bids.length > 0 
        ? auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
        : null;

      if (highestBid && amount < highestBid.amount * 1.01) {
        throw new Error('현재입찰가보다 1% 높게 입찰해야 합니다.');
      }

      if (highestBid && amount < highestBid.amount + 10) {
        throw new Error('현재입찰가보다 10 포인트 높게 입찰해야 합니다.');
      }

      const myPrevBid = auction.bids.find(b => b.generalId === generalId);
      const morePoint = amount - (myPrevBid ? myPrevBid.amount : 0);

      const currPoint = general.data.inherit_point || 0;
      if (currPoint < morePoint) {
        throw new Error('유산포인트가 부족합니다.');
      }

      if (highestBid && !myPrevBid) {
        const oldBidder = await General.findOne({
          session_id: sessionId,
          'data.no': highestBid.generalId
        });
        if (oldBidder) {
          oldBidder.data.inherit_point = (oldBidder.data.inherit_point || 0) + highestBid.amount;
          await oldBidder.save();
        }
      }

      auction.bids.push({
        generalId: generalId,
        generalName: general.data.name,
        ownerName: general.data.owner_name || '',
        amount: amount,
        date: now,
        tryExtendCloseDate: extendCloseDate || false
      });

      general.data.inherit_point = (general.data.inherit_point || 0) - morePoint;

      const turnTerm = 10;
      
      if (auction.availableLatestBidCloseDate) {
        const extendMinutes = Math.max(1, turnTerm * (1/6));
        const extendedCloseDate = new Date(now.getTime() + extendMinutes * 60 * 1000);

        if (extendedCloseDate > auction.closeDate && auction.closeDate < auction.availableLatestBidCloseDate) {
          auction.closeDate = extendedCloseDate < auction.availableLatestBidCloseDate 
            ? extendedCloseDate 
            : auction.availableLatestBidCloseDate;
        }
      }

      await auction.save();
      await general.save();

      return {
        success: true,
        result: true
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
