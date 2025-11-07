import { GeneralRecord } from '../models/general_record.model';
import { DeleteResult } from 'mongodb';

/**
 * 장수 기록 리포지토리
 * 장수의 행동 기록과 히스토리를 관리
 */
class GeneralRecordRepository {
  /**
   * 기록 생성
   * @param data - 기록 데이터
   * @returns 생성된 기록
   */
  async create(data: any) {
    return GeneralRecord.create(data);
  }

  /**
   * 세션별 기록 조회
   * @param sessionId - 세션 ID
   * @param filter - 추가 필터 조건
   * @returns 기록 목록
   */
  async findBySession(sessionId: string, filter?: any) {
    return GeneralRecord.find({ 
      session_id: sessionId, 
      ...filter 
    }).sort({ 'data.id': -1 }).limit(30).lean();
  }

  /**
   * 장수별 기록 조회
   * @param sessionId - 세션 ID
   * @param generalId - 장수 ID
   * @returns 기록 목록
   */
  async findByGeneral(sessionId: string, generalId: number) {
    return GeneralRecord.find({
      session_id: sessionId,
      'data.general_id': generalId
    });
  }

  /**
   * 조건으로 기록 한 개 조회
   * @param filter - 검색 조건
   * @returns 기록 문서 또는 null
   */
  async findOne(filter: any) {
    return GeneralRecord.findOne(filter);
  }

  /**
   * 기록 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any): Promise<DeleteResult> {
    return GeneralRecord.deleteMany(filter);
  }

  /**
   * 장수의 모든 기록 삭제
   * @param sessionId - 세션 ID
   * @param generalId - 장수 ID
   * @returns 삭제 결과
   */
  async deleteByGeneral(sessionId: string, generalId: number): Promise<DeleteResult> {
    return GeneralRecord.deleteMany({
      session_id: sessionId,
      'data.general_id': generalId
    });
  }
}

/**
 * 장수 기록 리포지토리 싱글톤 인스턴스
 */
export const generalRecordRepository = new GeneralRecordRepository();
