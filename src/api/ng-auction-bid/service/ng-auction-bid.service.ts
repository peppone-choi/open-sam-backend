import { NgAuctionBidRepository } from '../repository/ng-auction-bid.repository';
import { INgAuctionBid } from '../@types/ng-auction-bid.types';

/**
 * Nation Game Auction Bid Service
 * 
 * Manages bidding on auction items with amount tracking and winner determination
 */
export class NgAuctionBidService {
  constructor(private repository: NgAuctionBidRepository) {}

  async getById(id: string): Promise<INgAuctionBid | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByAuctionId(auctionId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    return await this.repository.findByAuctionId(auctionId, limit, skip);
  }

  async getHighestBid(auctionId: string): Promise<INgAuctionBid | null> {
    return await this.repository.findHighestBid(auctionId);
  }

  async getByGeneralId(generalId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async create(data: Partial<INgAuctionBid>): Promise<INgAuctionBid> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INgAuctionBid>): Promise<INgAuctionBid | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
