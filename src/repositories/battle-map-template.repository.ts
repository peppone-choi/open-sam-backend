// @ts-nocheck - Type issues need investigation
import { BattleMapTemplate } from '../models/battle-map-template.model';

/**
 * BattleMapTemplate 리포지토리
 * 40x40 전투 맵 템플릿 관리 (캐시 미사용 - 자주 변경되지 않음)
 */
class BattleMapTemplateRepository {
  /**
   * ID로 조회
   * @param id - 템플릿 ID
   * @returns 템플릿 문서 또는 null
   */
  async findById(id: string) {
    return BattleMapTemplate.findById(id);
  }

  /**
   * 템플릿 이름으로 조회
   * @param sessionId - 세션 ID
   * @param name - 템플릿 이름
   * @returns 템플릿 문서 또는 null
   */
  async findByName(sessionId: string, name: string) {
    return BattleMapTemplate.findOne({ session_id: sessionId, name });
  }

  /**
   * 세션의 모든 템플릿 조회
   * @param sessionId - 세션 ID
   * @returns 템플릿 목록
   */
  async findBySession(sessionId: string) {
    return BattleMapTemplate.find({ session_id: sessionId });
  }

  /**
   * 조건으로 한 개 조회
   * @param filter - 검색 조건
   * @returns 템플릿 문서 또는 null
   */
  async findOne(filter: any) {
    return BattleMapTemplate.findOne(filter);
  }

  /**
   * 조건으로 한 개 조회 (alias)
   * @param filter - 검색 조건
   * @returns 템플릿 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return BattleMapTemplate.findOne(filter);
  }

  /**
   * 조건으로 여러 개 조회
   * @param filter - 검색 조건
   * @returns 템플릿 목록
   */
  async find(filter: any) {
    return BattleMapTemplate.find(filter);
  }

  /**
   * 조건으로 여러 개 조회 (alias)
   * @param filter - 검색 조건
   * @returns 템플릿 목록
   */
  findByFilter(filter: any) {
    return BattleMapTemplate.find(filter);
  }

  /**
   * 템플릿 생성
   * @param data - 템플릿 데이터
   * @returns 생성된 템플릿
   */
  async create(data: any) {
    return BattleMapTemplate.create(data);
  }

  /**
   * 템플릿 업데이트
   * @param id - 템플릿 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(id: string, update: any) {
    return BattleMapTemplate.findByIdAndUpdate(id, update, { new: true });
  }

  /**
   * 조건으로 템플릿 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return BattleMapTemplate.updateOne(filter, { $set: update });
  }

  /**
   * 템플릿 삭제
   * @param id - 템플릿 ID
   * @returns 삭제 결과
   */
  async deleteById(id: string) {
    return BattleMapTemplate.findByIdAndDelete(id);
  }

  /**
   * 조건으로 템플릿 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteByFilter(filter: any) {
    return BattleMapTemplate.deleteOne(filter);
  }

  /**
   * 조건으로 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any) {
    return BattleMapTemplate.deleteMany(filter);
  }

  /**
   * 개수 세기
   * @param filter - 검색 조건
   * @returns 템플릿 수
   */
  async count(filter: any): Promise<number> {
    return BattleMapTemplate.countDocuments(filter);
  }

  /**
   * 세션의 모든 전투 맵 템플릿 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return BattleMapTemplate.deleteMany({ session_id: sessionId });
  }
}

/**
 * BattleMapTemplate 리포지토리 싱글톤 인스턴스
 */
export const battleMapTemplateRepository = new BattleMapTemplateRepository();
