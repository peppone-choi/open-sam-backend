import { NationTurnModel } from '../model/nation-turn.model';

export class NationTurnRepository {
  // TODO: 구현
  async findByNationId(sessionId: string, nationId: string) {
    return await NationTurnModel.find({ sessionId, nationId }).lean().exec();
  }
}
