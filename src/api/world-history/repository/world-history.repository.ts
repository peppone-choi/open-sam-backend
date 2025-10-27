import { WorldHistoryModel, IWorldHistoryDocument } from '../model/world-history.model';
import { IWorldHistory } from '../@types/world-history.types';

export class WorldHistoryRepository {
  async findById(id: string): Promise<IWorldHistory | null> {
    const history = await WorldHistoryModel.findById(id).lean().exec();
    return history as IWorldHistory | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IWorldHistory[]> {
    const histories = await WorldHistoryModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return histories as IWorldHistory[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IWorldHistory[]> {
    const histories = await WorldHistoryModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return histories as IWorldHistory[];
  }

  async create(data: Partial<IWorldHistory>): Promise<IWorldHistory> {
    const history = new WorldHistoryModel(data);
    await history.save();
    return history.toObject() as IWorldHistory;
  }

  async update(id: string, data: Partial<IWorldHistory>): Promise<IWorldHistory | null> {
    const history = await WorldHistoryModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return history ? (history.toObject() as IWorldHistory) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await WorldHistoryModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await WorldHistoryModel.countDocuments(filter || {}).exec();
  }
}
