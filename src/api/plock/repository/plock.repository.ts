import { PlockModel, IPlockDocument } from '../model/plock.model';
import { IPlock } from '../@types/plock.types';

export class PlockRepository {
  async findById(id: string): Promise<IPlock | null> {
    const plock = await PlockModel.findById(id).lean().exec();
    return plock as IPlock | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IPlock[]> {
    const plocks = await PlockModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return plocks as IPlock[];
  }

  async findByType(type: string): Promise<IPlock | null> {
    const plock = await PlockModel.findOne({ type }).lean().exec();
    return plock as IPlock | null;
  }

  async create(data: Partial<IPlock>): Promise<IPlock> {
    const plock = new PlockModel(data);
    await plock.save();
    return plock.toObject() as IPlock;
  }

  async update(id: string, data: Partial<IPlock>): Promise<IPlock | null> {
    const plock = await PlockModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return plock ? (plock.toObject() as IPlock) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await PlockModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await PlockModel.countDocuments(filter || {}).exec();
  }
}
