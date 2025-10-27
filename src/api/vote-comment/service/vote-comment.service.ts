import { VoteCommentRepository } from '../repository/vote-comment.repository';
import { IVoteComment } from '../@types/vote-comment.types';

/**
 * Vote Comment Service
 * 
 * Manages comments and discussions on voting proposals
 */
export class VoteCommentService {
  constructor(private repository: VoteCommentRepository) {}

  async getById(id: string): Promise<IVoteComment | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IVoteComment[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByVoteId(sessionId: string, voteId: number, limit = 20, skip = 0): Promise<IVoteComment[]> {
    return await this.repository.findByVoteId(sessionId, voteId, limit, skip);
  }

  async getByGeneralId(generalId: string, limit = 20, skip = 0): Promise<IVoteComment[]> {
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  async getByNationId(nationId: string, limit = 20, skip = 0): Promise<IVoteComment[]> {
    return await this.repository.findByNationId(nationId, limit, skip);
  }

  async create(data: Partial<IVoteComment>): Promise<IVoteComment> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IVoteComment>): Promise<IVoteComment | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
