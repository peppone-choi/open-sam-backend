// @ts-nocheck - Type issues need investigation
import { Nation } from '../models/nation.model';
import { DeleteResult } from 'mongodb';
import { saveNation, getNation } from '../common/cache/model-cache.helper';

/**
 * 국가 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (model-cache.helper 사용)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class NationRepository {
  /**
   * ID로 국가 조회 (MongoDB _id)
   * @param nationId - 국가 ID
   * @returns 국가 문서 또는 null
   */
  async findById(nationId: string) {
    return Nation.findById(nationId);
  }

  /**
   * 국가 번호로 조회 (L1 → L2 → DB)
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @returns 국가 문서 또는 null
   */
  async findByNationNum(sessionId: string, nationNum: number) {
    // 캐시에서 먼저 조회
    const cached = await getNation(sessionId, nationNum);
    if (cached) {
      // plain object를 Mongoose Document로 변환
      const doc = new Nation(cached);
      doc.isNew = false; // 기존 문서임을 표시
      return doc;
    }
    
    // 캐시 미스 시 DB 조회
    const nation = await Nation.findOne({ 
      session_id: sessionId, 
      nation: nationNum 
    });
    
    // DB에서 조회한 결과를 캐시에 저장
    if (nation) {
      await saveNation(sessionId, nationNum, nation.toObject());
    }
    
    return nation;
  }

  /**
   * 세션 내 모든 국가 조회
   * @param sessionId - 세션 ID
   * @returns 국가 목록
   */
  async findBySession(sessionId: string) {
    return Nation.find({ session_id: sessionId });
  }

  /**
   * 활성 국가 조회 (멸망하지 않은 국가)
   * @param sessionId - 세션 ID
   * @returns 활성 국가 목록
   */
  async findActive(sessionId: string) {
    return Nation.find({ 
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
    const nationId = data.nation || data.data?.nation || data.nationId;
    
    if (sessionId && nationId) {
      // data.data 구조인 경우 평탄화
      const nationData = data.data ? { ...data.data, session_id: sessionId } : data;
      await saveNation(sessionId, nationId, nationData);
      return nationData;
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
    const existing = await Nation.findById(nationId).lean();
    
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
    const existing = await Nation.findOne({ 
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
    return Nation.deleteOne({ _id: nationId });
  }

  /**
   * 세션의 모든 국가 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Nation.deleteMany({ session_id: sessionId });
  }

  /**
   * 조건으로 국가 조회
   * @param filter - 검색 조건
   * @returns 국가 목록
   */
  findByFilter(filter: any) {
    return Nation.find(filter);
  }

  /**
   * 조건으로 한 개 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return Nation.updateOne(filter, { $set: update });
  }

  /**
   * 조건으로 여러 개 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return Nation.updateMany(filter, { $set: update });
  }

  /**
   * 조건으로 여러 개 삭제
   * @param filter - 검색 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    return Nation.deleteMany(filter);
  }

  /**
   * 조건에 맞는 국가 수 조회
   * @param filter - 검색 조건
   * @returns 국가 수
   */
  async countByFilter(filter: any): Promise<number> {
    return Nation.countDocuments(filter);
  }

  /**
   * 조건으로 국가 한 개 조회
   * @param filter - 검색 조건
   * @returns 국가 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return Nation.findOne(filter);
  }

  /**
   * 국가 수 조회
   * @param filter - 검색 조건
   * @returns 국가 수
   */
  async count(filter: any): Promise<number> {
    return Nation.countDocuments(filter);
  }

  /**
   * 국가의 장수 수 증가/감소 (gennum)
   * @param sessionId - 세션 ID
   * @param nationNum - 국가 번호
   * @param increment - 증가량 (음수면 감소)
   * @returns 업데이트 결과
   */
  async incrementGennum(sessionId: string, nationNum: number, increment: number) {
    return Nation.updateOne(
      {
        session_id: sessionId,
        'data.nation': nationNum
      },
      {
        $inc: {
          'data.gennum': increment
        }
      }
    );
  }
}

/**
 * 국가 리포지토리 싱글톤 인스턴스
 */
export const nationRepository = new NationRepository();
