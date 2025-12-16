// @ts-nocheck - Type issues need investigation
import { General, IGeneral } from '../models/general.model';
import { DeleteResult } from 'mongodb';
import { saveGeneral, getGeneral, getGeneralByNo, invalidateCache } from '../common/cache/model-cache.helper';
import { cacheService } from '../common/cache/cache.service';
import { cacheManager } from '../cache/CacheManager';
import { logger } from '../common/logger';

/**
 * 장수 리포지토리 (캐시 우선 패턴)
 *
 * 데몬 아키텍처 원칙:
 * - **게임 플레이**: L1 → L2 캐시만 사용 (DB 접근 금지!)
 * - **로그/통계**: DB 조회 허용
 * - **쓰기**: 캐시 업데이트 + sync-queue (데몬이 5초마다 DB 저장)
 *
 * Query: L1 → L2 → DB (캐시 미스 시만 DB 접근)
 * Command: 캐시 업데이트 → sync-queue → 데몬이 DB 저장
 */
class GeneralRepository {
  /**
   * ID로 장수 조회 (캐시 우선)
   *
   * @param generalId - 장수 ID (MongoDB _id)
   * @returns 장수 문서 또는 null
   */
  async findById(generalId: string): Promise<any> {
    // 먼저 캐시에서 찾기
    // generalId가 MongoDB _id인 경우, session_id와 no를 알 수 없으므로
    // DB 조회 후 캐시에 저장
    // IMPORTANT: .lean()을 제거하여 Mongoose 문서(메서드 포함)를 반환
    return cacheService.getOrLoad(
      `general:byMongoId:${generalId}`,
      async () => {
        const general = await General.findById(generalId);

        // DB에서 조회한 결과를 캐시에 저장 (session_id와 no 기준)
        if (general) {
          const sessionId = general.session_id;
          const no = general.no || general.data?.no;

          if (sessionId && no) {
            await saveGeneral(sessionId, no, general);
          }
        }

        return general;
      },
      60
    );
  }

  /**
   * 세션 내 모든 장수 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @returns 장수 목록
   */
  async findBySession(sessionId: string) {
    // 캐시에서 목록 조회 (목록 자체를 캐싱)
    return cacheService.getOrLoad(
      `generals:list:${sessionId}`,
      async () => {
        // 캐시 미스 시 DB에서 조회
        const generals = await General.find({ session_id: sessionId }).lean();

        // 개별 장수도 캐시에 저장
        for (const general of generals) {
          const no = general.no || general.data?.no;
          if (no) {
            await saveGeneral(sessionId, no, general);
          }
        }

        return generals;
      },
      60
    );
  }

  /**
   * 국가별 장수 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 장수 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return cacheService.getOrLoad(
      `generals:nation:${sessionId}:${nationId}`,
      async () => {
        // nation 필드는 최상위 또는 data 내부에 있을 수 있음
        const generals = await General.find({
          session_id: sessionId,
          $or: [
            { nation: nationId },
            { 'data.nation': nationId }
          ]
        }).lean();

        // 개별 장수도 캐시에 저장
        for (const general of generals) {
          const no = general.no || general.data?.no;
          if (no) {
            await saveGeneral(sessionId, no, general);
          }
        }

        return generals;
      },
      60
    );
  }

  /**
   * 도시별 장수 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns 장수 목록
   */
  async findByCity(sessionId: string, cityId: number) {
    return cacheService.getOrLoad(
      `generals:city:${sessionId}:${cityId}`,
      async () => {
        const generals = await General.find({
          session_id: sessionId,
          city: cityId
        }).lean();

        // 개별 장수도 캐시에 저장
        for (const general of generals) {
          const no = general.no || general.data?.no;
          if (no) {
            await saveGeneral(sessionId, no, general);
          }
        }

        return generals;
      },
      60
    );
  }

  /**
   * 도시 및 국가별 장수 조회
   *
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @param nationId - 국가 ID
   * @param fields - 반환할 필드 목록 (선택)
   * @returns 장수 목록
   */
  async findByCityAndNation(sessionId: string, cityId: number, nationId: number, fields?: string[]) {
    const generals = await General.find({
      session_id: sessionId,
      $or: [
        { city: cityId, nation: nationId },
        { 'data.city': cityId, 'data.nation': nationId }
      ]
    }).lean();

    // 필드 필터링
    if (fields && fields.length > 0) {
      return generals.map((g: any) => {
        const result: any = {};
        for (const field of fields) {
          result[field] = g[field] ?? g.data?.[field];
        }
        return result;
      });
    }

    return generals;
  }

  /**
   * 부대 멤버 조회 (현재 도시가 아닌 멤버들)
   *
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @param troopId - 부대 ID (부대장 장수 번호)
   * @param excludeCityId - 제외할 도시 ID
   * @returns 장수 목록
   */
  async findTroopMembers(sessionId: string, nationId: number, troopId: number, excludeCityId: number) {
    return General.find({
      session_id: sessionId,
      $or: [
        { nation: nationId, troop: troopId, city: { $ne: excludeCityId } },
        { 'data.nation': nationId, 'data.troop': troopId, 'data.city': { $ne: excludeCityId } }
      ]
    }).lean();
  }

  /**
   * 재야 장수 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @returns 재야 장수 목록
   */
  async findNeutral(sessionId: string) {
    return cacheService.getOrLoad(
      `generals:neutral:${sessionId}`,
      async () => {
        const generals = await General.find({
          session_id: sessionId,
          nation: 0
        }).lean();

        // 개별 장수도 캐시에 저장
        for (const general of generals) {
          const no = general.no || general.data?.no;
          if (no) {
            await saveGeneral(sessionId, no, general);
          }
        }

        return generals;
      },
      60
    );
  }

  /**
   * 장수 생성 (캐시 쓰기)
   *
   * @param data - 장수 데이터
   * @returns 생성된 장수 (캐시에만 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    const sessionId = data.session_id;
    const generalId = data.no || data.data?.no;

    if (sessionId && generalId) {
      // data 구조 정규화: 최상위 필드 + data 객체 모두 보존
      // 입력 데이터를 그대로 사용하되, 필수 필드만 보장
      const generalData = {
        ...data,  // 모든 필드 보존
        session_id: sessionId,
        no: generalId,
        data: data.data || {}  // data 객체 보존
      };

      // MongoDB에 직접 저장
      const newGeneral = new General(generalData);
      await newGeneral.save();
      
      // 캐시에 저장 (sync-queue에 자동 추가됨)
      await saveGeneral(sessionId, generalId, generalData);

      // 목록 캐시 무효화
      await this._invalidateListCaches(sessionId);

      return newGeneral;
    }

    throw new Error('General create requires session_id and no');
  }

  /**
   * 장수 업데이트 (캐시 쓰기)
   *
   * @param generalId - 장수 ID (MongoDB _id)
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (캐시에만 저장, DB는 데몬이 동기화)
   */
  async updateById(generalId: string, update: any) {
    // 기존 데이터 조회 (캐시 우선)
    const existing = await this.findById(generalId);

    if (!existing) {
      throw new Error(`General not found: ${generalId}`);
    }

    const sessionId = existing.session_id || update.session_id;
    const no = existing.data?.no || existing.no || update.no || update.data?.no;

    if (sessionId && no) {
      // 기존 데이터와 업데이트 병합 (data 필드는 deep merge)
      const merged = { 
        ...existing, 
        ...update,
        data: {
          ...existing.data,
          ...update.data
        }
      };

      // 캐시에 저장 (sync-queue에 자동 추가됨)
      await saveGeneral(sessionId, no, merged);

      // 목록 캐시 무효화
      await this._invalidateListCaches(sessionId);

      return { modifiedCount: 1, matchedCount: 1 };
    }

    throw new Error('Cannot update General: missing session_id or no');
  }

  /**
   * 장수 삭제 (DB 직접 접근 - 로그용)
   *
   * 주의: 게임 플레이 중에는 사용 금지!
   * 관리자 기능이나 서버 초기화에만 사용
   *
   * @param generalId - 장수 ID
   * @returns 삭제 결과
   */
  async deleteById(generalId: string): Promise<DeleteResult> {
    logger.warn('DB 직접 삭제 실행 (관리자 기능)', { generalId });

    // 캐시 무효화
    const general = await this.findById(generalId);
    if (general) {
      const sessionId = general.session_id;
      const no = general.no || general.data?.no;

      if (sessionId && no) {
        await invalidateCache('general', sessionId, no);
        await this._invalidateListCaches(sessionId);
      }
    }

    return General.deleteOne({ _id: generalId });
  }

  /**
   * 조건으로 장수 조회 (캐시 미스 시 DB)
   *
   * 주의: 복잡한 필터는 성능 이슈 가능
   * 가능하면 findBySession, findByNation 등 사용 권장
   *
   * @param filter - 검색 조건
   * @param projection - 필드 선택 (optional)
   * @returns 장수 목록
   */
  findByFilter(filter: any, projection?: string) {
    const query = General.find(filter);
    if (projection) {
      return query.select(projection).lean();
    }
    return query;
  }

  /**
   * 조건으로 장수 한 명 조회 (캐시 미스 시 DB)
   *
   * @param filter - 검색 조건
   * @returns 장수 문서 또는 null
   */
  async findOneByFilter(filter: any): Promise<any> {
    // 특정 패턴은 캐시 활용
    if (filter.session_id && filter.no) {
      return getGeneralByNo(filter.session_id, filter.no);
    }

    // 그 외는 DB 조회
    return General.findOne(filter).lean();
  }

  /**
   * 세션 ID와 장수 번호로 장수 조회 (캐시 우선)
   *
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호 (no)
   * @returns 장수 문서 또는 null
   */
  async findBySessionAndNo(sessionId: string, generalNo: number): Promise<any> {
    // 캐시 헬퍼 직접 사용
    return getGeneral(sessionId, generalNo);
  }

  /**
   * 세션 ID와 owner로 장수 조회 (캐시 미스 시 DB)
   *
   * @param sessionId - 세션 ID
   * @param owner - 소유자 ID
   * @returns 장수 문서 또는 null
   */
  async findBySessionAndOwner(sessionId: string, owner: string, additionalFilter?: any): Promise<any> {
    logger.info(`[GeneralRepository] findBySessionAndOwner 호출`, { sessionId, owner, additionalFilter });
    
    const result = await cacheService.getOrLoad(
      `general:owner:${sessionId}:${owner}`,
      async () => {
        logger.info(`[GeneralRepository] 캐시 미스, DB 조회`, { sessionId, owner });
        const general = await General.findOne({
          session_id: sessionId,
          owner: owner,
          ...additionalFilter
        }).lean();
        
        logger.info(`[GeneralRepository] DB 조회 결과`, { 
          sessionId, 
          owner, 
          found: !!general,
          generalNo: general?.no || general?.data?.no
        });
        
        // DB에서 조회한 장수를 개별 캐시에도 저장
        if (general) {
          const no = general.no || general.data?.no;
          if (no) {
            await saveGeneral(sessionId, no, general);
          }
        }
        
        return general;
      },
      360
    );
    
    return result;
  }

  /**
   * 세션 ID와 장수 번호로 업데이트 (캐시 쓰기)
   *
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateBySessionAndNo(sessionId: string, generalNo: number, update: any) {
    const existing = await this.findBySessionAndNo(sessionId, generalNo);

    if (!existing) {
      // 캐시에 없으면 DB에서 조회
      logger.warn(`[GeneralRepository] General not in cache, loading from DB: session=${sessionId}, no=${generalNo}`);
      const fromDB = await General.findOne({ 
        session_id: sessionId,
        $or: [
          { 'data.no': generalNo },
          { no: generalNo }
        ]
      }).lean();
      
      if (!fromDB) {
        // DB에도 없으면 새로 생성
        logger.warn(`[GeneralRepository] General not found in DB, creating: session=${sessionId}, no=${generalNo}`);
        const newGeneral = {
          session_id: sessionId,
          no: generalNo,
          data: { no: generalNo, ...update }
        };
        await saveGeneral(sessionId, generalNo, newGeneral);
        await this._invalidateListCaches(sessionId);
        return { modifiedCount: 1, matchedCount: 1 };
      }
      
      // DB에서 찾았으면 캐시에 저장
      const merged = { ...fromDB, ...update };
      await saveGeneral(sessionId, generalNo, merged);
      await this._invalidateListCaches(sessionId);
      return { modifiedCount: 1, matchedCount: 1 };
    }

    // 캐시 업데이트 (data 필드는 deep merge)
    const merged = { 
      ...existing, 
      ...update,
      data: {
        ...existing.data,
        ...update.data
      }
    };
    await saveGeneral(sessionId, generalNo, merged);

    // 목록 캐시 무효화
    await this._invalidateListCaches(sessionId);

    return { modifiedCount: 1, matchedCount: 1 };
  }

  /**
   * 여러 장수 업데이트 (조건으로)
   *
   * 주의: 게임 플레이 중에는 사용 주의!
   * 가능하면 개별 updateBySessionAndNo 사용 권장
   *
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    // 세션 ID가 있으면 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
      await invalidateCache('general', filter.session_id);
    }

    logger.debug('DB 직접 업데이트 실행 (배치 업데이트)', { filter });
    return General.updateMany(filter, { $set: update });
  }

  /**
   * 장수 하나 업데이트 (조건으로)
   *
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    // 세션 ID가 있으면 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
      await invalidateCache('general', filter.session_id);
    }

    logger.debug('DB 직접 업데이트 실행', { filter });
    return General.updateOne(filter, { $set: update });
  }

  /**
   * 장수 정보 업데이트 (save 방식)
   *
   * 주의: 게임 플레이 중에는 사용 금지!
   * updateBySessionAndNo 사용 권장
   *
   * @param general - 장수 문서
   * @returns 저장된 장수 문서
   */
  async save(general: any) {
    logger.warn('Mongoose save 사용 (비권장)', {
      session_id: general.session_id,
      no: general.no || general.data?.no
    });

    general.markModified('data');
    const saved = await general.save();

    // 캐시 무효화
    const sessionId = saved.session_id;
    const no = saved.no || saved.data?.no;
    if (sessionId && no) {
      await invalidateCache('general', sessionId, no);
      await this._invalidateListCaches(sessionId);
    }

    return saved;
  }

  /**
   * 장수 삭제 (조건으로)
   *
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteByFilter(filter: any): Promise<DeleteResult> {
    logger.warn('DB 직접 삭제 실행 (관리자 기능)', { filter });

    // 캐시 무효화
    if (filter.session_id) {
      await invalidateCache('general', filter.session_id);
      await this._invalidateListCaches(filter.session_id);
    }

    return General.deleteOne(filter);
  }

  /**
   * 국가 장수들의 필드를 곱셈으로 감소 (예: experience * 0.9)
   */
  async multiplyFieldByNation(sessionId: string, nationId: number, field: string, multiplier: number, additionalFilter: any = {}) {
    await this._invalidateListCaches(sessionId);
    
    return General.updateMany(
      {
        session_id: sessionId,
        nation: nationId,
        ...additionalFilter
      },
      [{ $set: { [field]: { $multiply: [`$${field}`, multiplier] } } }]
    );
  }

  /**
   * 국가 장수들의 필드를 증가 (예: betray + 1)
   */
  async incrementFieldByNation(sessionId: string, nationId: number, field: string, increment: number, excludeGeneral?: number) {
    await this._invalidateListCaches(sessionId);
    
    const filter: any = {
      session_id: sessionId,
      nation: nationId
    };
    if (excludeGeneral) {
      filter.no = { $ne: excludeGeneral };
    }
    
    return General.updateMany(
      filter,
      { $inc: { [field]: increment, [`data.${field}`]: increment } }
    );
  }

  /**
   * 조건으로 여러 개 삭제 (DB 직접 접근 - 관리자 기능)
   *
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    logger.warn('DB 직접 대량 삭제 실행 (관리자 기능)', { filter });

    // 캐시 무효화
    if (filter.session_id) {
      await invalidateCache('general', filter.session_id);
      await this._invalidateListCaches(filter.session_id);
    }

    return General.deleteMany(filter);
  }

  /**
   * 장수 일괄 생성 (DB 직접 접근 - 시나리오 리셋용)
   *
   * @param generals - 장수 데이터 배열
   * @returns 생성된 장수 목록
   */
  async bulkCreate(generals: any[]): Promise<any[]> {
    if (!generals || generals.length === 0) {
      return [];
    }

    const sessionId = generals[0]?.session_id;
    logger.info('DB 직접 일괄 생성 실행 (시나리오 리셋)', { 
      sessionId, 
      count: generals.length 
    });

    // DB에 직접 일괄 삽입
    const result = await General.insertMany(generals);

    // 캐시 무효화 (다음 조회 시 새로 로드됨)
    if (sessionId) {
      await invalidateCache('general', sessionId);
      await this._invalidateListCaches(sessionId);
    }

    return result;
  }

  /**
   * 장수 수 조회 (DB 허용 - 통계용)
   *
   * @param filter - 검색 조건
   * @returns 장수 수
   */
  async count(filter: any): Promise<number> {
    return General.countDocuments(filter);
  }

  /**
   * 페이지네이션으로 장수 조회 (DB 허용 - 관리 화면용)
   *
   * @param filter - 검색 조건
   * @param page - 페이지 번호 (1부터 시작)
   * @param limit - 페이지당 항목 수
   * @param sort - 정렬 조건
   * @returns 장수 목록
   */
  async findWithPagination(
    filter: any,
    page: number = 1,
    limit: number = 20,
    sort: any = { name: 1 }
  ) {
    return General.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  }

  /**
   * 조건에 맞는 장수 수 카운트 (DB 허용 - 통계용)
   *
   * @param filter - 검색 조건
   * @returns 카운트 수
   */
  async countByFilter(filter: any): Promise<number> {
    return General.countDocuments(filter);
  }

  /**
   * 국가 소속 장수들의 자원을 상한으로 제한
   * 
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @param resourceKey - 자원 키 (gold 또는 rice)
   * @param maxValue - 최대 값
   */
  async capResourcesByNation(sessionId: string, nationId: number, resourceKey: string, maxValue: number) {
    await this._invalidateListCaches(sessionId);
    
    // 해당 국가 소속이고 자원이 maxValue를 초과하는 장수들을 업데이트
    return General.updateMany(
      {
        session_id: sessionId,
        $or: [
          { nation: nationId, [resourceKey]: { $gt: maxValue } },
          { 'data.nation': nationId, [`data.${resourceKey}`]: { $gt: maxValue } }
        ]
      },
      {
        $set: {
          [resourceKey]: maxValue,
          [`data.${resourceKey}`]: maxValue
        }
      }
    );
  }

  /**
   * 목록 캐시 무효화 (내부 헬퍼)
   *
   * @param sessionId - 세션 ID
   */
  private async _invalidateListCaches(sessionId: string) {
    await invalidateCache('general', sessionId, undefined, { targets: ['lists'] });
  }
}


/**
 * 장수 리포지토리 싱글톤 인스턴스
 */
export const generalRepository = new GeneralRepository();
