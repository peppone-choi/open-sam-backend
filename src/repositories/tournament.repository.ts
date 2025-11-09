import { Tournament } from '../models/tournament.model';

/**
 * Tournament 리포지토리
 * 토너먼트 참가자 및 대진표 관리 (캐시 미사용 - 실시간 데이터)
 */
class TournamentRepository {
  /**
   * 세션의 모든 토너먼트 참가자 조회
   * @param sessionId - 세션 ID
   * @returns 토너먼트 참가자 목록
   */
  async findBySession(sessionId: string) {
    return Tournament.find({ session_id: sessionId });
  }

  /**
   * 그룹별 참가자 조회
   * @param sessionId - 세션 ID
   * @param group - 그룹 번호
   * @returns 그룹 참가자 목록
   */
  async findByGroup(sessionId: string, group: number) {
    return Tournament.find({ 
      session_id: sessionId, 
      grp: group 
    }).sort({ grp_no: 1 }).exec();
  }

  /**
   * 장수 번호로 조회
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호
   * @returns 토너먼트 참가자 또는 null
   */
  async findByGeneralNo(sessionId: string, generalNo: number) {
    return Tournament.findOne({ 
      session_id: sessionId, 
      no: generalNo 
    });
  }

  /**
   * 조건으로 한 명 조회
   * @param filter - 검색 조건
   * @returns 토너먼트 참가자 또는 null
   */
  async findOne(filter: any) {
    return Tournament.findOne(filter);
  }

  /**
   * 조건으로 한 명 조회 (alias)
   * @param filter - 검색 조건
   * @returns 토너먼트 참가자 또는 null
   */
  async findOneByFilter(filter: any) {
    return Tournament.findOne(filter);
  }

  /**
   * 조건으로 여러 명 조회
   * @param filter - 검색 조건
   * @param sort - 정렬 조건
   * @returns 토너먼트 참가자 목록
   */
  async find(filter: any, sort?: any) {
    const query = Tournament.find(filter);
    if (sort) {
      return query.sort(sort).exec();
    }
    return query;
  }

  /**
   * 조건으로 여러 명 조회 (alias)
   * @param filter - 검색 조건
   * @returns 토너먼트 참가자 목록
   */
  async findByFilter(filter: any) {
    return Tournament.find(filter);
  }

  /**
   * 참가자 생성
   * @param data - 토너먼트 데이터
   * @returns 생성된 참가자
   */
  async create(data: any) {
    return Tournament.create(data);
  }

  /**
   * 여러 참가자 생성
   * @param dataArray - 토너먼트 데이터 배열
   * @returns 생성된 참가자 목록
   */
  async createMany(dataArray: any[]) {
    return Tournament.insertMany(dataArray);
  }

  /**
   * 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOne(filter: any, update: any) {
    return Tournament.updateOne(filter, update);
  }

  /**
   * 업데이트 (alias)
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return Tournament.updateOne(filter, { $set: update });
  }

  /**
   * 여러 참가자 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateMany(filter: any, update: any) {
    return Tournament.updateMany(filter, update);
  }

  /**
   * 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteOne(filter: any) {
    return Tournament.deleteOne(filter);
  }

  /**
   * 여러 참가자 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any) {
    return Tournament.deleteMany(filter);
  }

  /**
   * 개수 세기
   * @param filter - 검색 조건
   * @returns 참가자 수
   */
  async count(filter: any): Promise<number> {
    return Tournament.countDocuments(filter);
  }

  /**
   * 최대 seq 조회
   * @param sessionId - 세션 ID
   * @returns 최대 seq 값
   */
  async getMaxSeq(sessionId: string): Promise<number> {
    const result = await Tournament
      .findOne({ session_id: sessionId })
      .sort({ seq: -1 })
      .lean();
    return result?.seq || 0;
  }
}

/**
 * Tournament 리포지토리 싱글톤 인스턴스
 */
export const tournamentRepository = new TournamentRepository();
