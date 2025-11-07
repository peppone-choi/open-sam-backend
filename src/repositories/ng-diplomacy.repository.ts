import { NgDiplomacy } from '../models/ng_diplomacy.model';
import { DeleteResult } from 'mongodb';

/**
 * NgDiplomacy 리포지토리
 * 외교 서한 및 협상 관리
 */
class NgDiplomacyRepository {
  /**
   * 외교 서한 생성
   * @param data - 서한 데이터
   * @returns 생성된 서한
   */
  async create(data: any) {
    return NgDiplomacy.create(data);
  }

  /**
   * 서한 번호로 조회
   * @param sessionId - 세션 ID
   * @param letterNo - 서한 번호
   * @returns 서한 문서 또는 null
   */
  async findByLetterNo(sessionId: string, letterNo: number | string) {
    return NgDiplomacy.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': letterNo },
        { _id: letterNo }
      ]
    });
  }

  /**
   * 세션별 서한 조회
   * @param sessionId - 세션 ID
   * @param filter - 추가 필터 조건
   * @returns 서한 목록
   */
  async findBySession(sessionId: string, filter?: any) {
    return NgDiplomacy.find({ 
      session_id: sessionId, 
      ...filter 
    });
  }

  /**
   * 국가별 수신 서한 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 서한 목록
   */
  async findByDestNation(sessionId: string, nationId: number) {
    return NgDiplomacy.find({
      session_id: sessionId,
      $or: [
        { 'data.destNationId': nationId },
        { 'dest_nation_id': nationId }
      ]
    });
  }

  /**
   * 국가별 발신 서한 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 서한 목록
   */
  async findBySrcNation(sessionId: string, nationId: number) {
    return NgDiplomacy.find({
      session_id: sessionId,
      $or: [
        { 'data.srcNationId': nationId },
        { 'src_nation_id': nationId }
      ]
    });
  }

  /**
   * 조건으로 서한 한 개 조회
   * @param filter - 검색 조건
   * @returns 서한 문서 또는 null
   */
  async findOne(filter: any) {
    return NgDiplomacy.findOne(filter);
  }

  /**
   * 서한 업데이트
   * @param letterNo - 서한 번호 또는 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트된 서한
   */
  async updateOne(letterNo: string, update: any) {
    return NgDiplomacy.updateOne(
      {
        $or: [
          { 'data.no': letterNo },
          { _id: letterNo }
        ]
      },
      { $set: update }
    );
  }

  /**
   * ID로 서한 업데이트
   * @param id - MongoDB _id
   * @param update - 업데이트할 데이터
   * @returns 업데이트된 서한
   */
  async updateById(id: string, update: any) {
    return NgDiplomacy.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
  }

  /**
   * 여러 서한 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateMany(filter: any, update: any) {
    return NgDiplomacy.updateMany(filter, { $set: update });
  }

  /**
   * 서한 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any): Promise<DeleteResult> {
    return NgDiplomacy.deleteMany(filter);
  }

  /**
   * 세션의 모든 서한 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return NgDiplomacy.deleteMany({ session_id: sessionId });
  }
}

/**
 * NgDiplomacy 리포지토리 싱글톤 인스턴스
 */
export const ngDiplomacyRepository = new NgDiplomacyRepository();
