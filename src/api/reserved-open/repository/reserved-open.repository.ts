import { ReservedOpenModel, IReservedOpenDocument } from '../model/reserved-open.model';
import { IReservedOpen } from '../@types/reserved-open.types';

export class ReservedOpenRepository {
  async findById(id: string): Promise<IReservedOpen | null> {
    const reservedOpen = await ReservedOpenModel.findById(id).lean().exec();
    return reservedOpen as IReservedOpen | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IReservedOpen[]> {
    const reservedOpens = await ReservedOpenModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ date: 1 })
      .lean()
      .exec();
    
    return reservedOpens as IReservedOpen[];
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<IReservedOpen[]> {
    const reservedOpens = await ReservedOpenModel.find({
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: 1 })
      .lean()
      .exec();
    
    return reservedOpens as IReservedOpen[];
  }

  async create(data: Partial<IReservedOpen>): Promise<IReservedOpen> {
    const reservedOpen = new ReservedOpenModel(data);
    await reservedOpen.save();
    return reservedOpen.toObject() as IReservedOpen;
  }

  async update(id: string, data: Partial<IReservedOpen>): Promise<IReservedOpen | null> {
    const reservedOpen = await ReservedOpenModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return reservedOpen ? (reservedOpen.toObject() as IReservedOpen) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ReservedOpenModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await ReservedOpenModel.countDocuments(filter || {}).exec();
  }
}
