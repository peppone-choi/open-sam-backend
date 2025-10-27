import { NgBettingRepository } from '../repository/ng-betting.repository';
import { INgBetting } from '../@types/ng-betting.types';

export class NgBettingService {
  constructor(private repository: NgBettingRepository) {}

  async getById(id: string): Promise<INgBetting | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<INgBetting[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<INgBetting>): Promise<INgBetting> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<INgBetting>): Promise<INgBetting | null> {
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
