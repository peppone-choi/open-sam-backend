// @ts-nocheck - Type issues need investigation
import { NationTurn } from '../models/nation_turn.model';
import { cacheService } from '../common/cache/cache.service';

/**
 * NationTurn 리포지토리
 */
class NationTurnRepository {
  /**
   * 조건으로 조회
   */
  findByFilter(filter: any) {
    return NationTurn.find(filter);
  }

  /**
   * 세션으로 조회
   */
  findBySession(sessionId: string, filter: any = {}, sort?: any) {
    const query = NationTurn.find({ session_id: sessionId, ...filter });
    if (sort) {
      query.sort(sort);
    }
    return query;
  }

  findByNation(sessionId: string, nationId: number, sort?: any) {
    return this.findBySession(sessionId, { 'data.nation_id': nationId }, sort);
  }

  /**
   * 조건으로 한 개 조회
   */
  async findOneByFilter(filter: any) {
    return NationTurn.findOne(filter);
  }

  /**
   * ID로 조회
   */
  async findById(id: string) {
    return NationTurn.findById(id);
  }

  /**
   * 생성
   */
  async create(data: any) {
    const result = await NationTurn.create(data);
    
    // 캐시 무효화
    if (data.session_id) {
      await this._invalidateListCaches(data.session_id);
    }
    
    return result;
  }

  /**
   * 업데이트
   */
  async updateOne(filter: any, update: any) {
    const result = await NationTurn.updateOne(filter, update);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 여러 개 업데이트
   */
  async updateMany(filter: any, update: any) {
    const result = await NationTurn.updateMany(filter, update);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 업데이트 또는 생성 (upsert)
   */
  async findOneAndUpdate(filter: any, update: any, options?: any) {
    const result = await NationTurn.findOneAndUpdate(filter, update, options);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 삭제
   */
  async deleteOne(filter: any) {
    const result = await NationTurn.deleteOne(filter);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 여러 개 삭제
   */
  async deleteMany(filter: any) {
    const result = await NationTurn.deleteMany(filter);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 개수 세기
   */
  async count(filter: any): Promise<number> {
    return NationTurn.countDocuments(filter);
  }

  /**
   * 벌크 작업
   */
  async bulkWrite(operations: any[]) {
    const result = await NationTurn.bulkWrite(operations);
    
    // 벌크 작업은 여러 세션에 걸칠 수 있으므로, 개별 세션 무효화가 어려움
    // 대신 operations에서 session_id 추출
    const sessionIds = new Set<string>();
    for (const op of operations) {
      const filter = op.updateOne?.filter || op.deleteOne?.filter || op.insertOne?.document;
      if (filter?.session_id) {
        sessionIds.add(filter.session_id);
      }
    }
    
    for (const sessionId of sessionIds) {
      await this._invalidateListCaches(sessionId);
    }
    
    return result;
  }

  /**
   * 조건으로 여러 개 삭제 (alias)
   */
  async deleteManyByFilter(filter: any) {
    const result = await NationTurn.deleteMany(filter);
    
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
    }
    
    return result;
  }

  /**
   * 세션의 모든 국가턴 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    const result = await NationTurn.deleteMany({ session_id: sessionId });
    
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
        `nationTurns:list:${sessionId}`,
      ],
      []
    );
  }
}

/**
 * NationTurn 리포지토리 싱글톤
 */

export const nationTurnRepository = new NationTurnRepository();
