// @ts-nocheck - Type issues need investigation
import { GeneralTurn } from '../models/general_turn.model';

/**
 * GeneralTurn 리포지토리
 */
class GeneralTurnRepository {
  /**
   * 조건으로 조회
   */
  findByFilter(filter: any) {
    return GeneralTurn.find(filter);
  }

  /**
   * 세션으로 조회
   */
  findBySession(sessionId: string) {
    return GeneralTurn.find({ session_id: sessionId });
  }

  /**
   * 장수로 조회
   */
  findByGeneral(sessionId: string, generalNo: number) {
    return GeneralTurn.find({ session_id: sessionId, 'data.general_id': generalNo });
  }

  /**
   * 조건으로 한 개 조회
   */
  async findOneByFilter(filter: any) {
    return GeneralTurn.findOne(filter);
  }

  /**
   * ID로 조회
   */
  async findById(id: string) {
    return GeneralTurn.findById(id);
  }

  /**
   * 생성
   */
  async create(data: any) {
    return GeneralTurn.create(data);
  }

  /**
   * 업데이트
   */
  async updateOne(filter: any, update: any) {
    return GeneralTurn.updateOne(filter, update);
  }

  /**
   * 여러 개 업데이트
   */
  async updateMany(filter: any, update: any) {
    return GeneralTurn.updateMany(filter, update);
  }

  /**
   * 여러 개 업데이트 (조건으로, $set 자동 적용)
   */
  async updateManyByFilter(filter: any, update: any) {
    return GeneralTurn.updateMany(filter, { $set: update });
  }

  /**
   * 업데이트 또는 생성 (upsert)
   */
  async findOneAndUpdate(filter: any, update: any, options?: any) {
    return GeneralTurn.findOneAndUpdate(filter, update, options);
  }

  /**
   * 장수 턴 upsert (중복 방지)
   */
  async upsert(
    sessionId: string,
    generalId: number,
    turnIdx: number,
    data: { action: string; arg: any; brief: string }
  ) {
    return GeneralTurn.findOneAndUpdate(
      {
        session_id: sessionId,
        'data.general_id': generalId,
        'data.turn_idx': turnIdx
      },
      {
        $set: {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': turnIdx,
          'data.action': data.action,
          'data.arg': data.arg,
          'data.brief': data.brief
        }
      },
      { upsert: true, new: true }
    );
  }

  /**
   * 삭제
   */
  async deleteOne(filter: any) {
    return GeneralTurn.deleteOne(filter);
  }

  /**
   * 여러 개 삭제
   */
  async deleteMany(filter: any) {
    return GeneralTurn.deleteMany(filter);
  }

  /**
   * 개수 세기
   */
  async count(filter: any): Promise<number> {
    return GeneralTurn.countDocuments(filter);
  }

  /**
   * 벌크 작업
   */
  async bulkWrite(operations: any[]) {
    return GeneralTurn.bulkWrite(operations);
  }

  /**
   * 조건으로 여러 개 삭제 (alias)
   */
  async deleteManyByFilter(filter: any) {
    return GeneralTurn.deleteMany(filter);
  }

  /**
   * 세션의 모든 장수턴 삭제
   */
  async deleteBySession(sessionId: string) {
    return GeneralTurn.deleteMany({ session_id: sessionId });
  }
}

/**
 * GeneralTurn 리포지토리 싱글톤
 */
export const generalTurnRepository = new GeneralTurnRepository();
