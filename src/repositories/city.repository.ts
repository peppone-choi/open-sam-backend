// @ts-nocheck - Type issues need investigation
import { City } from '../models/city.model';
import { DeleteResult } from 'mongodb';
import { saveCity, getCity, invalidateCache } from '../common/cache/model-cache.helper';
import { cacheService } from '../common/cache/cache.service';
import { logger } from '../common/logger';

/**
 * 도시 리포지토리 (캐시 우선 패턴)
 *
 * 데몬 아키텍처 원칙:
 * - **게임 플레이**: L1 → L2 캐시만 사용 (DB 접근 금지!)
 * - **로그/통계**: DB 조회 허용
 * - **쓰기**: 캐시 업데이트 + sync-queue (데몬이 5초마다 DB 저장)
 *
 * Query: L1 → L2 → DB (캐시 미스 시만 DB 접근)
 * Command: 캐시 업데이트 → sync-queue → 데몬이 DB 저장
 */
class CityRepository {
  /**
   * ID로 도시 조회 (캐시 우선)
   *
   * @param cityId - 도시 ID (MongoDB _id)
   * @returns 도시 문서 또는 null
   */
  async findById(cityId: string) {
    return cacheService.getOrLoad(
      `city:byMongoId:${cityId}`,
      async () => {
        const city = await City.findById(cityId).lean();

        // DB에서 조회한 결과를 캐시에 저장 (session_id와 city 번호 기준)
        if (city) {
          const sessionId = city.session_id;
          const cityNum = city.city;

          if (sessionId && cityNum) {
            await saveCity(sessionId, cityNum, city);
          }
        }

        return city;
      },
      60
    );
  }

  /**
   * 도시 번호로 조회 (캐시 우선)
   *
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @returns 도시 문서 또는 null
   */
  async findByCityNum(sessionId: string, cityNum: number) {
    // 캐시 헬퍼 직접 사용
    return getCity(sessionId, cityNum);
  }

  /**
   * 세션 내 모든 도시 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @returns 도시 목록
   */
  async findBySession(sessionId: string) {
    return cacheService.getOrLoad(
      `cities:list:${sessionId}`,
      async () => {
        const cities = await City.find({ session_id: sessionId }).lean();

        // 개별 도시도 캐시에 저장
        for (const city of cities) {
          const cityNum = city.city;
          if (cityNum) {
            await saveCity(sessionId, cityNum, city);
          }
        }

        return cities;
      },
      60
    );
  }

  /**
   * 국가별 도시 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 도시 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return cacheService.getOrLoad(
      `cities:nation:${sessionId}:${nationId}`,
      async () => {
        const cities = await City.find({
          session_id: sessionId,
          nation: nationId
        }).lean();

        // 개별 도시도 캐시에 저장
        for (const city of cities) {
          const cityNum = city.city;
          if (cityNum) {
            await saveCity(sessionId, cityNum, city);
          }
        }

        return cities;
      },
      60
    );
  }

  /**
   * 무소속 도시 조회 (캐시 기반)
   *
   * @param sessionId - 세션 ID
   * @returns 중립 도시 목록
   */
  async findNeutral(sessionId: string) {
    return cacheService.getOrLoad(
      `cities:neutral:${sessionId}`,
      async () => {
        const cities = await City.find({
          session_id: sessionId,
          nation: 0
        }).lean();

        // 개별 도시도 캐시에 저장
        for (const city of cities) {
          const cityNum = city.city;
          if (cityNum) {
            await saveCity(sessionId, cityNum, city);
          }
        }

        return cities;
      },
      60
    );
  }

  /**
   * 도시 생성 (캐시 쓰기)
   *
   * @param data - 도시 데이터
   * @returns 생성된 도시 (캐시에만 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    const sessionId = data.session_id;
    const cityId = data.city || data.data?.city || data.cityId;

    if (sessionId && cityId) {
      // data.data 구조인 경우 평탄화
      const cityData = data.data ? { ...data.data, session_id: sessionId, city: cityId } : data;

      // 캐시에 저장 (sync-queue에 자동 추가됨)
      await saveCity(sessionId, cityId, cityData);

      // 목록 캐시 무효화
      await this._invalidateListCaches(sessionId);

      return cityData;
    }

    throw new Error('City create requires session_id and city');
  }

  /**
   * 도시 업데이트 (캐시 쓰기)
   *
   * @param cityId - 도시 ID (MongoDB _id)
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (캐시에만 저장, DB는 데몬이 동기화)
   */
  async updateById(cityId: string, update: any) {
    const existing = await this.findById(cityId);

    if (!existing) {
      throw new Error(`도시를 찾을 수 없습니다.: ${cityId}`);
    }

    const sessionId = existing.session_id || update.session_id;
    const city = existing.city || update.city || update.cityId;

    if (sessionId && city) {
      const merged = { ...existing, ...update };

      // 캐시에 저장 (sync-queue에 자동 추가됨)
      await saveCity(sessionId, city, merged);

      // 목록 캐시 무효화
      await this._invalidateListCaches(sessionId);

      return { modifiedCount: 1, matchedCount: 1 };
    }

    throw new Error('Cannot update City: missing session_id or city');
  }

  /**
   * 도시 번호로 업데이트 (캐시 쓰기)
   *
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateByCityNum(sessionId: string, cityNum: number, update: any) {
    // 기존 도시 데이터 조회 (캐시 우선)
    const existing = await this.findByCityNum(sessionId, cityNum);

    if (existing) {
      const merged = { ...existing, ...update };
      await saveCity(sessionId, cityNum, merged);

      // 목록 캐시 무효화
      await this._invalidateListCaches(sessionId);

      return { modifiedCount: 1, matchedCount: 1 };
    }

    // 없으면 새로 생성
    const newData = { session_id: sessionId, city: cityNum, ...update };
    await saveCity(sessionId, cityNum, newData);

    // 목록 캐시 무효화
    await this._invalidateListCaches(sessionId);

    return { modifiedCount: 1, matchedCount: 0, upsertedCount: 1 };
  }

  /**
   * 도시 삭제 (DB 직접 접근 - 로그용)
   *
   * 주의: 게임 플레이 중에는 사용 금지!
   * 관리자 기능이나 서버 초기화에만 사용
   *
   * @param cityId - 도시 ID
   * @returns 삭제 결과
   */
  async deleteById(cityId: string): Promise<DeleteResult> {
    logger.warn('DB 직접 삭제 실행 (관리자 기능)', { cityId });

    // 캐시 무효화
    const city = await this.findById(cityId);
    if (city) {
      const sessionId = city.session_id;
      const cityNum = city.city;

      if (sessionId && cityNum) {
        await invalidateCache('city', sessionId, cityNum);
        await this._invalidateListCaches(sessionId);
      }
    }

    return City.deleteOne({ _id: cityId });
  }

  /**
   * 세션의 모든 도시 삭제 (DB 직접 접근 - 관리자 기능)
   *
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    logger.warn('DB 직접 대량 삭제 실행 (관리자 기능)', { sessionId });

    // 캐시 무효화
    await invalidateCache('city', sessionId);
    await this._invalidateListCaches(sessionId);

    return City.deleteMany({ session_id: sessionId });
  }

  /**
   * 도시 일괄 생성 (DB 직접 접근 - 시나리오 리셋용)
   *
   * @param cities - 도시 데이터 배열
   * @returns 생성된 도시 목록
   */
  async bulkCreate(cities: any[]): Promise<any[]> {
    if (!cities || cities.length === 0) {
      return [];
    }

    const sessionId = cities[0]?.session_id;
    logger.info('DB 직접 일괄 생성 실행 (시나리오 리셋)', { 
      sessionId, 
      count: cities.length 
    });

    // DB에 직접 일괄 삽입
    const result = await City.insertMany(cities);

    // 캐시 무효화 (다음 조회 시 새로 로드됨)
    if (sessionId) {
      await invalidateCache('city', sessionId);
      await this._invalidateListCaches(sessionId);
    }

    return result;
  }

  /**
   * 조건으로 도시 조회 (캐시 미스 시 DB)
   *
   * @param filter - 검색 조건
   * @returns 도시 목록
   */
  findByFilter(filter: any) {
    // 특정 패턴은 캐시 활용
    if (filter.session_id && !filter.nation && !filter.city) {
      return this.findBySession(filter.session_id);
    }

    if (filter.session_id && filter.nation !== undefined) {
      return this.findByNation(filter.session_id, filter.nation);
    }

    // 그 외는 DB 조회
    return City.find(filter).lean();
  }

  /**
   * 조건으로 여러 개 업데이트 (DB 직접 접근)
   *
   * 주의: 게임 플레이 중에는 사용 주의!
   *
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
      await invalidateCache('city', filter.session_id);
    }

    logger.warn('DB 직접 대량 업데이트 실행 (관리자 기능)', { filter });
    return City.updateMany(filter, { $set: update });
  }

  /**
   * 조건으로 여러 개 삭제 (DB 직접 접근)
   *
   * @param filter - 검색 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    logger.warn('DB 직접 대량 삭제 실행 (관리자 기능)', { filter });

    // 캐시 무효화
    if (filter.session_id) {
      await invalidateCache('city', filter.session_id);
      await this._invalidateListCaches(filter.session_id);
    }

    return City.deleteMany(filter);
  }

  /**
   * 조건으로 도시 한 개 조회 (캐시 미스 시 DB)
   *
   * @param filter - 검색 조건
   * @returns 도시 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    // 특정 패턴은 캐시 활용
    if (filter.session_id && filter.city) {
      return getCity(filter.session_id, filter.city);
    }

    // 그 외는 DB 조회
    return City.findOne(filter).lean();
  }

  /**
   * 도시 수 조회 (DB 허용 - 통계용)
   *
   * @param filter - 검색 조건
   * @returns 도시 수
   */
  async count(filter: any): Promise<number> {
    return City.countDocuments(filter);
  }

  /**
   * 조건으로 도시 하나 업데이트 (DB 직접 접근)
   *
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    // 캐시 무효화
    if (filter.session_id) {
      await this._invalidateListCaches(filter.session_id);
      await invalidateCache('city', filter.session_id);
    }

    logger.warn('DB 직접 업데이트 실행', { filter });
    return City.updateOne(filter, update);
  }

  /**
   * 목록 캐시 무효화 (내부 헬퍼)
   *
   * @param sessionId - 세션 ID
   */
  private async _invalidateListCaches(sessionId: string) {
    await cacheService.invalidate(
      [
        `cities:list:${sessionId}`,
      ],
      [
        `cities:nation:${sessionId}:*`,
        `cities:neutral:${sessionId}`,
      ]
    );
  }
}

/**
 * 도시 리포지토리 싱글톤 인스턴스
 */
export const cityRepository = new CityRepository();
