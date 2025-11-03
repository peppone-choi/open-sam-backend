import { Nation } from '../models/nation.model';
import { DeleteResult } from 'mongodb';
import { saveNation } from '../common/cache/model-cache.helper';

/**
 * 국가 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (model-cache.helper 사용)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class NationRepository {
  /**
   * ID로 국가 조회
   * @param nationId - 국가 ID
   * @returns 국가 문서 또는 null
   */
  async findById(nationId: string) {
    return (Nation as any).findById(nationId);
  }

  /**
   * 국가 번호로 조회
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @returns 국가 문서 또는 null
   */
  async findByNationNum(sessionId: string, nationNum: number) {
    return (Nation as any).findOne({ 
      session_id: sessionId, 
      nation: nationNum 
    });
  }

  /**
   * 세션 내 모든 국가 조회
   * @param sessionId - 세션 ID
   * @returns 국가 목록
   */
  async findBySession(sessionId: string) {
    return (Nation as any).find({ session_id: sessionId });
  }

  /**
   * 활성 국가 조회 (멸망하지 않은 국가)
   * @param sessionId - 세션 ID
   * @returns 활성 국가 목록
   */
  async findActive(sessionId: string) {
    return (Nation as any).find({ 
      session_id: sessionId,
      level: { $gt: 0 }
    });
  }

  /**
   * 국가 생성 (CQRS Command)
   * @param data - 국가 데이터
   * @returns 생성된 국가 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async create(data: any) {
    const sessionId = data.session_id;
    const nationId = data.nation || data.nationId;
    
    if (sessionId && nationId) {
      await saveNation(sessionId, nationId, data);
      return data;
    }
    
    throw new Error('Nation create requires session_id and nation');
  }

  /**
   * 국가 업데이트 (CQRS Command)
   * @param nationId - 국가 ID (MongoDB _id)
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateById(nationId: string, update: any) {
    const existing = await (Nation as any).findById(nationId).lean();
    
    if (!existing) {
      throw new Error(`Nation not found: ${nationId}`);
    }
    
    const sessionId = existing.session_id || update.session_id;
    const nation = existing.nation || update.nation || update.nationId;
    
    if (sessionId && nation) {
      const merged = { ...existing, ...update };
      await saveNation(sessionId, nation, merged);
      return { modifiedCount: 1, matchedCount: 1 };
    }
    
    throw new Error('Cannot update Nation: missing session_id or nation');
  }

  /**
   * 국가 번호로 업데이트 (CQRS Command)
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과 (Redis에만 저장, DB는 데몬이 동기화)
   */
  async updateByNationNum(sessionId: string, nationNum: number, update: any) {
    // 기존 국가 데이터 조회
    const existing = await (Nation as any).findOne({ 
      session_id: sessionId, 
      nation: nationNum 
    }).lean();
    
    if (existing) {
      const merged = { ...existing, ...update };
      await saveNation(sessionId, nationNum, merged);
      return { modifiedCount: 1, matchedCount: 1 };
    }
    
    // 없으면 새로 생성
    const newData = { session_id: sessionId, nation: nationNum, ...update };
    await saveNation(sessionId, nationNum, newData);
    return { modifiedCount: 1, matchedCount: 0, upsertedCount: 1 };
  }

  /**
   * 국가 삭제
   * @param nationId - 국가 ID
   * @returns 삭제 결과
   */
  async deleteById(nationId: string): Promise<DeleteResult> {
    return (Nation as any).deleteOne({ _id: nationId });
  }

  /**
   * 세션의 모든 국가 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return (Nation as any).deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 국가 조회
   * @param filter - 검색 조건
   * @returns 국가 목록
   */
  async findByFilter(filter: any) {
    return (Nation as any).find(filter);
  }

  /**
   * 국가 수 조회
   * @param filter - 검색 조건
   * @returns 국가 수
   */
  async count(filter: any): Promise<number> {
    return (Nation as any).countDocuments(filter);
  }
}

/**
 * 국가 리포지토리 싱글톤 인스턴스
 */
export const nationRepository = new NationRepository();
