import { BattleSessionModel } from '../model/battle-session.model';
import { IBattleSession } from '../@types/battle.types';

export class BattleSessionRepository {
  async create(data: Partial<IBattleSession>): Promise<IBattleSession> {
    const battleSession = new BattleSessionModel(data);
    await battleSession.save();
    return battleSession.toObject() as IBattleSession;
  }

  async findById(id: string): Promise<IBattleSession | null> {
    const battleSession = await BattleSessionModel.findById(id).lean().exec();
    return battleSession as IBattleSession | null;
  }

  async findBySessionId(sessionId: string): Promise<IBattleSession[]> {
    const battleSessions = await BattleSessionModel.find({ sessionId })
      .lean()
      .exec();
    return battleSessions as IBattleSession[];
  }

  async update(id: string, data: Partial<IBattleSession>): Promise<IBattleSession | null> {
    const battleSession = await BattleSessionModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return battleSession ? (battleSession.toObject() as IBattleSession) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await BattleSessionModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findByNationId(nationId: string): Promise<IBattleSession[]> {
    const battleSessions = await BattleSessionModel.find({
      $or: [
        { attackerNationId: nationId },
        { defenderNationId: nationId }
      ]
    }).lean().exec();
    
    return battleSessions as IBattleSession[];
  }

  async findByStatus(status: string): Promise<IBattleSession[]> {
    const battleSessions = await BattleSessionModel.find({ status })
      .lean()
      .exec();
    return battleSessions as IBattleSession[];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await BattleSessionModel.countDocuments(filter || {}).exec();
  }
}
