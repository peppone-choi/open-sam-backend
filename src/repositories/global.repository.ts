import mongoose from 'mongoose';
import { General } from '../models';
import { Nation } from '../models';
import { City } from '../models';

/**
 * Global Repository
 * 데이터베이스 접근 계층
 */
export class GlobalRepository {
  /**
   * 세션별 데이터 조회
   */
  static async findBySession(sessionId: string, model: any, filter: any = {}) {
    return await model.find({ session_id: sessionId, ...filter });
  }
  
  /**
   * 데이터 생성
   */
  static async create(sessionId: string, model: any, data: any) {
    return await model.create({ session_id: sessionId, ...data });
  }
  
  /**
   * 데이터 업데이트
   */
  static async update(sessionId: string, model: any, filter: any, update: any) {
    return await model.updateMany(
      { session_id: sessionId, ...filter },
      { $set: update }
    );
  }
  
  /**
   * 데이터 삭제
   */
  static async delete(sessionId: string, model: any, filter: any) {
    return await model.deleteMany({ session_id: sessionId, ...filter });
  }
}
