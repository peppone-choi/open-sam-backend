// @ts-nocheck
import { BattleInstance } from '../models/battle-instance.model';
import { DeleteResult } from 'mongodb';

/**
 * 전투 인스턴스 리포지토리
 */
class BattleInstanceRepository {
  async findBySession(sessionId: string) {
    return BattleInstance.find({ session_id: sessionId });
  }

  async findById(instanceId: string) {
    return BattleInstance.findById(instanceId);
  }

  async findActive(sessionId: string) {
    return BattleInstance.find({ 
      session_id: sessionId, 
      status: 'active' 
    });
  }

  async create(data: any) {
    return BattleInstance.create(data);
  }

  async updateById(instanceId: string, update: any) {
    return BattleInstance.updateOne({ _id: instanceId }, { $set: update });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return BattleInstance.deleteMany({ session_id: sessionId });
  }
}

export const battleInstanceRepository = new BattleInstanceRepository();
