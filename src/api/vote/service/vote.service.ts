import { VoteRepository } from '../repository/vote.repository';
import { IVote } from '../@types/vote.types';

/**
 * Vote Service
 * 
 * Manages nation-wide voting and polling systems for diplomatic decisions
 */
export class VoteService {
  constructor(private repository: VoteRepository) {}

  async getById(id: string): Promise<IVote | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IVote[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IVote[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async getByVoteId(sessionId: string, voteId: number): Promise<IVote[]> {
    return await this.repository.findByVoteId(sessionId, voteId);
  }

  async getByNationId(nationId: string, limit = 20, skip = 0): Promise<IVote[]> {
    return await this.repository.findByNationId(nationId, limit, skip);
  }

  async getByGeneralId(generalId: string): Promise<IVote[]> {
    return await this.repository.findByGeneralId(generalId);
  }

  async create(data: Partial<IVote>): Promise<IVote> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IVote>): Promise<IVote | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
