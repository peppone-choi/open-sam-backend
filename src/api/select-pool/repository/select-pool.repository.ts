import { SelectPoolModel } from '../model/select-pool.model';
import { ISelectPool } from '../@types/select-pool.types';

export class SelectPoolRepository {
  async findById(id: string): Promise<ISelectPool | null> {
    const pool = await SelectPoolModel.findById(id).lean().exec();
    return pool as ISelectPool | null;
  }

  async findAll(limit = 20, skip = 0): Promise<ISelectPool[]> {
    const pools = await SelectPoolModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return pools as ISelectPool[];
  }

  async findBySession(sessionId: string, limit = 20, skip = 0): Promise<ISelectPool[]> {
    const pools = await SelectPoolModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return pools as ISelectPool[];
  }

  async findBySessionAndName(sessionId: string, uniqueName: string): Promise<ISelectPool | null> {
    const pool = await SelectPoolModel.findOne({ sessionId, uniqueName }).lean().exec();
    return pool as ISelectPool | null;
  }

  async findAvailable(sessionId: string, limit = 20): Promise<ISelectPool[]> {
    const now = new Date();
    const pools = await SelectPoolModel.find({
      sessionId,
      $or: [
        { reservedUntil: { $exists: false } },
        { reservedUntil: null },
        { reservedUntil: { $lt: now } },
      ],
    })
      .limit(limit)
      .lean()
      .exec();
    
    return pools as ISelectPool[];
  }

  async create(data: Partial<ISelectPool>): Promise<ISelectPool> {
    const pool = new SelectPoolModel(data);
    await pool.save();
    return pool.toObject() as ISelectPool;
  }

  async update(id: string, data: Partial<ISelectPool>): Promise<ISelectPool | null> {
    const pool = await SelectPoolModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return pool ? (pool.toObject() as ISelectPool) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await SelectPoolModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await SelectPoolModel.countDocuments(filter || {}).exec();
  }
}
