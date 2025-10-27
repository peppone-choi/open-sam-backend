import { SelectPoolRepository } from '../repository/select-pool.repository';
import { ISelectPool } from '../@types/select-pool.types';

/**
 * Select Pool Service
 * 
 * Manages pools of available generals and resources for player selection
 */
export class SelectPoolService {
  constructor(private repository: SelectPoolRepository) {}

  async getById(id: string): Promise<ISelectPool | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<ISelectPool[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySession(sessionId: string, limit = 20, skip = 0): Promise<ISelectPool[]> {
    return await this.repository.findBySession(sessionId, limit, skip);
  }

  async getBySessionAndName(sessionId: string, uniqueName: string): Promise<ISelectPool | null> {
    return await this.repository.findBySessionAndName(sessionId, uniqueName);
  }

  async getAvailable(sessionId: string, limit = 20): Promise<ISelectPool[]> {
    return await this.repository.findAvailable(sessionId, limit);
  }

  async create(data: Partial<ISelectPool>): Promise<ISelectPool> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<ISelectPool>): Promise<ISelectPool | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
