import { BattleUnitModel } from '../model/battle-unit.model';
import { IBattleUnit } from '../@types/battle.types';

export class BattleUnitRepository {
  async create(data: Partial<IBattleUnit>): Promise<IBattleUnit> {
    const battleUnit = new BattleUnitModel(data);
    await battleUnit.save();
    return battleUnit.toObject() as IBattleUnit;
  }

  async findById(id: string): Promise<IBattleUnit | null> {
    const battleUnit = await BattleUnitModel.findById(id).lean().exec();
    return battleUnit as IBattleUnit | null;
  }

  async findBySessionId(battleId: string): Promise<IBattleUnit[]> {
    const battleUnits = await BattleUnitModel.find({ battleId })
      .lean()
      .exec();
    return battleUnits as IBattleUnit[];
  }

  async update(id: string, data: Partial<IBattleUnit>): Promise<IBattleUnit | null> {
    const battleUnit = await BattleUnitModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return battleUnit ? (battleUnit.toObject() as IBattleUnit) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await BattleUnitModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findByCommanderId(commanderId: string): Promise<IBattleUnit | null> {
    const battleUnit = await BattleUnitModel.findOne({ commanderId }).lean().exec();
    return battleUnit as IBattleUnit | null;
  }

  async findByBattleAndStatus(battleId: string, status: string): Promise<IBattleUnit[]> {
    const battleUnits = await BattleUnitModel.find({ battleId, status })
      .lean()
      .exec();
    return battleUnits as IBattleUnit[];
  }

  async deleteByBattleId(battleId: string): Promise<number> {
    const result = await BattleUnitModel.deleteMany({ battleId }).exec();
    return result.deletedCount || 0;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await BattleUnitModel.countDocuments(filter || {}).exec();
  }
}
