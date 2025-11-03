import { General } from '../models/general.model';
import { DeleteResult } from 'mongodb';
import { saveGeneral } from '../common/cache/model-cache.helper';

/**
 * 장수 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (model-cache.helper 사용)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class GeneralRepository {
  /**
   * ID로 장수 조회
   * @param generalId - 장수 ID
   * @returns 장수 문서 또는 null
   */
  async findById(generalId: string) {
    return (General as any).findById(generalId);
  }

  /**
   * 세션 내 모든 장수 조회
   * @param sessionId - 세션 ID
   * @returns 장수 목록
   */
  async findBySession(sessionId: string) {
    return (General as any).find({ session_id: sessionId });
  }

  /**
   * 국가별 장수 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 장수 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return (General as any).find({ 
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
    return (General as any).find({ 
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
    return (General as any).find({ 
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
    const existing = await (General as any).findById(generalId).lean();
    
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
    return (General as any).deleteOne({ _id: generalId });
  }

  /**
   * 조건으로 장수 조회
   * @param filter - 검색 조건
   * @returns 장수 목록
   */
  async findByFilter(filter: any) {
    return (General as any).find(filter);
  }

  /**
   * 장수 수 조회
   * @param filter - 검색 조건
   * @returns 장수 수
   */
  async count(filter: any): Promise<number> {
    return (General as any).countDocuments(filter);
  }

  /**
   * 페이지네이션 조회
   * @param filter - 검색 조건
   * @param page - 페이지 번호
   * @param limit - 페이지당 개수
   * @param sort - 정렬 조건
   * @returns 장수 목록
   */
  async findPaginated(
    filter: any,
    page: number = 1,
    limit: number = 20,
    sort: any = { name: 1 }
  ) {
    return (General as any).find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
  }
}

/**
 * 장수 리포지토리 싱글톤 인스턴스
 */
export const generalRepository = new GeneralRepository();
