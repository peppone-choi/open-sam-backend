// @ts-nocheck - Type issues need investigation
import { Message } from '../models/message.model';

/**
 * Message 리포지토리
 * 메시지 데이터 관리 (캐시 미사용 - 실시간 데이터)
 */
class MessageRepositoryClass {
  /**
   * 조건으로 메시지 조회
   * @param filter - 검색 조건
   * @returns 메시지 목록
   */
  async findByFilter(filter: any) {
    return Message.find(filter);
  }

  /**
   * 하나의 메시지 조회
   * @param filter - 검색 조건
   * @returns 메시지 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return Message.findOne(filter);
  }

  /**
   * ID로 메시지 조회
   * @param id - 메시지 ID
   * @returns 메시지 문서 또는 null
   */
  async findById(id: string) {
    return Message.findById(id);
  }

  /**
   * 세션별 메시지 조회
   * @param sessionId - 세션 ID
   * @param additionalFilter - 추가 필터 (optional)
   * @returns 메시지 목록
   */
  async findBySession(sessionId: string, additionalFilter: any = {}) {
    return Message.find({ session_id: sessionId, ...additionalFilter });
  }

  /**
   * 메시지 생성
   * @param data - 메시지 데이터
   * @returns 생성된 메시지
   */
  async create(data: any) {
    return Message.create(data);
  }

  /**
   * 메시지 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return Message.updateOne(filter, update);
  }

  /**
   * 여러 메시지 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return Message.updateMany(filter, update);
  }

  /**
   * 메시지 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteByFilter(filter: any) {
    return Message.deleteOne(filter);
  }

  /**
   * 여러 메시지 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any) {
    return Message.deleteMany(filter);
  }

  /**
   * 메시지 수 조회
   * @param filter - 검색 조건
   * @returns 메시지 수
   */
  async count(filter: any): Promise<number> {
    return Message.countDocuments(filter);
  }

  /**
   * 세션의 모든 메시지 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return Message.deleteMany({ session_id: sessionId });
  }
}

/**
 * Message 리포지토리 싱글톤 인스턴스
 */
export const messageRepository = new MessageRepositoryClass();

// Legacy: 이전 버전 호환성을 위한 static class export
export class MessageRepository {
  static async findBySession(sessionId: string, model: any, filter: any = {}) {
    return await model.find({ session_id: sessionId, ...filter });
  }
  
  static async create(sessionId: string, model: any, data: any) {
    return await model.create({ session_id: sessionId, ...data });
  }
  
  static async update(sessionId: string, model: any, filter: any, update: any) {
    return await model.updateMany(
      { session_id: sessionId, ...filter },
      { $set: update }
    );
  }
  
  static async delete(sessionId: string, model: any, filter: any) {
    return await model.deleteMany({ session_id: sessionId, ...filter });
  }
}
