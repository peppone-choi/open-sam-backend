import { GeneralTurnRepository } from '../repository/general-turn.repository';
import { IGeneralTurn } from '../@types/general-turn.types';

export class GeneralTurnService {
  constructor(private repository: GeneralTurnRepository) {}

  async getById(id: string): Promise<IGeneralTurn | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IGeneralTurn[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getByGeneralId(generalId: string, limit: number, skip: number): Promise<IGeneralTurn[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralTurn[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IGeneralTurn>): Promise<IGeneralTurn> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IGeneralTurn>): Promise<IGeneralTurn | null> {
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
