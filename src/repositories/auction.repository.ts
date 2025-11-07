import { Auction } from '../models/auction.model';

/**
 * Auction 리포지토리
 * 경매 데이터 관리 (캐시 미사용 - 실시간 데이터)
 */
class AuctionRepositoryClass {
  /**
   * 조건으로 경매 조회
   * @param filter - 검색 조건
   * @returns 경매 목록
   */
  async findByFilter(filter: any) {
    return Auction.find(filter);
  }

  /**
   * 하나의 경매 조회
   * @param filter - 검색 조건
   * @returns 경매 문서 또는 null
   */
  async findOne(filter: any) {
    return Auction.findOne(filter);
  }

  /**
   * 조건으로 하나의 경매 조회 (alias for findOne)
   * @param filter - 검색 조건
   * @returns 경매 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return Auction.findOne(filter);
  }

  /**
   * ID로 경매 조회
   * @param id - 경매 ID
   * @returns 경매 문서 또는 null
   */
  async findById(id: string) {
    return Auction.findById(id);
  }

  /**
   * 세션별 경매 조회
   * @param sessionId - 세션 ID
   * @param additionalFilter - 추가 필터 (optional)
   * @returns 경매 목록
   */
  async findBySession(sessionId: string, additionalFilter: any = {}) {
    return Auction.find({ session_id: sessionId, ...additionalFilter });
  }

  /**
   * 경매 생성
   * @param data - 경매 데이터
   * @returns 생성된 경매
   */
  async create(data: any) {
    return Auction.create(data);
  }

  /**
   * 경매 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOne(filter: any, update: any) {
    return Auction.updateOne(filter, update);
  }

  /**
   * 여러 경매 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateMany(filter: any, update: any) {
    return Auction.updateMany(filter, update);
  }

  /**
   * 경매 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteOne(filter: any) {
    return Auction.deleteOne(filter);
  }

  /**
   * 여러 경매 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any) {
    return Auction.deleteMany(filter);
  }

  /**
   * 경매 수 조회
   * @param filter - 검색 조건
   * @returns 경매 수
   */
  async count(filter: any): Promise<number> {
    return Auction.countDocuments(filter);
  }
}

/**
 * Auction 리포지토리 싱글톤 인스턴스
 */
export const auctionRepository = new AuctionRepositoryClass();

// Legacy: 이전 버전 호환성을 위한 static class export
export class AuctionRepository {
  static async findBySession(sessionId: string, model: any, filter: any = {}) {
    return await model.find({ session_id: sessionId, ...filter });
  }
  
  static async create(sessionId: string, model: any, data: any) {
    return await model.create({ session_id: sessionId, ...data });
  }
  
  static async update(sessionId: string, model: any, filter: any, update: any) {
    return await model.updateMany(
      { session_id: sessionId, ...filter },
      { $set: update }
    );
  }
  
  static async delete(sessionId: string, model: any, filter: any) {
    return await model.deleteMany({ session_id: sessionId, ...filter });
  }
}
