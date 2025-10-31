import { Session } from '../models/session.model';

/**
 * 세션 리포지토리
 * 
 * 세션 데이터의 데이터베이스 접근을 담당합니다.
 * 서비스 레이어는 이 리포지토리를 통해서만 DB에 접근합니다.
 */
class SessionRepository {
  /**
   * 세션 ID로 세션 조회
   * @param sessionId - 세션 ID
   * @returns 세션 문서 또는 null
   */
  async findBySessionId(sessionId: string) {
    return Session.findOne({ session_id: sessionId });
  }

  /**
   * 활성 상태인 모든 세션 조회
   * @returns 활성 세션 목록
   */
  async findAllActive() {
    return Session.find({ status: { $ne: 'finished' } });
  }

  /**
   * 모든 세션 조회 (상태 무관)
   * @returns 모든 세션 목록
   */
  async findAll() {
    return Session.find();
  }

  /**
   * 세션 생성
   * @param data - 세션 데이터
   * @returns 생성된 세션
   */
  async create(data: any) {
    return Session.create(data);
  }

  /**
   * 세션 업데이트
   * @param sessionId - 세션 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateBySessionId(sessionId: string, update: any) {
    return Session.updateOne(
      { session_id: sessionId },
      { $set: update }
    );
  }

  /**
   * 세션 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySessionId(sessionId: string) {
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
}

/**
 * 세션 리포지토리 싱글톤 인스턴스
 */
export const sessionRepository = new SessionRepository();
