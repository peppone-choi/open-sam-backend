import { GeneralTurnModel } from '../model/general-turn.model';
import { IGeneralTurn } from '../@types/general-turn.types';

export class GeneralTurnRepository {
  async findById(id: string): Promise<IGeneralTurn | null> {
    const turn = await GeneralTurnModel.findById(id).lean().exec();
    return turn as IGeneralTurn | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IGeneralTurn[]> {
    const turns = await GeneralTurnModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ turnIdx: -1 })
      .lean()
      .exec();
    
    return turns as IGeneralTurn[];
  }

  async findByGeneralId(generalId: string, limit = 20, skip = 0): Promise<IGeneralTurn[]> {
    const turns = await GeneralTurnModel.find({ generalId })
      .limit(limit)
      .skip(skip)
      .sort({ turnIdx: -1 })
      .lean()
      .exec();
    
    return turns as IGeneralTurn[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IGeneralTurn[]> {
    const turns = await GeneralTurnModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ turnIdx: -1 })
      .lean()
      .exec();
    
    return turns as IGeneralTurn[];
  }

  async create(data: Partial<IGeneralTurn>): Promise<IGeneralTurn> {
    const turn = new GeneralTurnModel(data);
    await turn.save();
    return turn.toObject() as IGeneralTurn;
  }

  async update(id: string, data: Partial<IGeneralTurn>): Promise<IGeneralTurn | null> {
    const turn = await GeneralTurnModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return turn ? (turn.toObject() as IGeneralTurn) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await GeneralTurnModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await GeneralTurnModel.countDocuments(filter || {}).exec();
  }
}
