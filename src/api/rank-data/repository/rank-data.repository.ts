import { RankDataModel, IRankDataDocument } from '../model/rank-data.model';
import { IRankData } from '../@types/rank-data.types';

export class RankDataRepository {
  async findById(id: string): Promise<IRankData | null> {
    const rankData = await RankDataModel.findById(id).lean().exec();
    return rankData as IRankData | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IRankData[]> {
    const rankData = await RankDataModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return rankData as IRankData[];
  }

  async findByType(type: string, limit = 20, skip = 0): Promise<IRankData[]> {
    const rankData = await RankDataModel.find({ type })
      .sort({ value: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return rankData as IRankData[];
  }

  async findByNation(nationId: string, type: string, limit = 20, skip = 0): Promise<IRankData[]> {
    const rankData = await RankDataModel.find({ nationId, type })
      .sort({ value: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return rankData as IRankData[];
  }

  async create(data: Partial<IRankData>): Promise<IRankData> {
    const rankData = new RankDataModel(data);
    await rankData.save();
    return rankData.toObject() as IRankData;
  }

  async update(id: string, data: Partial<IRankData>): Promise<IRankData | null> {
    const rankData = await RankDataModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return rankData ? (rankData.toObject() as IRankData) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await RankDataModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await RankDataModel.countDocuments(filter || {}).exec();
  }
}
