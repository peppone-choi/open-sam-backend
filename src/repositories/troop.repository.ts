// @ts-nocheck - Type issues need investigation
import { Troop } from '../models/troop.model';
import { DeleteResult } from 'mongodb';
import { cacheService } from '../common/cache/cache.service';

/**
 * 부대 리포지토리
 * 국가별 부대 정보 관리
 */
class TroopRepository {
  /**
   * 세션별 부대 조회
   * @param sessionId - 세션 ID
   * @param filter - 추가 필터 조건
   * @returns 부대 목록
   */
  async findBySession(sessionId: string, filter?: any) {
    return Troop.find({ 
      session_id: sessionId, 
      ...filter 
    });
  }

  /**
   * 국가별 부대 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 부대 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return Troop.find({
      session_id: sessionId,
      'data.nation': nationId
    });
  }

  /**
   * 부대 번호로 조회
   * @param sessionId - 세션 ID
   * @param troopId - 부대 번호
   * @returns 부대 문서 또는 null
   */
  async findByTroopId(sessionId: string, troopId: number) {
    return Troop.findOne({
      session_id: sessionId,
      'data.troop_id': troopId
    });
  }

  /**
   * 조건으로 부대 한 개 조회
   * @param filter - 검색 조건
   * @returns 부대 문서 또는 null
   */
  async findOne(filter: any) {
    return Troop.findOne(filter);
  }

  /**
   * 조건으로 부대 한 개 조회 (alias)
   * @param filter - 검색 조건
   * @returns 부대 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return Troop.findOne(filter);
  }

  /**
   * 조건으로 부대 목록 조회
   * @param filter - 검색 조건
   * @returns 부대 목록
   */
  async findByFilter(filter: any) {
    return Troop.find(filter);
  }

  /**
   * 부대 생성
   * @param data - 부대 데이터
   * @returns 생성된 부대
   */
  async create(data: any) {
    const result = await Troop.create(data);
    
    // 캐시 무효화
    if (data.session_id) {
      await this._invalidateListCaches(data.session_id);
    }
    
    return result;
  }

  /**
   * 부대 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateMany(filter: any, update: any) {
    const result = await Troop.updateMany(filter, { $set: update });
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 부대 하나 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    const result = await Troop.updateOne(filter, { $set: update });
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 부대 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any): Promise<DeleteResult> {
    const result = await Troop.deleteMany(filter);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 부대 하나 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteByFilter(filter: any): Promise<DeleteResult> {
    const result = await Troop.deleteOne(filter);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 국가의 모든 부대 삭제
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 삭제 결과
   */
  async deleteByNation(sessionId: string, nationId: number): Promise<DeleteResult> {
    const result = await Troop.deleteMany({
      session_id: sessionId,
      'data.nation': nationId
    });
    
    // 캐시 무효화
    await this._invalidateListCaches(sessionId);
    
    return result;
  }

  /**
   * 세션의 모든 부대 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    const result = await Troop.deleteMany({ session_id: sessionId });
    
    // 캐시 무효화
    await this._invalidateListCaches(sessionId);
    
    return result;
  }

  /**
   * 목록 캐시 무효화 (내부 헬퍼)
   *
   * @param sessionId - 세션 ID
   */
  private async _invalidateListCaches(sessionId: string) {
    await cacheService.invalidate(
      [
        `troops:list:${sessionId}`,
      ],
      [
        `troops:nation:${sessionId}:*`,
      ]
    );
  }
}

/**
 * 부대 리포지토리 싱글톤 인스턴스
 */
export const troopRepository = new TroopRepository();
