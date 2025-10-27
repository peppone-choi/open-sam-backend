import { VoteCommentRepository } from '../repository/vote-comment.repository';
import { IVoteComment } from '../@types/vote-comment.types';

export class VoteCommentService {
  constructor(private repository: VoteCommentRepository) {}

  async getById(id: string): Promise<IVoteComment | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IVoteComment[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<IVoteComment>): Promise<IVoteComment> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IVoteComment>): Promise<IVoteComment | null> {
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
