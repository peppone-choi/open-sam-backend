import { PlockRepository } from '../repository/plock.repository';
import { IPlock } from '../@types/plock.types';

/**
 * Plock Service
 * 
 * Manages persistent locks for coordinating distributed game state updates
 */
export class PlockService {
  constructor(private repository: PlockRepository) {}

  async getById(id: string): Promise<IPlock | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IPlock[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByType(type: string): Promise<IPlock | null> {
    return await this.repository.findByType(type);
  }

  async create(data: Partial<IPlock>): Promise<IPlock> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IPlock>): Promise<IPlock | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
