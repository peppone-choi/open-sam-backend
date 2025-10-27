import { CommentRepository } from '../repository/comment.repository';
import { IComment } from '../@types/comment.types';

/**
 * Comment Service
 * 
 * Manages comments on board posts for threaded discussions
 */
export class CommentService {
  constructor(private repository: CommentRepository) {}

  async getById(id: string): Promise<IComment | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IComment[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByBoardId(boardId: string, limit = 20, skip = 0): Promise<IComment[]> {
    return await this.repository.findByBoardId(boardId, limit, skip);
  }

  async create(data: Partial<IComment>): Promise<IComment> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IComment>): Promise<IComment | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }
}
