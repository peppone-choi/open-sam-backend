// @ts-nocheck
import { NationEnv } from '../models/nation-env.model';
import { DeleteResult } from 'mongodb';

/**
 * 국가 환경 리포지토리
 */
class NationEnvRepository {
  async findBySession(sessionId: string) {
    return NationEnv.find({ session_id: sessionId });
  }

  async findByNation(sessionId: string, nationNo: number) {
    return NationEnv.findOne({ 
      session_id: sessionId, 
      nation_no: nationNo 
    });
  }

  async create(data: any) {
    return NationEnv.create(data);
  }

  async updateByNation(sessionId: string, nationNo: number, update: any) {
    return NationEnv.updateOne(
      { session_id: sessionId, nation_no: nationNo },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NationEnv.deleteMany({ session_id: sessionId });
  }
}

export const nationEnvRepository = new NationEnvRepository();
