import { SelectPoolRepository } from '../repository/select-pool.repository';
import { ISelectPool } from '../@types/select-pool.types';

export class SelectPoolService {
  constructor(private repository: SelectPoolRepository) {}

  async getById(id: string): Promise<ISelectPool | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<ISelectPool[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<ISelectPool>): Promise<ISelectPool> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<ISelectPool>): Promise<ISelectPool | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 구현
    return false;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 구현
    return 0;
  }
}
