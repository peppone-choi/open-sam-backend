// @ts-nocheck
import { UserRecord } from '../models/user_record.model';
import { DeleteResult } from 'mongodb';

/**
 * 유저 기록 리포지토리
 */
class UserRecordRepository {
  async findBySession(sessionId: string) {
    return UserRecord.find({ session_id: sessionId });
  }

  async findByUser(sessionId: string, userId: string) {
    return UserRecord.find({ 
      session_id: sessionId, 
      user_id: userId 
    });
  }

  async create(data: any) {
    return UserRecord.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return UserRecord.deleteMany({ session_id: sessionId });
  }
}

export const userRecordRepository = new UserRecordRepository();
