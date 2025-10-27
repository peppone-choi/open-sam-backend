import { NationModel } from '../model/nation.model';
import { INation } from '../@types/nation.types';

export class NationRepository {
  async findById(id: string): Promise<INation | null> {
    const nation = await NationModel.findById(id).lean().exec();
    return nation as INation | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INation[]> {
    const nations = await NationModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return nations as INation[];
  }

  async create(data: Partial<INation>): Promise<INation> {
    const nation = new NationModel(data);
    await nation.save();
    return nation.toObject() as INation;
  }

  async update(id: string, data: Partial<INation>): Promise<INation | null> {
    const nation = await NationModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return nation ? (nation.toObject() as INation) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NationModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INation[]> {
    const nations = await NationModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return nations as INation[];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NationModel.countDocuments(filter || {}).exec();
  }
}
