import { GeneralAccessLogModel } from '../model/general-access-log.model';
import { IGeneralAccessLog } from '../@types/general-access-log.types';

export class GeneralAccessLogRepository {
  async findById(id: string): Promise<IGeneralAccessLog | null> {
    const log = await GeneralAccessLogModel.findById(id).lean().exec();
    return log as IGeneralAccessLog | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IGeneralAccessLog[]> {
    const logs = await GeneralAccessLogModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    
    return logs as IGeneralAccessLog[];
  }

  async findByGeneralId(generalId: string): Promise<IGeneralAccessLog | null> {
    const log = await GeneralAccessLogModel.findOne({ generalId }).lean().exec();
    return log as IGeneralAccessLog | null;
  }

  async findByUserId(userId: string, limit = 20, skip = 0): Promise<IGeneralAccessLog[]> {
    const logs = await GeneralAccessLogModel.find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    
    return logs as IGeneralAccessLog[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IGeneralAccessLog[]> {
    const logs = await GeneralAccessLogModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    
    return logs as IGeneralAccessLog[];
  }

  async create(data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog> {
    const log = new GeneralAccessLogModel(data);
    await log.save();
    return log.toObject() as IGeneralAccessLog;
  }

  async update(id: string, data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog | null> {
    const log = await GeneralAccessLogModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return log ? (log.toObject() as IGeneralAccessLog) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await GeneralAccessLogModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await GeneralAccessLogModel.countDocuments(filter || {}).exec();
  }
}
