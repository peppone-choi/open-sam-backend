// @ts-nocheck
import { NgHistory } from '../models/ng_history.model';
import { DeleteResult } from 'mongodb';

/**
 * NG 히스토리 리포지토리
 */
class NgHistoryRepository {
  async findBySession(sessionId: string) {
    return NgHistory.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findByGeneral(sessionId: string, generalNo: number) {
    return NgHistory.find({ 
      session_id: sessionId, 
      general_no: generalNo 
    }).sort({ created_at: -1 });
  }

  async findRecent(sessionId: string, limit: number = 100) {
    return NgHistory.find({ session_id: sessionId })
      .sort({ created_at: -1 })
      .limit(limit);
  }

  async create(data: any) {
    return NgHistory.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NgHistory.deleteMany({ session_id: sessionId });
  }
}

export const ngHistoryRepository = new NgHistoryRepository();
