import { GeneralTurnModel, IGeneralTurnDocument } from '../model/general-turn.model';

export class GeneralTurnRepository {
  // TODO: 구현
  async findByGeneralId(sessionId: string, generalId: string): Promise<any[]> {
    return await GeneralTurnModel.find({ sessionId, generalId }).lean().exec();
  }

  async create(data: Partial<IGeneralTurnDocument>): Promise<any> {
    const doc = new GeneralTurnModel(data);
    return await doc.save();
  }
}
