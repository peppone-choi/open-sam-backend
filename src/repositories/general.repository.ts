import { General } from '../models/general.model';

/**
 * 장수 리포지토리
 * 
 * 장수 데이터의 데이터베이스 접근을 담당합니다.
 */
class GeneralRepository {
  /**
   * ID로 장수 조회
   * @param generalId - 장수 ID
   * @returns 장수 문서 또는 null
   */
  async findById(generalId: string) {
    return General.findById(generalId);
  }

  /**
   * 세션 내 모든 장수 조회
   * @param sessionId - 세션 ID
   * @returns 장수 목록
   */
  async findBySession(sessionId: string) {
    return General.find({ session_id: sessionId });
  }

  /**
   * 국가별 장수 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 장수 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return General.find({ 
      session_id: sessionId, 
      nation: nationId 
    });
  }

  /**
   * 도시별 장수 조회
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns 장수 목록
   */
  async findByCity(sessionId: string, cityId: number) {
    return General.find({ 
      session_id: sessionId, 
      city: cityId 
    });
  }

  /**
   * 재야 장수 조회
   * @param sessionId - 세션 ID
   * @returns 재야 장수 목록
   */
  async findNeutral(sessionId: string) {
    return General.find({ 
      session_id: sessionId, 
      nation: 0 
    });
  }

  /**
   * 장수 생성
   * @param data - 장수 데이터
   * @returns 생성된 장수
   */
  async create(data: any) {
    return General.create(data);
  }

  /**
   * 장수 업데이트
   * @param generalId - 장수 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(generalId: string, update: any) {
    return General.updateOne(
      { _id: generalId },
      { $set: update }
    );
  }

  /**
   * 장수 삭제
   * @param generalId - 장수 ID
   * @returns 삭제 결과
   */
  async deleteById(generalId: string) {
    return General.deleteOne({ _id: generalId });
  }

  /**
   * 조건으로 장수 조회
   * @param filter - 검색 조건
   * @returns 장수 목록
   */
  async findByFilter(filter: any) {
    return General.find(filter);
  }

  /**
   * 장수 수 조회
   * @param filter - 검색 조건
   * @returns 장수 수
   */
  async count(filter: any): Promise<number> {
    return General.countDocuments(filter);
  }

  /**
   * 페이지네이션 조회
   * @param filter - 검색 조건
   * @param page - 페이지 번호
   * @param limit - 페이지당 개수
   * @param sort - 정렬 조건
   * @returns 장수 목록
   */
  async findPaginated(
    filter: any,
    page: number = 1,
    limit: number = 20,
    sort: any = { name: 1 }
  ) {
    return General.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
  }
}

/**
 * 장수 리포지토리 싱글톤 인스턴스
 */
export const generalRepository = new GeneralRepository();
