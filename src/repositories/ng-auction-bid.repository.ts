// @ts-nocheck
import { NgAuctionBid } from '../models/ng_auction_bid.model';
import { DeleteResult } from 'mongodb';

/**
 * NG 경매 입찰 리포지토리
 */
class NgAuctionBidRepository {
  async findBySession(sessionId: string) {
    return NgAuctionBid.find({ session_id: sessionId });
  }

  async findByAuction(sessionId: string, auctionId: string) {
    return NgAuctionBid.find({ 
      session_id: sessionId, 
      auction_id: auctionId 
    }).sort({ bid_amount: -1 });
  }

  async create(data: any) {
    return NgAuctionBid.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NgAuctionBid.deleteMany({ session_id: sessionId });
  }
}

export const ngAuctionBidRepository = new NgAuctionBidRepository();
