// @ts-nocheck - Type issues need investigation
import { KVStorage } from '../models/kv-storage.model';

/**
 * KVStorage 리포지토리
 * Key-Value 저장소 (캐시 미사용 - 실시간 데이터)
 */
class KVStorageRepository {
  /**
   * 키로 조회
   * @param sessionId - 세션 ID
   * @param key - 키
   * @returns KVStorage 문서 또는 null
   */
  async findByKey(sessionId: string, key: string) {
    return KVStorage.findOne({ session_id: sessionId, key });
  }

  /**
   * storage_id로 조회
   * @param sessionId - 세션 ID
   * @param storageId - Storage ID
   * @returns KVStorage 문서 또는 null
   */
  async findByStorageId(sessionId: string, storageId: string) {
    return KVStorage.findOne({ session_id: sessionId, storage_id: storageId });
  }

  /**
   * 조건으로 조회
   * @param filter - 검색 조건
   * @returns KVStorage 문서 또는 null
   */
  async findOne(filter: any) {
    return KVStorage.findOne(filter);
  }

  /**
   * 조건으로 조회 (alias)
   * @param filter - 검색 조건
   * @returns KVStorage 문서 또는 null
   */
  async findOneByFilter(filter: any) {
    return KVStorage.findOne(filter);
  }

  /**
   * 조건으로 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOneByFilter(filter: any, update: any) {
    return KVStorage.updateOne(filter, { $set: update });
  }

  /**
   * 여러 문서 조회
   * @param filter - 검색 조건
   * @returns KVStorage 문서 목록
   */
  async find(filter: any) {
    return KVStorage.find(filter);
  }

  /**
   * 생성
   * @param data - KVStorage 데이터
   * @returns 생성된 문서
   */
  async create(data: any) {
    return KVStorage.create(data);
  }

  /**
   * 업데이트 (upsert)
   * @param filter - 검색 조건
   * @param data - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async upsert(filter: any, data: any) {
    return KVStorage.findOneAndUpdate(
      filter,
      { $set: data },
      { upsert: true, new: true }
    );
  }

  /**
   * 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateOne(filter: any, update: any) {
    return KVStorage.updateOne(filter, update);
  }

  /**
   * 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteOne(filter: any) {
    return KVStorage.deleteOne(filter);
  }

  /**
   * 여러 문서 삭제
   * @param filter - 삭제 조건
   * @returns 삭제 결과
   */
  async deleteMany(filter: any) {
    return KVStorage.deleteMany(filter);
  }

  /**
   * 세션의 모든 KV 스토리지 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return KVStorage.deleteMany({ session_id: sessionId });
  }
}

/**
 * KVStorage 리포지토리 싱글톤 인스턴스
 */

export const kvStorageRepository = new KVStorageRepository();
