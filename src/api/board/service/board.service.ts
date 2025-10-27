import { BoardRepository } from '../repository/board.repository';
import { IBoard } from '../@types/board.types';

export class BoardService {
  constructor(private repository: BoardRepository) {}

  async getById(id: string): Promise<IBoard | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async list(limit: number, skip: number): Promise<IBoard[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IBoard>): Promise<IBoard> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IBoard>): Promise<IBoard | null> {
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
