import { NationRepository } from '../repository/nation.repository';
import { INation } from '../@types/nation.types';

export class NationService {
  constructor(private repository: NationRepository) {}

  async getById(id: string): Promise<INation | null> {
    return null as any;
    /* TODO */
    return null;
  }

  async getAll(limit: number, skip: number): Promise<INation[]> {
    return null as any;
    /* TODO */
    return [];
  }

  async create(data: Partial<INation>): Promise<INation> {
    return null as any;
    /* TODO */
    return null as any;
  }

  async update(id: string, data: Partial<INation>): Promise<INation | null> {
    return null as any;
    /* TODO */
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    /* TODO */
    return false;
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<INation[]> {
    return null as any;
    /* TODO */
    return [];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    /* TODO */
    return 0;
  }
}
