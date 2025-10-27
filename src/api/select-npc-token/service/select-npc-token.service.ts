import { SelectNpcTokenRepository } from '../repository/select-npc-token.repository';
import { ISelectNpcToken } from '../@types/select-npc-token.types';

/**
 * Select NPC Token Service
 * 
 * Manages tokens for NPC general selection during game initialization
 */
export class SelectNpcTokenService {
  constructor(private repository: SelectNpcTokenRepository) {}

  async getById(id: string): Promise<ISelectNpcToken | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<ISelectNpcToken[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionAndOwner(sessionId: string, owner: string): Promise<ISelectNpcToken | null> {
    return await this.repository.findBySessionAndOwner(sessionId, owner);
  }

  async getBySession(sessionId: string, limit = 20, skip = 0): Promise<ISelectNpcToken[]> {
    return await this.repository.findBySession(sessionId, limit, skip);
  }

  async create(data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
