// @ts-nocheck
import { SelectPool } from '../models/select_pool.model';
import { DeleteResult } from 'mongodb';

/**
 * 선택 풀 리포지토리
 */
class SelectPoolRepository {
  async findBySession(sessionId: string) {
    return SelectPool.find({ session_id: sessionId });
  }

  async findAvailable(sessionId: string) {
    return SelectPool.find({ 
      session_id: sessionId, 
      available: true 
    });
  }

  async create(data: any) {
    return SelectPool.create(data);
  }

  async updateById(poolId: string, update: any) {
    return SelectPool.updateOne({ _id: poolId }, { $set: update });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return SelectPool.deleteMany({ session_id: sessionId });
  }
}

export const selectPoolRepository = new SelectPoolRepository();
