// @ts-nocheck - Type issues need investigation
import { WorldHistory } from '../models/world_history.model';
import { DeleteResult } from 'mongodb';

/**
 * 세계 히스토리 리포지토리
 * 게임 내 주요 이벤트와 역사를 기록
 */
class WorldHistoryRepository {
  /**
   * 히스토리 생성
   * @param data - 히스토리 데이터
   * @returns 생성된 히스토리
   */
  async create(data: any) {
    return WorldHistory.create(data);
  }

  /**
   * 세션별 히스토리 조회
   * @param sessionId - 세션 ID
   * @param filter - 추가 필터 조건
   * @returns 히스토리 목록
   */
  async findBySession(sessionId: string, filter?: any) {
    return WorldHistory.find({ 
      session_id: sessionId, 
      ...filter 
    }).sort({ date: -1 }).exec();
  }

  /**
   * 년/월별 히스토리 조회
   * @param sessionId - 세션 ID
   * @param year - 년도
   * @param month - 월
   * @returns 히스토리 목록
   */
  async findByYearMonth(sessionId: string, year: number, month: number) {
    return WorldHistory.find({
      session_id: sessionId,
      year,
      month
    }).sort({ date: -1 }).exec();
  }

  /**
   * 조건으로 히스토리 여러 개 조회
   * @param filter - 검색 조건
   * @returns 히스토리 목록
   */
  async find(filter: any) {
    return WorldHistory.find(filter).sort({ 'data.id': -1 }).limit(30).lean();
  }

  /**
   * 조건으로 히스토리 한 개 조회
   * @param filter - 검색 조건
   * @returns 히스토리 문서 또는 null
   */
  async findOne(filter: any) {
    return WorldHistory.findOne(filter);
  }

  /**
   * 조건으로 히스토리 조회 (alias)
   * @param filter - 검색 조건
   * @returns 히스토리 목록
   */
  findByFilter(filter: any) {
    return WorldHistory.find(filter);
  }

  /**
   * 조건으로 히스토리 한 개 조회 (alias)
   * @param filter - 검색 조건
   * @returns 히스토리 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return WorldHistory.findOne(filter);
  }

  /**
   * 히스토리 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any): Promise<DeleteResult> {
    return WorldHistory.deleteMany(filter);
  }

  /**
   * 세션의 모든 히스토리 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return WorldHistory.deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 여러 히스토리 삭제 (alias)
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    return WorldHistory.deleteMany(filter);
  }
}

/**
 * 세계 히스토리 리포지토리 싱글톤 인스턴스
 */
export const worldHistoryRepository = new WorldHistoryRepository();
