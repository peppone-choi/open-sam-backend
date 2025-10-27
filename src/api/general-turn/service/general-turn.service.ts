import { GeneralTurnRepository } from '../repository/general-turn.repository';

export class GeneralTurnService {
  constructor(private repository: GeneralTurnRepository) {}

  // TODO: 구현
  async getByGeneralId(sessionId: string, generalId: string) {
    return await this.repository.findByGeneralId(sessionId, generalId);
  }

  async create(sessionId: string, data: any) {
    return await this.repository.create({ sessionId, ...data });
  }
}
