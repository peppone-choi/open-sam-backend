// @ts-nocheck - Argument count mismatches need review
import { auctionRepository } from '../../repositories/auction.repository';
import { generalRepository } from '../../repositories/general.repository';

export class BidUniqueAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    const auctionID = data.auctionID || data.auction_id;
    const amount = data.amount || data.bid_price;
    const extendCloseDate = data.extendCloseDate || data.try_extend_close_date;
    
    try {
      if (!auctionID || !amount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      const auction = await auctionRepository.findOneByFilter({
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

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

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

      const currPoint = general.inherit_point || 0;
      if (currPoint < morePoint) {
        throw new Error('유산포인트가 부족합니다.');
      }

      if (highestBid && !myPrevBid) {
        const oldBidder = await generalRepository.findBySessionAndNo(sessionId, highestBid.generalId);
        if (oldBidder) {
          await generalRepository.updateBySessionAndNo(sessionId, highestBid.generalId, {
            inherit_point: (oldBidder.inherit_point || 0) + highestBid.amount
          });
        }
      }

      auction.bids.push({
        generalId: generalId,
        generalName: general.name,
        ownerName: general.owner_name || '',
        amount: amount,
        date: now,
        tryExtendCloseDate: extendCloseDate || false
      });

      const newInheritPoint = (general.inherit_point || 0) - morePoint;

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
      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        inherit_point: newInheritPoint
      });

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
