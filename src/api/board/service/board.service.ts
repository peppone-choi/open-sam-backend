import { BoardRepository } from '../repository/board.repository';
import { IBoard } from '../@types/board.types';

/**
 * Board Service
 * 
 * Manages bulletin board posts for in-game communication and announcements
 */
export class BoardService {
  constructor(private repository: BoardRepository) {}

  async getById(id: string): Promise<IBoard | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IBoard[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IBoard[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async create(data: Partial<IBoard>): Promise<IBoard> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IBoard>): Promise<IBoard | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }
}
