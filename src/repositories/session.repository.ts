import { Session } from '../models/session.model';
import { DeleteResult } from 'mongodb';
import { saveSession } from '../common/cache/model-cache.helper';

/**
 * 세션 리포지토리
 * 
 * 세션 데이터의 데이터베이스 접근을 담당합니다.
 * 쓰기 작업 시 캐시도 함께 업데이트합니다.
 * 
 * 읽기: L1 → L2 → DB (model-cache.helper 사용)
 * 쓰기: DB → L2 → L1 (캐시 업데이트 포함)
 */
class SessionRepository {
  /**
   * 세션 ID로 세션 조회
   * @param sessionId - 세션 ID
   * @returns 세션 문서 또는 null
   */
  async findBySessionId(sessionId: string) {
    return (Session as any).findOne({ session_id: sessionId });
  }

  /**
   * 활성 상태인 모든 세션 조회
   * @returns 활성 세션 목록
   */
  async findAllActive() {
    return (Session as any).find({ status: { $ne: 'finished' } });
  }

  /**
   * 모든 세션 조회 (상태 무관)
   * @returns 모든 세션 목록
   */
  async findAll() {
    return (Session as any).find();
  }

  /**
   * 세션 생성
   * @param data - 세션 데이터
   * @returns 생성된 세션 (Redis에 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    // Redis에만 저장 (DB는 데몬이 동기화)
    if (data.session_id) {
      await saveSession(data.session_id, data);
    }
    return data;
  }

  /**
   * 세션 업데이트
   * @param sessionId - 세션 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateBySessionId(sessionId: string, update: any) {
    // 기존 세션 데이터 조회 (L1 → L2 → DB)
    const { getSession } = require('../common/cache/model-cache.helper');
    const existing = await getSession(sessionId) || {};
    
    // 업데이트된 데이터 병합
    const updated = { ...existing, ...update };
    
    // Redis에만 저장
    await saveSession(sessionId, updated);
    
    return { modifiedCount: 1, matchedCount: 1 };
  }

  /**
   * 세션 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySessionId(sessionId: string): Promise<DeleteResult> {
    return (Session as any).deleteOne({ session_id: sessionId });
  }

  /**
   * 세션 존재 여부 확인
   * @param sessionId - 세션 ID
   * @returns 존재 여부
   */
  async exists(sessionId: string): Promise<boolean> {
    const count = await (Session as any).countDocuments({ session_id: sessionId });
    return count > 0;
  }

  /**
   * 시나리오 ID별 세션 조회
   * @param scenarioId - 시나리오 ID
   * @returns 해당 시나리오를 사용하는 세션 목록
   */
  async findByScenarioId(scenarioId: string) {
    return (Session as any).find({ scenario_id: scenarioId });
  }

  /**
   * 활성 세션 중 시나리오별 조회
   * @param scenarioId - 시나리오 ID
   * @returns 해당 시나리오의 활성 세션 목록
   */
  async findActiveByScenarioId(scenarioId: string) {
    return (Session as any).find({
      scenario_id: scenarioId,
      status: { $ne: 'finished' }
    });
  }
}

/**
 * 세션 리포지토리 싱글톤 인스턴스
 */
export const sessionRepository = new SessionRepository();
