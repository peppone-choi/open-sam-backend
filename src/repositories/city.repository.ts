import { City } from '../models/city.model';

/**
 * 도시 리포지토리
 * 
 * 도시 데이터의 데이터베이스 접근을 담당합니다.
 */
class CityRepository {
  /**
   * ID로 도시 조회
   * @param cityId - 도시 ID
   * @returns 도시 문서 또는 null
   */
  async findById(cityId: string) {
    return City.findById(cityId);
  }

  /**
   * 도시 번호로 조회
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @returns 도시 문서 또는 null
   */
  async findByCityNum(sessionId: string, cityNum: number) {
    return City.findOne({ 
      session_id: sessionId, 
      city: cityNum 
    });
  }

  /**
   * 세션 내 모든 도시 조회
   * @param sessionId - 세션 ID
   * @returns 도시 목록
   */
  async findBySession(sessionId: string) {
    return City.find({ session_id: sessionId });
  }

  /**
   * 국가별 도시 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 도시 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return City.find({ 
      session_id: sessionId, 
      nation: nationId 
    });
  }

  /**
   * 무소속 도시 조회 (중립 도시)
   * @param sessionId - 세션 ID
   * @returns 중립 도시 목록
   */
  async findNeutral(sessionId: string) {
    return City.find({ 
      session_id: sessionId, 
      nation: 0 
    });
  }

  /**
   * 도시 생성
   * @param data - 도시 데이터
   * @returns 생성된 도시
   */
  async create(data: any) {
    return City.create(data);
  }

  /**
   * 도시 업데이트
   * @param cityId - 도시 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(cityId: string, update: any) {
    return City.updateOne(
      { _id: cityId },
      { $set: update }
    );
  }

  /**
   * 도시 번호로 업데이트
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateByCityNum(sessionId: string, cityNum: number, update: any) {
    return City.updateOne(
      { session_id: sessionId, city: cityNum },
      { $set: update }
    );
  }

  /**
   * 도시 삭제
   * @param cityId - 도시 ID
   * @returns 삭제 결과
   */
  async deleteById(cityId: string) {
    return City.deleteOne({ _id: cityId });
  }

  /**
   * 세션의 모든 도시 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return City.deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 도시 조회
   * @param filter - 검색 조건
   * @returns 도시 목록
   */
  async findByFilter(filter: any) {
    return City.find(filter);
  }

  /**
   * 도시 수 조회
   * @param filter - 검색 조건
   * @returns 도시 수
   */
  async count(filter: any): Promise<number> {
    return City.countDocuments(filter);
  }
}

/**
 * 도시 리포지토리 싱글톤 인스턴스
 */
export const cityRepository = new CityRepository();
