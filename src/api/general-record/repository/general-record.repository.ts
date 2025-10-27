import { GeneralRecordModel } from '../model/general-record.model';
import { IGeneralRecord } from '../@types/general-record.types';

export class GeneralRecordRepository {
  async findById(id: string): Promise<IGeneralRecord | null> {
    const record = await GeneralRecordModel.findById(id).lean().exec();
    return record as IGeneralRecord | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IGeneralRecord[]> {
    const records = await GeneralRecordModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ year: -1, month: -1 })
      .lean()
      .exec();
    
    return records as IGeneralRecord[];
  }

  async findByGeneralId(generalId: string, limit = 20, skip = 0): Promise<IGeneralRecord[]> {
    const records = await GeneralRecordModel.find({ generalId })
      .limit(limit)
      .skip(skip)
      .sort({ year: -1, month: -1 })
      .lean()
      .exec();
    
    return records as IGeneralRecord[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IGeneralRecord[]> {
    const records = await GeneralRecordModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ year: -1, month: -1 })
      .lean()
      .exec();
    
    return records as IGeneralRecord[];
  }

  async findByLogType(logType: string, limit = 20, skip = 0): Promise<IGeneralRecord[]> {
    const records = await GeneralRecordModel.find({ logType })
      .limit(limit)
      .skip(skip)
      .sort({ year: -1, month: -1 })
      .lean()
      .exec();
    
    return records as IGeneralRecord[];
  }

  async create(data: Partial<IGeneralRecord>): Promise<IGeneralRecord> {
    const record = new GeneralRecordModel(data);
    await record.save();
    return record.toObject() as IGeneralRecord;
  }

  async update(id: string, data: Partial<IGeneralRecord>): Promise<IGeneralRecord | null> {
    const record = await GeneralRecordModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return record ? (record.toObject() as IGeneralRecord) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await GeneralRecordModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await GeneralRecordModel.countDocuments(filter || {}).exec();
  }
}
