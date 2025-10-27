import { SelectNpcTokenRepository } from '../repository/select-npc-token.repository';
import { ISelectNpcToken } from '../@types/select-npc-token.types';

export class SelectNpcTokenService {
  constructor(private repository: SelectNpcTokenRepository) {}

  async getById(id: string): Promise<ISelectNpcToken | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<ISelectNpcToken[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken | null> {
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
