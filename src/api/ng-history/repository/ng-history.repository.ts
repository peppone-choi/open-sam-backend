import { NgHistoryModel, INgHistoryDocument } from '../model/ng-history.model';
import { INgHistory } from '../@types/ng-history.types';

export class NgHistoryRepository {
  async findById(id: string): Promise<INgHistory | null> {
    const history = await NgHistoryModel.findById(id).lean().exec();
    return history as INgHistory | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INgHistory[]> {
    const histories = await NgHistoryModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return histories as INgHistory[];
  }

  async findBySessionId(serverId: string, limit = 20, skip = 0): Promise<INgHistory[]> {
    const histories = await NgHistoryModel.find({ serverId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return histories as INgHistory[];
  }

  async create(data: Partial<INgHistory>): Promise<INgHistory> {
    const history = new NgHistoryModel(data);
    await history.save();
    return history.toObject() as INgHistory;
  }

  async update(id: string, data: Partial<INgHistory>): Promise<INgHistory | null> {
    const history = await NgHistoryModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return history ? (history.toObject() as INgHistory) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NgHistoryModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NgHistoryModel.countDocuments(filter || {}).exec();
  }
}
