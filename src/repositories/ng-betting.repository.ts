// @ts-nocheck
import { NgBetting } from '../models/ng_betting.model';
import { DeleteResult } from 'mongodb';

/**
 * NG 베팅 리포지토리
 */
class NgBettingRepository {
  async findBySession(sessionId: string) {
    return NgBetting.find({ session_id: sessionId });
  }

  async findByGeneral(sessionId: string, generalNo: number) {
    return NgBetting.find({ 
      session_id: sessionId, 
      general_no: generalNo 
    });
  }

  async create(data: any) {
    return NgBetting.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NgBetting.deleteMany({ session_id: sessionId });
  }
}

export const ngBettingRepository = new NgBettingRepository();
