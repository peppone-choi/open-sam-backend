// @ts-nocheck - Type issues need investigation
import { NationTurn } from '../models/nation_turn.model';

/**
 * NationTurn 리포지토리
 */
class NationTurnRepository {
  /**
   * 조건으로 조회
   */
  findByFilter(filter: any) {
    return NationTurn.find(filter);
  }

  /**
   * 세션으로 조회
   */
  findBySession(sessionId: string) {
    return NationTurn.find({ session_id: sessionId });
  }

  /**
   * 조건으로 한 개 조회
   */
  async findOneByFilter(filter: any) {
    return NationTurn.findOne(filter);
  }

  /**
   * ID로 조회
   */
  async findById(id: string) {
    return NationTurn.findById(id);
  }

  /**
   * 생성
   */
  async create(data: any) {
    return NationTurn.create(data);
  }

  /**
   * 업데이트
   */
  async updateOne(filter: any, update: any) {
    return NationTurn.updateOne(filter, update);
  }

  /**
   * 여러 개 업데이트
   */
  async updateMany(filter: any, update: any) {
    return NationTurn.updateMany(filter, update);
  }

  /**
   * 업데이트 또는 생성 (upsert)
   */
  async findOneAndUpdate(filter: any, update: any, options?: any) {
    return NationTurn.findOneAndUpdate(filter, update, options);
  }

  /**
   * 삭제
   */
  async deleteOne(filter: any) {
    return NationTurn.deleteOne(filter);
  }

  /**
   * 여러 개 삭제
   */
  async deleteMany(filter: any) {
    return NationTurn.deleteMany(filter);
  }

  /**
   * 개수 세기
   */
  async count(filter: any): Promise<number> {
    return NationTurn.countDocuments(filter);
  }

  /**
   * 벌크 작업
   */
  async bulkWrite(operations: any[]) {
    return NationTurn.bulkWrite(operations);
  }
}

/**
 * NationTurn 리포지토리 싱글톤
 */
export const nationTurnRepository = new NationTurnRepository();
