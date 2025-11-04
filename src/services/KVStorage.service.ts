/**
 * KVStorage 서비스 - KVStorage를 사용하는 예제 서비스
 */

import { KVStorage } from '../utils/KVStorage';

export class KVStorageService {
  /**
   * 사용자 설정 저장소
   */
  static getUserStorage(userId: number): KVStorage {
    return KVStorage.getStorage(`user:${userId}`);
  }

  /**
   * 게임 세션 저장소
   */
  static getSessionStorage(sessionId: string): KVStorage {
    return KVStorage.getStorage(`session:${sessionId}`);
  }

  /**
   * 전역 설정 저장소
   */
  static getGlobalStorage(): KVStorage {
    return KVStorage.getStorage('global');
  }

  /**
   * 사용자 설정 가져오기
   */
  static async getUserSetting(userId: number, key: string): Promise<any> {
    const storage = KVStorageService.getUserStorage(userId);
    return await storage.getValue(key);
  }

  /**
   * 사용자 설정 저장
   */
  static async setUserSetting(userId: number, key: string, value: any): Promise<void> {
    const storage = KVStorageService.getUserStorage(userId);
    await storage.setValue(key, value);
  }

  /**
   * 게임 세션 데이터 가져오기
   */
  static async getSessionData(sessionId: string, key: string): Promise<any> {
    const storage = KVStorageService.getSessionStorage(sessionId);
    return await storage.getValue(key);
  }

  /**
   * 게임 세션 데이터 저장
   */
  static async setSessionData(sessionId: string, key: string, value: any): Promise<void> {
    const storage = KVStorageService.getSessionStorage(sessionId);
    await storage.setValue(key, value);
  }

  /**
   * 전역 설정 가져오기
   */
  static async getGlobalSetting(key: string): Promise<any> {
    const storage = KVStorageService.getGlobalStorage();
    return await storage.getValue(key);
  }

  /**
   * 전역 설정 저장
   */
  static async setGlobalSetting(key: string, value: any): Promise<void> {
    const storage = KVStorageService.getGlobalStorage();
    await storage.setValue(key, value);
  }
}



