// @ts-nocheck
import { Plock } from '../models/plock.model';
import { DeleteResult } from 'mongodb';

/**
 * PLock (프로세스 락) 리포지토리
 */
class PlockRepository {
  async findBySession(sessionId: string) {
    return Plock.find({ session_id: sessionId });
  }

  async findByKey(sessionId: string, lockKey: string) {
    return Plock.findOne({ 
      session_id: sessionId, 
      lock_key: lockKey 
    });
  }

  async create(data: any) {
    return Plock.create(data);
  }

  async deleteByKey(sessionId: string, lockKey: string): Promise<DeleteResult> {
    return Plock.deleteOne({ 
      session_id: sessionId, 
      lock_key: lockKey 
    });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Plock.deleteMany({ session_id: sessionId });
  }
}

export const plockRepository = new PlockRepository();
