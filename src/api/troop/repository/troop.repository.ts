import { TroopModel } from '../model/troop.model';
import { ITroop } from '../@types/troop.types';

export class TroopRepository {
  async findById(id: string): Promise<ITroop | null> {
    const troop = await TroopModel.findById(id).lean().exec();
    return troop as ITroop | null;
  }

  async findAll(limit = 20, skip = 0): Promise<ITroop[]> {
    const troops = await TroopModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return troops as ITroop[];
  }

  async findByNationId(nationId: string, limit = 20, skip = 0): Promise<ITroop[]> {
    const troops = await TroopModel.find({ nation: nationId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return troops as ITroop[];
  }

  async findByCommanderId(commanderId: string): Promise<ITroop | null> {
    const troop = await TroopModel.findOne({ id: commanderId }).lean().exec();
    return troop as ITroop | null;
  }

  async create(data: Partial<ITroop>): Promise<ITroop> {
    const troop = new TroopModel(data);
    await troop.save();
    return troop.toObject() as ITroop;
  }

  async update(id: string, data: Partial<ITroop>): Promise<ITroop | null> {
    const troop = await TroopModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return troop ? (troop.toObject() as ITroop) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await TroopModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await TroopModel.countDocuments(filter || {}).exec();
  }
}
