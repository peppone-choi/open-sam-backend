// @ts-nocheck - Type issues need investigation
import { Diplomacy } from '../models/diplomacy.model';
import { DeleteResult } from 'mongodb';

/**
 * 외교 리포지토리
 * 국가 간 외교 관계를 관리
 */
class DiplomacyRepository {
  /**
   * 외교 관계 생성
   * @param data - 외교 관계 데이터
   * @returns 생성된 외교 관계
   */
  async create(data: any) {
    return Diplomacy.create(data);
  }

  /**
   * 여러 외교 관계 일괄 생성
   * @param dataArray - 외교 관계 데이터 배열
   * @returns 생성된 외교 관계 배열
   */
  async insertMany(dataArray: any[]) {
    return Diplomacy.insertMany(dataArray);
  }

  /**
   * 세션별 외교 관계 조회
   * @param sessionId - 세션 ID
   * @param filter - 추가 필터 조건
   * @returns 외교 관계 목록
   */
  async findBySession(sessionId: string, filter?: any) {
    return Diplomacy.find({ 
      session_id: sessionId, 
      ...filter 
    });
  }

  /**
   * 특정 국가의 외교 관계 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 외교 관계 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return Diplomacy.find({
      session_id: sessionId,
      me: nationId
    });
  }

  /**
   * 두 국가 간 외교 관계 조회
   * @param sessionId - 세션 ID
   * @param meNationId - 나의 국가 ID
   * @param youNationId - 상대 국가 ID
   * @returns 외교 관계 문서 또는 null
   */
  async findRelation(sessionId: string, meNationId: number, youNationId: number) {
    return Diplomacy.findOne({
      session_id: sessionId,
      me: meNationId,
      you: youNationId
    });
  }

  /**
   * 조건으로 외교 관계 한 개 조회
   * @param filter - 검색 조건
   * @returns 외교 관계 문서 또는 null
   */
  async findOne(filter: any) {
    return Diplomacy.findOne(filter);
  }

  /**
   * 조건으로 외교 관계 조회
   * @param filter - 검색 조건
   * @returns 외교 관계 목록
   */
  findByFilter(filter: any) {
    return Diplomacy.find(filter);
  }

  /**
   * 조건으로 외교 관계 한 개 조회 (alias)
   * @param filter - 검색 조건
   * @returns 외교 관계 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return Diplomacy.findOne(filter);
  }

  /**
   * 외교 관계 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateMany(filter: any, update: any) {
    return Diplomacy.updateMany(filter, update);
  }

  /**
   * 외교 관계 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any): Promise<DeleteResult> {
    return Diplomacy.deleteMany(filter);
  }

  /**
   * 국가의 모든 외교 관계 삭제
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 삭제 결과
   */
  async deleteByNation(sessionId: string, nationId: number): Promise<DeleteResult> {
    return Diplomacy.deleteMany({
      session_id: sessionId,
      $or: [
        { me: nationId },
        { you: nationId }
      ]
    });
  }

  /**
   * 전투 사망자 통계 업데이트
   */
  async updateDeaths(sessionId: string, meNationId: number, youNationId: number, deaths: number): Promise<void> {
    const amount = Math.max(0, Math.round(deaths));
    if (amount === 0) {
      return;
    }

    await Diplomacy.updateOne(
      { session_id: sessionId, me: meNationId, you: youNationId },
      { $inc: { 'stats.deaths': amount, [`stats.deathsBy.${youNationId}`]: amount } },
      { upsert: true, strict: false }
    );
  }

  /**
   * 세션의 모든 외교 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Diplomacy.deleteMany({ session_id: sessionId });
  }
}

/**
 * 외교 리포지토리 싱글톤 인스턴스
 */

export const diplomacyRepository = new DiplomacyRepository();
