// @ts-nocheck
import { RankData } from '../models/rank_data.model';
import { DeleteResult } from 'mongodb';

/**
 * 랭킹 데이터 리포지토리
 */
class RankDataRepository {
  async findBySession(sessionId: string) {
    return RankData.find({ session_id: sessionId });
  }

  async findByCategory(sessionId: string, category: string) {
    return RankData.find({ 
      session_id: sessionId, 
      category 
    }).sort({ rank: 1 });
  }

  async create(data: any) {
    return RankData.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return RankData.deleteMany({ session_id: sessionId });
  }
}

export const rankDataRepository = new RankDataRepository();
