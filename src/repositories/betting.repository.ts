// @ts-nocheck
import { NgBetting } from '../models/ng_betting.model';
import { DeleteResult } from 'mongodb';

/**
 * Betting Repository
 */
class BettingRepository {
  async findBySession(sessionId: string, filter: any = {}) {
    return NgBetting.find({ session_id: sessionId, ...filter });
  }
  
  async create(data: any) {
    return NgBetting.create(data);
  }
  
  async updateMany(filter: any, update: any) {
    return NgBetting.updateMany(filter, { $set: update });
  }
  
  async deleteMany(filter: any): Promise<DeleteResult> {
    return NgBetting.deleteMany(filter);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NgBetting.deleteMany({ session_id: sessionId });
  }
}

export const bettingRepository = new BettingRepository();
