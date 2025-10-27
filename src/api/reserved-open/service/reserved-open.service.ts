import { ReservedOpenRepository } from '../repository/reserved-open.repository';
import { IReservedOpen } from '../@types/reserved-open.types';

/**
 * Reserved Open Service
 * 
 * Manages scheduled server openings and game session launches
 */
export class ReservedOpenService {
  constructor(private repository: ReservedOpenRepository) {}

  async getById(id: string): Promise<IReservedOpen | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IReservedOpen[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<IReservedOpen[]> {
    return await this.repository.findByDateRange(startDate, endDate);
  }

  async create(data: Partial<IReservedOpen>): Promise<IReservedOpen> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IReservedOpen>): Promise<IReservedOpen | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
