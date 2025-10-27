import { BattleModel } from '../model/battle.model';

export class BattleRepository {
  // TODO: 구현
  
  async findByGeneralId(sessionId: string, generalId: string) {
    return await BattleModel.find({
      sessionId,
      $or: [
        { attackerGeneralId: generalId },
        { defenderGeneralId: generalId }
      ]
    }).lean().exec();
  }
  
  async findActive(sessionId: string) {
    return await BattleModel.find({
      sessionId,
      status: { $in: ['pending', 'in_progress'] }
    }).lean().exec();
  }
}
