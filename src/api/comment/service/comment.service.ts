import { CommentRepository } from '../repository/comment.repository';
import { IComment } from '../@types/comment.types';

export class CommentService {
  constructor(private repository: CommentRepository) {}

  async getById(id: string): Promise<IComment | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async list(limit: number, skip: number): Promise<IComment[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IComment>): Promise<IComment> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IComment>): Promise<IComment | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async remove(id: string): Promise<boolean> {
    return null as any;
    // TODO: 구현
    return false;
  }
}
