import { TroopRepository } from '../repository/troop.repository';
import { ITroop } from '../@types/troop.types';

export class TroopService {
  constructor(private repository: TroopRepository) {}

  async getById(id: string): Promise<ITroop | null> {
    return null as any;
    // TODO: 구현
  }

  async getAll(limit: number, skip: number): Promise<ITroop[]> {
    return null as any;
    // TODO: 구현
  }

  async getByNationId(nationId: string, limit: number, skip: number): Promise<ITroop[]> {
    return null as any;
    // TODO: 구현
  }

  async getByCommanderId(commanderId: string): Promise<ITroop | null> {
    return null as any;
    // TODO: 구현
  }

  async create(data: Partial<ITroop>): Promise<ITroop> {
    return null as any;
    // TODO: 구현
  }

  async update(id: string, data: Partial<ITroop>): Promise<ITroop | null> {
    return null as any;
    // TODO: 구현
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 구현
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 구현
  }
}
