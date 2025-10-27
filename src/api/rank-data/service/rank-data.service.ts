import { RankDataRepository } from '../repository/rank-data.repository';
import { IRankData } from '../@types/rank-data.types';

/**
 * Rank Data Service
 * 
 * Manages leaderboard and ranking statistics for various game metrics
 */
export class RankDataService {
  constructor(private repository: RankDataRepository) {}

  async getById(id: string): Promise<IRankData | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IRankData[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByType(type: string, limit = 20, skip = 0): Promise<IRankData[]> {
    return await this.repository.findByType(type, limit, skip);
  }

  async getByNation(nationId: string, type: string, limit = 20, skip = 0): Promise<IRankData[]> {
    return await this.repository.findByNation(nationId, type, limit, skip);
  }

  async create(data: Partial<IRankData>): Promise<IRankData> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IRankData>): Promise<IRankData | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
