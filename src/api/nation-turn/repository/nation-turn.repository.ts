import { NationTurnModel, INationTurnDocument } from '../model/nation-turn.model';
import { INationTurn } from '../@types/nation-turn.types';

export class NationTurnRepository {
  async findById(id: string): Promise<INationTurn | null> {
    const nationTurn = await NationTurnModel.findById(id).lean().exec();
    return nationTurn as INationTurn | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INationTurn[]> {
    const nationTurns = await NationTurnModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return nationTurns as INationTurn[];
  }

  async create(data: Partial<INationTurn>): Promise<INationTurn> {
    const nationTurn = new NationTurnModel(data);
    await nationTurn.save();
    return nationTurn.toObject() as INationTurn;
  }

  async update(id: string, data: Partial<INationTurn>): Promise<INationTurn | null> {
    const nationTurn = await NationTurnModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return nationTurn ? (nationTurn.toObject() as INationTurn) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NationTurnModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findByNationId(nationId: string, limit = 20, skip = 0): Promise<INationTurn[]> {
    const nationTurns = await NationTurnModel.find({ nationId })
      .limit(limit)
      .skip(skip)
      .sort({ turnIdx: -1 })
      .lean()
      .exec();
    
    return nationTurns as INationTurn[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INationTurn[]> {
    const nationTurns = await NationTurnModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ turnIdx: -1 })
      .lean()
      .exec();
    
    return nationTurns as INationTurn[];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NationTurnModel.countDocuments(filter || {}).exec();
  }
}
