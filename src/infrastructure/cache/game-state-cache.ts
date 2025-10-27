import { RedisService } from './redis.service';

/**
 * 게임 상태 캐시 (Redis HASH 기반)
 * 
 * 게임의 모든 상태는 Redis를 Primary로 사용
 * MongoDB는 Write-Behind 영속화 저장소
 */

/**
 * 엔티티 타입
 */
export enum EntityType {
  GENERAL = 'general',
  CITY = 'city',
  NATION = 'nation',
  DIPLOMACY = 'diplomacy',
}

/**
 * Redis에 저장되는 엔티티 공통 필드
 */
export interface CachedEntity {
  id: string;
  version: number;
  dirty: boolean;
  updatedAt: number;
  [key: string]: any;
}

/**
 * 변경 로그 엔트리
 */
export interface ChangeLogEntry {
  entityType: EntityType;
  id: string;
  op: 'create' | 'update' | 'delete';
  version: number;
  changes: Record<string, any>;
  updatedAt: number;
}

/**
 * 게임 상태 캐시 서비스
 */
export class GameStateCache {
  private redis: RedisService;
  private readonly CHANGE_STREAM = 'stream:changes';
  private readonly CACHE_INVALIDATE_CHANNEL = 'channel:cache:invalidate';

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 엔티티 키 생성
   */
  private getEntityKey(type: EntityType, id: string): string {
    return `${type}:{${id}}`;
  }

  /**
   * 인덱스 키 생성
   */
  private getIndexKey(type: EntityType, indexName: string, parentId?: string): string {
    if (parentId) {
      return `${type}:{${parentId}}:${indexName}`;
    }
    return `${type}:${indexName}`;
  }

  /**
   * 엔티티 조회
   */
  async get<T extends CachedEntity>(
    type: EntityType,
    id: string
  ): Promise<T | null> {
    const key = this.getEntityKey(type, id);
    const client = this.redis.getClient();
    const data = await client.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    // 숫자/불린 필드 변환
    return this.deserialize<T>(data);
  }

  /**
   * 엔티티 저장 (dirty flag 설정)
   */
  async set<T extends CachedEntity>(
    type: EntityType,
    entity: T,
    changes?: Record<string, any>
  ): Promise<void> {
    const key = this.getEntityKey(type, entity.id);
    const client = this.redis.getClient();

    // 버전 증가
    const newVersion = (entity.version || 0) + 1;
    entity.version = newVersion;
    entity.dirty = true;
    entity.updatedAt = Date.now();

    // HASH에 저장
    const serialized = this.serialize(entity);
    await client.hset(key, serialized);

    // 변경 로그 기록
    await this.logChange({
      entityType: type,
      id: entity.id,
      op: 'update',
      version: newVersion,
      changes: changes || {},
      updatedAt: entity.updatedAt,
    });

    // 캐시 무효화 발행
    await this.invalidateCache(type, entity.id);
  }

  /**
   * 엔티티 생성
   */
  async create<T extends CachedEntity>(
    type: EntityType,
    entity: T
  ): Promise<void> {
    entity.version = 1;
    entity.dirty = true;
    entity.updatedAt = Date.now();

    const key = this.getEntityKey(type, entity.id);
    const client = this.redis.getClient();
    const serialized = this.serialize(entity);
    await client.hset(key, serialized);

    // 변경 로그 기록
    await this.logChange({
      entityType: type,
      id: entity.id,
      op: 'create',
      version: 1,
      changes: entity,
      updatedAt: entity.updatedAt,
    });

    // 캐시 무효화 발행
    await this.invalidateCache(type, entity.id);
  }

  /**
   * 엔티티 삭제
   */
  async delete(type: EntityType, id: string): Promise<void> {
    const key = this.getEntityKey(type, id);
    const client = await this.redis.getClient();

    // 기존 데이터 조회
    const existing = await this.get(type, id);
    if (!existing) return;

    // 삭제
    await client.del(key);

    // 변경 로그 기록
    await this.logChange({
      entityType: type,
      id,
      op: 'delete',
      version: existing.version + 1,
      changes: {},
      updatedAt: Date.now(),
    });

    // 캐시 무효화 발행
    await this.invalidateCache(type, id);
  }

  /**
   * 인덱스에 추가
   */
  async addToIndex(
    type: EntityType,
    indexName: string,
    id: string,
    parentId?: string
  ): Promise<void> {
    const indexKey = this.getIndexKey(type, indexName, parentId);
    const client = this.redis.getClient();
    await client.sadd(indexKey, id);
  }

  /**
   * 인덱스에서 제거
   */
  async removeFromIndex(
    type: EntityType,
    indexName: string,
    id: string,
    parentId?: string
  ): Promise<void> {
    const indexKey = this.getIndexKey(type, indexName, parentId);
    const client = this.redis.getClient();
    await client.srem(indexKey, id);
  }

  /**
   * 인덱스 조회
   */
  async getFromIndex(
    type: EntityType,
    indexName: string,
    parentId?: string
  ): Promise<string[]> {
    const indexKey = this.getIndexKey(type, indexName, parentId);
    const client = this.redis.getClient();
    return await client.smembers(indexKey);
  }

  /**
   * 정렬된 인덱스에 추가 (ZSET)
   */
  async addToSortedIndex(
    indexName: string,
    score: number,
    id: string
  ): Promise<void> {
    const client = this.redis.getClient();
    await client.zadd(indexName, score, id);
  }

  /**
   * 변경 로그 기록
   */
  private async logChange(entry: ChangeLogEntry): Promise<void> {
    const client = this.redis.getClient();
    await client.xadd(
      this.CHANGE_STREAM,
      'MAXLEN',
      '~',
      '1000000',
      '*',
      'entityType', entry.entityType,
      'id', entry.id,
      'op', entry.op,
      'version', entry.version.toString(),
      'changes', JSON.stringify(entry.changes),
      'updatedAt', entry.updatedAt.toString()
    );
  }

  /**
   * 캐시 무효화 발행
   */
  private async invalidateCache(type: EntityType, id: string): Promise<void> {
    const cacheKey = `cache:${type}:${id}`;
    const client = await this.redis.getClient();
    await client.publish(this.CACHE_INVALIDATE_CHANNEL, cacheKey);
  }

  /**
   * 직렬화 (TypeScript → Redis)
   */
  private serialize(obj: any): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object') {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    return result;
  }

  /**
   * 역직렬화 (Redis → TypeScript)
   */
  private deserialize<T>(data: Record<string, string>): T {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      // 숫자 변환
      if (key === 'version' || key === 'updatedAt' || key.endsWith('_exp') || key.endsWith('Count')) {
        result[key] = parseInt(value, 10);
      }
      // 불린 변환
      else if (key === 'dirty') {
        result[key] = value === 'true' || value === '1';
      }
      // JSON 객체 파싱 시도
      else if (value.startsWith('{') || value.startsWith('[')) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      }
      // 문자열 그대로
      else {
        result[key] = value;
      }
    }
    return result as T;
  }

  /**
   * Dirty 플래그 클리어 (영속화 완료 후)
   */
  async clearDirty(type: EntityType, id: string, version: number): Promise<void> {
    const key = this.getEntityKey(type, id);
    const client = this.redis.getClient();
    
    // 현재 버전 확인
    const currentVersion = await client.hget(key, 'version');
    if (currentVersion && parseInt(currentVersion, 10) === version) {
      await client.hset(key, 'dirty', '0');
    }
  }

  /**
   * 모든 Dirty 엔티티 조회
   */
  async getDirtyEntities(type: EntityType, limit: number = 100): Promise<string[]> {
    const client = this.redis.getClient();
    const pattern = `${type}:*`;
    const dirtyIds: string[] = [];
    let cursor = '0';

    // SCAN으로 키 조회
    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = result[0];
      const keys = result[1];

      for (const key of keys) {
        const dirty = await client.hget(key, 'dirty');
        if (dirty === '1' || dirty === 'true') {
          const id = key.split(':')[1].replace(/{|}/g, '');
          dirtyIds.push(id);
          if (dirtyIds.length >= limit) break;
        }
      }
      
      if (dirtyIds.length >= limit) break;
    } while (cursor !== '0');

    return dirtyIds;
  }
}
