import { Nation } from '../models/nation.model';

/**
 * 국가 리포지토리
 * 
 * 국가 데이터의 데이터베이스 접근을 담당합니다.
 */
class NationRepository {
  /**
   * ID로 국가 조회
   * @param nationId - 국가 ID
   * @returns 국가 문서 또는 null
   */
  async findById(nationId: string) {
    return Nation.findById(nationId);
  }

  /**
   * 국가 번호로 조회
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @returns 국가 문서 또는 null
   */
  async findByNationNum(sessionId: string, nationNum: number) {
    return Nation.findOne({ 
      session_id: sessionId, 
      nation: nationNum 
    });
  }

  /**
   * 세션 내 모든 국가 조회
   * @param sessionId - 세션 ID
   * @returns 국가 목록
   */
  async findBySession(sessionId: string) {
    return Nation.find({ session_id: sessionId });
  }

  /**
   * 활성 국가 조회 (멸망하지 않은 국가)
   * @param sessionId - 세션 ID
   * @returns 활성 국가 목록
   */
  async findActive(sessionId: string) {
    return Nation.find({ 
      session_id: sessionId,
      level: { $gt: 0 }
    });
  }

  /**
   * 국가 생성
   * @param data - 국가 데이터
   * @returns 생성된 국가
   */
  async create(data: any) {
    return Nation.create(data);
  }

  /**
   * 국가 업데이트
   * @param nationId - 국가 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(nationId: string, update: any) {
    return Nation.updateOne(
      { _id: nationId },
      { $set: update }
    );
  }

  /**
   * 국가 번호로 업데이트
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateByNationNum(sessionId: string, nationNum: number, update: any) {
    return Nation.updateOne(
      { session_id: sessionId, nation: nationNum },
      { $set: update }
    );
  }

  /**
   * 국가 삭제
   * @param nationId - 국가 ID
   * @returns 삭제 결과
   */
  async deleteById(nationId: string) {
    return Nation.deleteOne({ _id: nationId });
  }

  /**
   * 세션의 모든 국가 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return Nation.deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 국가 조회
   * @param filter - 검색 조건
   * @returns 국가 목록
   */
  async findByFilter(filter: any) {
    return Nation.find(filter);
  }

  /**
   * 국가 수 조회
   * @param filter - 검색 조건
   * @returns 국가 수
   */
  async count(filter: any): Promise<number> {
    return Nation.countDocuments(filter);
  }
}

/**
 * 국가 리포지토리 싱글톤 인스턴스
 */
export const nationRepository = new NationRepository();
