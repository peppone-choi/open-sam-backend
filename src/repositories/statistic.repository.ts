// @ts-nocheck
import { Statistic } from '../models/statistic.model';
import { DeleteResult } from 'mongodb';

/**
 * 통계 리포지토리
 */
class StatisticRepository {
  async findBySession(sessionId: string) {
    return Statistic.find({ session_id: sessionId });
  }

  async findByType(sessionId: string, statType: string) {
    return Statistic.find({ 
      session_id: sessionId, 
      type: statType 
    }).sort({ created_at: -1 });
  }

  async create(data: any) {
    return Statistic.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Statistic.deleteMany({ session_id: sessionId });
  }
}

export const statisticRepository = new StatisticRepository();
