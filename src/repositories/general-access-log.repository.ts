// @ts-nocheck
import { GeneralAccessLog } from '../models/general_access_log.model';
import { DeleteResult } from 'mongodb';

/**
 * 장수 접속 로그 리포지토리
 */
class GeneralAccessLogRepository {
  async findBySession(sessionId: string) {
    return GeneralAccessLog.find({ session_id: sessionId });
  }

  async findByGeneral(sessionId: string, generalNo: number) {
    return GeneralAccessLog.find({ 
      session_id: sessionId, 
      general_no: generalNo 
    });
  }

  async create(data: any) {
    return GeneralAccessLog.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return GeneralAccessLog.deleteMany({ session_id: sessionId });
  }
}

export const generalAccessLogRepository = new GeneralAccessLogRepository();
