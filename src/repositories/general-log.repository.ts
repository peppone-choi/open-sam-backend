// @ts-nocheck
import { GeneralLog } from '../models/general-log.model';
import { DeleteResult } from 'mongodb';

/**
 * 장수 로그 리포지토리
 */
class GeneralLogRepository {
  async findBySession(sessionId: string) {
    return GeneralLog.find({ session_id: sessionId });
  }

  async findByGeneral(sessionId: string, generalNo: number) {
    return GeneralLog.find({ 
      session_id: sessionId, 
      general_no: generalNo 
    });
  }

  async create(data: any) {
    return GeneralLog.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return GeneralLog.deleteMany({ session_id: sessionId });
  }
}

export const generalLogRepository = new GeneralLogRepository();
