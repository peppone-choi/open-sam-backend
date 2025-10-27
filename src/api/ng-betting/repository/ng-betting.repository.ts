import { NgBettingModel } from '../model/ng-betting.model';
import { INgBetting } from '../@types/ng-betting.types';

export class NgBettingRepository {
  async findById(id: string): Promise<INgBetting | null> {
    const betting = await NgBettingModel.findById(id).lean().exec();
    return betting as INgBetting | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INgBetting[]> {
    const bettings = await NgBettingModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return bettings as INgBetting[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgBetting[]> {
    const bettings = await NgBettingModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return bettings as INgBetting[];
  }

  async findByGeneralId(generalId: string, limit = 20, skip = 0): Promise<INgBetting[]> {
    const bettings = await NgBettingModel.find({ generalId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return bettings as INgBetting[];
  }

  async findByBettingId(sessionId: string, bettingId: number): Promise<INgBetting[]> {
    const bettings = await NgBettingModel.find({ sessionId, bettingId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return bettings as INgBetting[];
  }

  async create(data: Partial<INgBetting>): Promise<INgBetting> {
    const betting = new NgBettingModel(data);
    await betting.save();
    return betting.toObject() as INgBetting;
  }

  async update(id: string, data: Partial<INgBetting>): Promise<INgBetting | null> {
    const betting = await NgBettingModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return betting ? (betting.toObject() as INgBetting) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NgBettingModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NgBettingModel.countDocuments(filter || {}).exec();
  }
}
