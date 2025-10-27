import { WorldHistoryRepository } from '../repository/world-history.repository';
import { IWorldHistory } from '../@types/world-history.types';

/**
 * World History Service
 * 
 * Manages historical records of significant world events across game sessions
 */
export class WorldHistoryService {
  constructor(private repository: WorldHistoryRepository) {}

  async getById(id: string): Promise<IWorldHistory | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IWorldHistory[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IWorldHistory[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async create(data: Partial<IWorldHistory>): Promise<IWorldHistory> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IWorldHistory>): Promise<IWorldHistory | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
