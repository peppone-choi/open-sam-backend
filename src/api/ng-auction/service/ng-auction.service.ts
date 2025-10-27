import { NgAuctionRepository } from '../repository/ng-auction.repository';
import { INgAuction } from '../@types/ng-auction.types';

export class NgAuctionService {
  constructor(private repository: NgAuctionRepository) {}

  async getById(id: string): Promise<INgAuction | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<INgAuction[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<INgAuction>): Promise<INgAuction> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<INgAuction>): Promise<INgAuction | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return false;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return 0;
  }
}
