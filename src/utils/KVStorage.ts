/**
 * KVStorage - 키-값 저장소 (Mongoose 통합)
 */

import { Json } from './Json';
import { Util } from './Util';
import { KVStorageModel, IKVStorage } from '../models/KVStorage.model';

export class KVStorage {
  private storNamespace: string;
  private cacheData: Map<string, any> | null = null;

  private static storageList: Map<string, KVStorage> = new Map();

  /**
   * 저장소 인스턴스 가져오기
   */
  static getStorage(storNamespace: string | number): KVStorage {
    const fullKey = String(storNamespace);
    
    if (KVStorage.storageList.has(fullKey)) {
      return KVStorage.storageList.get(fullKey)!;
    }

    const obj = new KVStorage(storNamespace);
    KVStorage.storageList.set(fullKey, obj);
    return obj;
  }

  protected constructor(storNamespace: string | number) {
    this.storNamespace = String(storNamespace);
    this.turnOnCache();
  }

  /**
   * 네임스페이스 간 값 가져오기
   */
  static async getValuesFromInterNamespace(key: string | number): Promise<Record<string, any>> {
    const keyStr = Util.valueFromEnum(key) as string;
    const result: Record<string, any> = {};

    const docs = await KVStorageModel.find({ key: keyStr }).exec();
    for (const doc of docs) {
      try {
        result[doc.namespace] = Json.decode(doc.value);
      } catch {
        result[doc.namespace] = null;
      }
    }

    return result;
  }

  /**
   * 캐시 활성화
   */
  turnOnCache(): this {
    if (this.cacheData === null) {
      this.cacheData = new Map();
    }
    return this;
  }

  /**
   * 캐시 비활성화
   */
  turnOffCache(): this {
    this.cacheData = null;
    return this;
  }

  /**
   * 캐시 리셋
   */
  resetCache(disableCache: boolean = true): this {
    if (disableCache) {
      this.cacheData = null;
    } else {
      this.cacheData = new Map();
    }
    return this;
  }

  /**
   * 캐시 값 무효화
   */
  invalidateCacheValue(key: string | number): this {
    if (this.cacheData === null) {
      return this;
    }
    const keyStr = Util.valueFromEnum(key) as string;
    this.cacheData.delete(keyStr);
    return this;
  }

  /**
   * 여러 캐시 값 무효화
   */
  invalidateCacheValues(keys: (string | number)[]): this {
    if (this.cacheData === null) {
      return this;
    }
    const keyStrs = Util.valuesFromEnumArray(keys) as string[];
    for (const key of keyStrs) {
      this.cacheData.delete(key);
    }
    return this;
  }

  /**
   * 모든 값 캐시
   */
  async cacheAll(invalidateAll: boolean = true): Promise<this> {
    if (!invalidateAll && this.cacheData !== null && this.cacheData.size > 0) {
      return this;
    }
    const result = await this.getDBAll();
    this.cacheData = new Map(Object.entries(result));
    return this;
  }

  /**
   * 특정 값들 캐시
   */
  async cacheValues(keys: (string | number)[], invalidateAll: boolean = false): Promise<this> {
    if (this.cacheData === null) {
      this.cacheData = new Map();
    }
    const keyStrs = Util.valuesFromEnumArray(keys) as string[];

    if (invalidateAll) {
      const notExists = keyStrs;
      const values = await this.getDBValues(notExists);
      for (const key of notExists) {
        this.cacheData.set(key, values[key] ?? null);
      }
    } else {
      const notExists: string[] = [];
      for (const key of keyStrs) {
        if (!this.cacheData.has(key)) {
          notExists.push(key);
        }
      }
      if (notExists.length > 0) {
        const values = await this.getDBValues(notExists);
        for (const key of notExists) {
          this.cacheData.set(key, values[key] ?? null);
        }
      }
    }
    return this;
  }

  /**
   * 값 가져오기
   */
  async getValue(key: string | number, onlyCache: boolean = false): Promise<any> {
    const keyStr = Util.valueFromEnum(key) as string;
    
    if (this.cacheData !== null) {
      if (onlyCache || this.cacheData.has(keyStr)) {
        return this.cacheData.get(keyStr) ?? null;
      }
    }

    const value = await this.getDBValue(keyStr);
    
    if (this.cacheData !== null) {
      this.cacheData.set(keyStr, value);
    }
    
    return value;
  }

  /**
   * 여러 값 가져오기
   */
  async getValues(keys: (string | number)[], onlyCache: boolean = false): Promise<Record<string, any>> {
    const keyStrs = Util.valuesFromEnumArray(keys) as string[];
    
    if (!keyStrs.length) {
      return {};
    }

    if (this.cacheData === null) {
      return await this.getDBValues(keyStrs);
    }

    const result: Record<string, any> = {};
    const notExists: string[] = [];

    for (const key of keyStrs) {
      if (this.cacheData.has(key)) {
        result[key] = this.cacheData.get(key);
      } else {
        notExists.push(key);
      }
    }

    if (onlyCache) {
      for (const key of notExists) {
        result[key] = null;
      }
      return result;
    }

    if (notExists.length > 0) {
      const dbResult = await this.getDBValues(notExists);
      for (const [key, value] of Object.entries(dbResult)) {
        result[key] = value;
        this.cacheData.set(key, value);
      }
    }

    return result;
  }

  /**
   * 값들을 배열로 가져오기
   */
  async getValuesAsArray(keys: (string | number)[], onlyCache: boolean = false): Promise<any[]> {
    const keyStrs = Util.valuesFromEnumArray(keys) as string[];
    const dictResult = await this.getValues(keys, onlyCache);
    return keyStrs.map(key => dictResult[key] ?? null);
  }

  /**
   * 값 설정
   */
  async setValue(key: string | number, value: any): Promise<this> {
    const keyStr = Util.valueFromEnum(key) as string;

    if (value === null) {
      return this.deleteValue(keyStr);
    }

    if (this.cacheData !== null) {
      this.cacheData.set(keyStr, value);
    }

    await this.setDBValue(keyStr, value);
    return this;
  }

  /**
   * 값 삭제
   */
  async deleteValue(key: string | number): Promise<this> {
    const keyStr = Util.valueFromEnum(key) as string;

    if (this.cacheData !== null) {
      this.cacheData.delete(keyStr);
    }

    await this.deleteDBValue(keyStr);
    return this;
  }

  /**
   * 모든 값 가져오기
   */
  async getAll(onlyCache: boolean = false): Promise<Record<string, any>> {
    if (onlyCache && this.cacheData !== null && this.cacheData.size > 0) {
      const result: Record<string, any> = {};
      for (const [key, value] of this.cacheData.entries()) {
        result[key] = value;
      }
      return result;
    }

    const result = await this.getDBAll();
    
    if (this.cacheData !== null) {
      this.cacheData = new Map(Object.entries(result));
    }
    
    return result;
  }

  /**
   * 네임스페이스 리셋
   */
  async resetValues(): Promise<this> {
    if (this.cacheData !== null) {
      this.cacheData = new Map();
    }
    await this.resetDBNamespace();
    return this;
  }

  // 데이터베이스 메서드들
  private async getDBValue(key: string): Promise<any> {
    const doc = await KVStorageModel.findOne({ 
      namespace: this.storNamespace, 
      key 
    }).exec();

    if (!doc) {
      return null;
    }

    try {
      return Json.decode(doc.value);
    } catch {
      return null;
    }
  }

  private async setDBValue(key: string, value: any): Promise<void> {
    const valueStr = Json.encode(value);
    
    await KVStorageModel.findOneAndUpdate(
      { namespace: this.storNamespace, key },
      { value: valueStr },
      { upsert: true, new: true }
    ).exec();
  }

  private async deleteDBValue(key: string): Promise<void> {
    await KVStorageModel.deleteOne({ 
      namespace: this.storNamespace, 
      key 
    }).exec();
  }

  private async getDBAll(): Promise<Record<string, any>> {
    const docs = await KVStorageModel.find({ 
      namespace: this.storNamespace 
    }).exec();

    const result: Record<string, any> = {};
    for (const doc of docs) {
      try {
        result[doc.key] = Json.decode(doc.value);
      } catch {
        result[doc.key] = null;
      }
    }

    return result;
  }

  private async getDBValues(keys: string[]): Promise<Record<string, any>> {
    if (!keys.length) {
      return {};
    }

    const docs = await KVStorageModel.find({ 
      namespace: this.storNamespace,
      key: { $in: keys }
    }).exec();

    const result: Record<string, any> = {};
    
    // 모든 키에 대해 null 초기화
    for (const key of keys) {
      result[key] = null;
    }

    for (const doc of docs) {
      try {
        result[doc.key] = Json.decode(doc.value);
      } catch {
        result[doc.key] = null;
      }
    }

    return result;
  }

  private async resetDBNamespace(): Promise<void> {
    await KVStorageModel.deleteMany({ 
      namespace: this.storNamespace 
    }).exec();
  }

  /**
   * 락 획득 (분산 락 지원)
   */
  async acquireLock(key: string, ttl: number = 60): Promise<boolean> {
    const lockKey = `${this.storNamespace}:lock:${key}`;
    const lockValue = Date.now().toString();
    
    const existing = await this.getDBValue(lockKey);
    if (existing && Date.now() - parseInt(existing) < ttl * 1000) {
      return false;
    }
    
    await this.setDBValue(lockKey, lockValue);
    return true;
  }

  /**
   * 락 해제
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${this.storNamespace}:lock:${key}`;
    await this.deleteDBValue(lockKey);
  }
}
