// @ts-nocheck - Argument count mismatches need review
import { auctionRepository } from '../../repositories/auction.repository';
import { generalRepository } from '../../repositories/general.repository';

export class BidBuyRiceAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    const auctionID = data.auctionID || data.auction_id;
    const amount = data.amount || data.bid_price;
    
    try {
      if (!auctionID || !amount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      const auction = await auctionRepository.findOneByFilter({
        _id: auctionID,
        session_id: sessionId,
        type: 'BuyRice'
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

      if (auction.hostGeneralId === generalId) {
        throw new Error('자신이 연 경매에 입찰할 수 없습니다.');
      }

      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const highestBid = auction.bids.length > 0 
        ? auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
        : null;

      if (highestBid && amount <= highestBid.amount) {
        throw new Error('현재입찰가보다 높게 입찰해야 합니다.');
      }

      if (auction.finishBidAmount && amount > auction.finishBidAmount) {
        throw new Error('즉시판매가보다 높을 수 없습니다.');
      }

      const myPrevBid = auction.bids.find(b => b.generalId === generalId);
      const moreAmount = amount - (myPrevBid ? myPrevBid.amount : 0);

      const minimumGold = 1000;
      if (general.data.gold < moreAmount + minimumGold) {
        throw new Error('금이 부족합니다.');
      }

      if (highestBid && !myPrevBid) {
        const oldBidder = await generalRepository.findBySessionAndNo({
          session_id: sessionId,
          'data.no': highestBid.generalId
        });
        if (oldBidder) {
          oldBidder.data.gold += highestBid.amount;
          await oldBidder.save();
        }
      }

      auction.bids.push({
        generalId: generalId,
        generalName: general.data.name,
        ownerName: general.data.owner_name || '',
        amount: amount,
        date: now,
        tryExtendCloseDate: false
      });

      general.data.gold -= moreAmount;

      const turnTerm = 10;
      const extendMinutes = Math.max(1, turnTerm * (1/6));
      const extendedCloseDate = new Date(now.getTime() + extendMinutes * 60 * 1000);

      if (extendedCloseDate > auction.closeDate) {
        auction.closeDate = extendedCloseDate;
      }

      if (amount === auction.finishBidAmount) {
        auction.closeDate = new Date(now.getTime() + turnTerm * 60 * 1000);
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
