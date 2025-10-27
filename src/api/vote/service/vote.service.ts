import { VoteRepository } from '../repository/vote.repository';
import { IVote } from '../@types/vote.types';

export class VoteService {
  constructor(private repository: VoteRepository) {}

  async getById(id: string): Promise<IVote | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IVote[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<IVote>): Promise<IVote> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IVote>): Promise<IVote | null> {
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
