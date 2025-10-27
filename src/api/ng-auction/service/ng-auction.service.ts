import { NgAuctionRepository } from '../repository/ng-auction.repository';
import { INgAuction } from '../@types/ng-auction.types';

/**
 * Nation Game Auction Service
 * 
 * Manages auction system for trading generals, items, and resources
 */
export class NgAuctionService {
  constructor(private repository: NgAuctionRepository) {}

  async getById(id: string): Promise<INgAuction | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<INgAuction[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async getActive(sessionId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    return await this.repository.findActive(sessionId, limit, skip);
  }

  async getByType(sessionId: string, type: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    return await this.repository.findByType(sessionId, type, limit, skip);
  }

  async getByHostGeneralId(hostGeneralId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    return await this.repository.findByHostGeneralId(hostGeneralId, limit, skip);
  }

  async create(data: Partial<INgAuction>): Promise<INgAuction> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INgAuction>): Promise<INgAuction | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
