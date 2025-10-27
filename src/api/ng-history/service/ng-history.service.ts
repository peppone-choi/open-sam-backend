import { NgHistoryRepository } from '../repository/ng-history.repository';
import { INgHistory } from '../@types/ng-history.types';

/**
 * Nation Game History Service
 * 
 * Manages historical records specific to nation game mechanics and events
 */
export class NgHistoryService {
  constructor(private repository: NgHistoryRepository) {}

  async getById(id: string): Promise<INgHistory | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<INgHistory[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(serverId: string, limit = 20, skip = 0): Promise<INgHistory[]> {
    return await this.repository.findBySessionId(serverId, limit, skip);
  }

  async create(data: Partial<INgHistory>): Promise<INgHistory> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INgHistory>): Promise<INgHistory | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
