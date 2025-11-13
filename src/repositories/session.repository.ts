// @ts-nocheck - Type issues need investigation
import { Session } from '../models/session.model';
import { DeleteResult } from 'mongodb';
import { saveSession, getSession } from '../common/cache/model-cache.helper';

/**
 * 세션 리포지토리
 * 
 * 세션 데이터의 데이터베이스 접근을 담당합니다.
 * 쓰기 작업 시 캐시도 함께 업데이트합니다.
 * 
 * 읽기: L1 → L2 → DB (model-cache.helper 사용)
 * 쓰기: Redis → L1 (데몬이 DB 동기화)
 */
class SessionRepository {
  /**
   * 세션 ID로 세션 조회 (L1 → L2 → DB)
   * @param sessionId - 세션 ID
   * @returns 세션 문서 또는 null
   */
  async findBySessionId(sessionId: string) {
    // 캐시에서 먼저 조회
    const cached = await getSession(sessionId);
    if (cached) {
      // plain object를 Mongoose Document로 변환
      const doc = new Session(cached);
      doc.isNew = false; // 기존 문서임을 표시
      return doc;
    }
    
    // 캐시 미스 시 DB 조회
    const session = await Session.findOne({ session_id: sessionId });
    
    // DB에서 조회한 결과를 캐시에 저장
    if (session) {
      await saveSession(sessionId, session.toObject());
    }
    
    return session;
  }

  /**
   * 활성 상태인 모든 세션 조회
   * @returns 활성 세션 목록
   */
  async findAllActive() {
    return Session.find({ status: { $ne: 'finished' } });
  }

  /**
   * 필터 조건으로 세션 조회
   * @param filter - MongoDB 필터 조건
   * @returns 조회된 세션 목록
   */
  async findByFilter(filter: any) {
    return Session.find(filter);
  }

  /**
   * 모든 세션 조회 (상태 무관)
   * @returns 모든 세션 목록
   */
  async findAll() {
    return Session.find();
  }

  /**
   * MongoDB _id로 세션 조회
   * @param id - MongoDB _id
   * @returns 세션 문서 또는 null
   */
  async findById(id: string) {
    return Session.findById(id);
  }

  /**
   * 세션 생성
   * @param data - 세션 데이터
   * @returns 생성된 세션 (MongoDB와 Redis에 저장)
   */
  async create(data: any) {
    // MongoDB에 직접 저장
    const session = new Session(data);
    await session.save();
    
    // Redis에도 저장 (캐시)
    if (data.session_id) {
      await saveSession(data.session_id, data);
    }
    
    return session;
  }

  /**
   * 세션 업데이트
   * @param sessionId - 세션 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateBySessionId(sessionId: string, update: any) {
    // 기존 세션 데이터 조회 (L1 → L2 → DB)
    const existing = await getSession(sessionId) || {};
    
    // 업데이트된 데이터 병합
    const updated = { ...existing, ...update };
    
    // Redis에만 저장
    await saveSession(sessionId, updated);
    
    return { modifiedCount: 1, matchedCount: 1 };
  }

  /**
   * Mongoose 문서를 저장 (session.save() 대체)
   * @param sessionDoc - Mongoose 세션 문서
   * @returns 저장 결과
   */
  async saveDocument(sessionDoc: any, immediate: boolean = false) {
    const sessionId = sessionDoc.session_id || sessionDoc.data?.session_id;
    if (!sessionId) {
      throw new Error('session_id is required');
    }
    
    // Mongoose Document인 경우 save() 메서드 사용 (DB 저장)
    if (sessionDoc.save && typeof sessionDoc.save === 'function') {
      // Mongoose Document - DB에 직접 저장
      await sessionDoc.save();
    }
    
    // Mongoose Document인 경우 toObject()로 변환
    let dataToSave;
    if (sessionDoc.toObject) {
      dataToSave = sessionDoc.toObject();
    } else {
      dataToSave = sessionDoc;
    }
    
    // 캐시에도 저장
    await saveSession(sessionId, dataToSave);
    
    return { modifiedCount: 1, matchedCount: 1 };
  }

  /**
   * 세션 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySessionId(sessionId: string): Promise<DeleteResult> {
    return Session.deleteOne({ session_id: sessionId });
  }

  /**
   * 세션 존재 여부 확인
   * @param sessionId - 세션 ID
   * @returns 존재 여부
   */
  async exists(sessionId: string): Promise<boolean> {
    const count = await Session.countDocuments({ session_id: sessionId });
    return count > 0;
  }

  /**
   * 시나리오 ID별 세션 조회
   * @param scenarioId - 시나리오 ID
   * @returns 해당 시나리오를 사용하는 세션 목록
   */
  async findByScenarioId(scenarioId: string) {
    return Session.find({ scenario_id: scenarioId });
  }

  /**
   * 활성 세션 중 시나리오별 조회
   * @param scenarioId - 시나리오 ID
   * @returns 해당 시나리오의 활성 세션 목록
   */
  async findActiveByScenarioId(scenarioId: string) {
    return Session.find({
      scenario_id: scenarioId,
      status: { $ne: 'finished' }
    });
  }

  /**
   * 세션 삭제 (AdminServerManagement용)
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async delete(sessionId: string): Promise<DeleteResult> {
    return this.deleteBySessionId(sessionId);
  }
}

/**
 * 세션 리포지토리 싱글톤 인스턴스
 */
export const sessionRepository = new SessionRepository();
