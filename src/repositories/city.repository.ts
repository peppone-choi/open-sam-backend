// @ts-nocheck - Type issues need investigation
import { City } from '../models/city.model';
import { DeleteResult } from 'mongodb';
import { saveCity, getCity } from '../common/cache/model-cache.helper';

/**
 * 도시 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (model-cache.helper 사용)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class CityRepository {
  /**
   * ID로 도시 조회 (MongoDB _id)
   * @param cityId - 도시 ID
   * @returns 도시 문서 또는 null
   */
  async findById(cityId: string) {
    return City.findById(cityId);
  }

  /**
   * 도시 번호로 조회 (L1 → L2 → DB)
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @returns 도시 문서 또는 null
   */
  async findByCityNum(sessionId: string, cityNum: number) {
    // 캐시에서 먼저 조회
    const cached = await getCity(sessionId, cityNum);
    if (cached) {
      // plain object를 Mongoose Document로 변환
      const doc = new City(cached);
      doc.isNew = false; // 기존 문서임을 표시
      return doc;
    }
    
    // 캐시 미스 시 DB 조회
    const city = await City.findOne({ 
      session_id: sessionId, 
      city: cityNum 
    });
    
    // DB에서 조회한 결과를 캐시에 저장
    if (city) {
      await saveCity(sessionId, cityNum, city.toObject());
    }
    
    return city;
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
   * 도시 생성 (CQRS Command)
   * @param data - 도시 데이터
   * @returns 생성된 도시 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    const sessionId = data.session_id;
    const cityId = data.city || data.data?.city || data.cityId;
    
    if (sessionId && cityId) {
      // data.data 구조인 경우 평탄화
      const cityData = data.data ? { ...data.data, session_id: sessionId, city: cityId } : data;
      await saveCity(sessionId, cityId, cityData);
      return cityData;
    }
    
    throw new Error('City create requires session_id and city');
  }

  /**
   * 도시 업데이트 (CQRS Command)
   * @param cityId - 도시 ID (MongoDB _id)
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateById(cityId: string, update: any) {
    const existing = await City.findById(cityId).lean();
    
    if (!existing) {
      throw new Error(`City not found: ${cityId}`);
    }
    
    const sessionId = existing.session_id || update.session_id;
    const city = existing.city || update.city || update.cityId;
    
    if (sessionId && city) {
      const merged = { ...existing, ...update };
      await saveCity(sessionId, city, merged);
      return { modifiedCount: 1, matchedCount: 1 };
    }
    
    throw new Error('Cannot update City: missing session_id or city');
  }

  /**
   * 도시 번호로 업데이트 (CQRS Command)
   * @param sessionId - 세션 ID
   * @param cityNum - 도시 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateByCityNum(sessionId: string, cityNum: number, update: any) {
    // 기존 도시 데이터 조회
    const existing = await City.findOne({ 
      session_id: sessionId, 
      city: cityNum 
    }).lean();
    
    if (existing) {
      const merged = { ...existing, ...update };
      await saveCity(sessionId, cityNum, merged);
      return { modifiedCount: 1, matchedCount: 1 };
    }
    
    // 없으면 새로 생성
    const newData = { session_id: sessionId, city: cityNum, ...update };
    await saveCity(sessionId, cityNum, newData);
    return { modifiedCount: 1, matchedCount: 0, upsertedCount: 1 };
  }

  /**
   * 도시 삭제
   * @param cityId - 도시 ID
   * @returns 삭제 결과
   */
  async deleteById(cityId: string): Promise<DeleteResult> {
    return City.deleteOne({ _id: cityId });
  }

  /**
   * 세션의 모든 도시 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return City.deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 도시 조회
   * @param filter - 검색 조건
   * @returns 도시 목록
   */
  findByFilter(filter: any) {
    return City.find(filter);
  }

  /**
   * 조건으로 여러 개 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return City.updateMany(filter, { $set: update });
  }

  /**
   * 조건으로 여러 개 삭제
   * @param filter - 검색 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    return City.deleteMany(filter);
  }

  /**
   * 조건으로 도시 한 개 조회
   * @param filter - 검색 조건
   * @returns 도시 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return City.findOne(filter);
  }

  /**
   * 도시 수 조회
   * @param filter - 검색 조건
   * @returns 도시 수
   */
  async count(filter: any): Promise<number> {
    return City.countDocuments(filter);
  }

  /**
   * 조건으로 도시 하나 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return City.updateOne(filter, update);
  }

  /**
   * 조건으로 여러 도시 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return City.updateMany(filter, update);
  }
}

/**
 * 도시 리포지토리 싱글톤 인스턴스
 */
export const cityRepository = new CityRepository();
