import { UserRecordModel } from '../model/user-record.model';
import { IUserRecord } from '../@types/user-record.types';

export class UserRecordRepository {
  async findById(id: string): Promise<IUserRecord | null> {
    const record = await UserRecordModel.findById(id).lean().exec();
    return record as IUserRecord | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IUserRecord[]> {
    const records = await UserRecordModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return records as IUserRecord[];
  }

  async findByUser(userId: string, serverId: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    const records = await UserRecordModel.find({ userId, serverId })
      .sort({ year: -1, month: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return records as IUserRecord[];
  }

  async findByServer(serverId: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    const records = await UserRecordModel.find({ serverId })
      .sort({ year: -1, month: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return records as IUserRecord[];
  }

  async findByLogType(logType: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    const records = await UserRecordModel.find({ logType })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return records as IUserRecord[];
  }

  async create(data: Partial<IUserRecord>): Promise<IUserRecord> {
    const record = new UserRecordModel(data);
    await record.save();
    return record.toObject() as IUserRecord;
  }

  async update(id: string, data: Partial<IUserRecord>): Promise<IUserRecord | null> {
    const record = await UserRecordModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return record ? (record.toObject() as IUserRecord) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await UserRecordModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await UserRecordModel.countDocuments(filter || {}).exec();
  }
}
