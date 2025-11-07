import { General } from '../models/general.model';
import { DeleteResult } from 'mongodb';
import { saveGeneral, getGeneral, getGeneralByNo } from '../common/cache/model-cache.helper';

/**
 * 장수 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (model-cache.helper 사용)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class GeneralRepository {
  /**
   * ID로 장수 조회 (MongoDB _id)
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
   * 장수 생성 (CQRS Command)
   * @param data - 장수 데이터
   * @returns 생성된 장수 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    const sessionId = data.session_id;
    const generalId = data.no || data.data?.no;
    
    if (sessionId && generalId) {
      await saveGeneral(sessionId, generalId, data);
      return data;
    }
    
    // session_id나 no가 없으면 예외 (일반적으로는 발생하지 않음)
    throw new Error('General create requires session_id and no');
  }

  /**
   * 장수 업데이트 (CQRS Command)
   * @param generalId - 장수 ID (MongoDB _id)
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateById(generalId: string, update: any) {
    // MongoDB _id로 조회해서 session_id와 no 확인
    const existing = await General.findById(generalId).lean();
    
    if (!existing) {
      throw new Error(`General not found: ${generalId}`);
    }
    
    const sessionId = existing.session_id || update.session_id;
    const no = existing.data?.no || existing.no || update.no || update.data?.no;
    
    if (sessionId && no) {
      // 기존 데이터와 업데이트 병합
      const merged = { ...existing, ...update };
      await saveGeneral(sessionId, no, merged);
      
      return { modifiedCount: 1, matchedCount: 1 };
    }
    
    throw new Error('Cannot update General: missing session_id or no');
  }

  /**
   * 장수 삭제
   * @param generalId - 장수 ID
   * @returns 삭제 결과
   */
  async deleteById(generalId: string): Promise<DeleteResult> {
    return General.deleteOne({ _id: generalId });
  }

  /**
   * 조건으로 장수 조회
   * @param filter - 검색 조건
   * @param projection - 필드 선택 (optional)
   * @returns 장수 목록
   */
  async findByFilter(filter: any, projection?: string) {
    const query = General.find(filter);
    if (projection) {
      return query.select(projection).lean();
    }
    return query;
  }

  /**
   * 조건으로 장수 한 명 조회
   * @param filter - 검색 조건
   * @returns 장수 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return General.findOne(filter);
  }

  /**
   * 세션 ID와 장수 번호로 장수 조회 (L1 → L2 → DB)
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호 (data.no)
   * @returns 장수 문서 또는 null
   */
  async findBySessionAndNo(sessionId: string, generalNo: number) {
    // 캐시에서 먼저 조회
    const cached = await getGeneral(sessionId, generalNo);
    if (cached) {
      // plain object를 Mongoose Document로 변환
      const doc = new General(cached);
      doc.isNew = false; // 기존 문서임을 표시
      return doc;
    }
    
    // 캐시 미스 시 DB 조회
    const general = await General.findOne({
      session_id: sessionId,
      'data.no': generalNo
    });
    
    // DB에서 조회한 결과를 캐시에 저장
    if (general) {
      await saveGeneral(sessionId, generalNo, general.toObject());
    }
    
    return general;
  }

  /**
   * 세션 ID와 owner로 장수 조회
   * @param sessionId - 세션 ID
   * @param owner - 소유자 ID
   * @returns 장수 문서 또는 null
   */
  async findBySessionAndOwner(sessionId: string, owner: string, additionalFilter?: any) {
    return General.findOne({
      session_id: sessionId,
      owner: owner,
      ...additionalFilter
    });
  }

  /**
   * 세션 ID와 장수 번호로 업데이트
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateBySessionAndNo(sessionId: string, generalNo: number, update: any) {
    const existing = await this.findBySessionAndNo(sessionId, generalNo);
    
    if (!existing) {
      throw new Error(`General not found: session=${sessionId}, no=${generalNo}`);
    }
    
    // 캐시 업데이트
    const merged = { ...existing, ...update };
    await saveGeneral(sessionId, generalNo, merged);
    
    return { modifiedCount: 1, matchedCount: 1 };
  }

  /**
   * 여러 장수 업데이트 (조건으로)
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return General.updateMany(filter, { $set: update });
  }

  /**
   * 장수 하나 업데이트 (조건으로)
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return General.updateOne(filter, { $set: update });
  }

  /**
   * 장수 정보 업데이트 (save 방식)
   * @param general - 장수 문서
   * @returns 저장된 장수 문서
   */
  async save(general: any) {
    general.markModified('data');
    return await general.save();
  }

  /**
   * 장수 삭제 (조건으로)
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteByFilter(filter: any): Promise<DeleteResult> {
    return General.deleteOne(filter);
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
   * 페이지네이션으로 장수 조회
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
      .limit(limit);
  }

  /**
   * 조건에 맞는 장수 수 카운트
   * @param filter - 검색 조건
   * @returns 카운트 수
   */
  async countByFilter(filter: any): Promise<number> {
    return General.countDocuments(filter);
  }
}

/**
 * 장수 리포지토리 싱글톤 인스턴스
 */
export const generalRepository = new GeneralRepository();
