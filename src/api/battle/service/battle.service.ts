import { BattleRepository } from '../repository/battle.repository';

/**
 * Battle Service
 * 
 * Manages combat encounters between generals including battle state and resolution
 */
export class BattleService {
  constructor(private repository: BattleRepository) {}

  async findByGeneralId(sessionId: string, generalId: string) {
    return await this.repository.findByGeneralId(sessionId, generalId);
  }

  async findActive(sessionId: string) {
    return await this.repository.findActive(sessionId);
  }
}
