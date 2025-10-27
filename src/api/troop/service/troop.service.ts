import { TroopRepository } from '../repository/troop.repository';
import { ITroop } from '../@types/troop.types';

/**
 * Troop Service
 * 
 * Manages military units including composition, positioning, and commander assignments
 */
export class TroopService {
  constructor(private repository: TroopRepository) {}

  async getById(id: string): Promise<ITroop | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<ITroop[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByNationId(nationId: string, limit = 20, skip = 0): Promise<ITroop[]> {
    return await this.repository.findByNationId(nationId, limit, skip);
  }

  async getByCommanderId(commanderId: string): Promise<ITroop | null> {
    return await this.repository.findByCommanderId(commanderId);
  }

  async create(data: Partial<ITroop>): Promise<ITroop> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<ITroop>): Promise<ITroop | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
