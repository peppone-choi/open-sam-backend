import { RedisService } from '../../infrastructure/cache/redis.service';
import { GameStateCache, EntityType, ChangeLogEntry } from '../../infrastructure/cache/game-state-cache';
import mongoose from 'mongoose';

/**
 * 영속화 데몬
 * 
 * stream:changes를 소비하여 Redis → MongoDB 동기화:
 * - Consumer Group으로 배치 처리
 * - 같은 ID는 최신 것만 유지 (coalesce)
 * - Redis에서 HGETALL로 전체 데이터 로드
 * - MongoDB bulkWrite (upsert)
 * - 성공 시 GameStateCache.clearDirty() 호출
 */
export class PersistenceDaemon {
  private redis: RedisService;
  private gameCache: GameStateCache;
  private isRunning = false;
  private readonly CHANGE_STREAM = 'stream:changes';
  private readonly CONSUMER_GROUP = 'persist:workers';
  private readonly CONSUMER_NAME: string;
  private readonly BATCH_SIZE = 200;

  constructor() {
    this.redis = new RedisService();
    this.gameCache = new GameStateCache();
    this.CONSUMER_NAME = `persist-${process.pid}`;
  }

  /**
   * 데몬 시작
   */
  async start(): Promise<void> {
    console.log('💾 영속화 데몬 시작 중...');

    // Consumer Group 생성
    await this.redis.createConsumerGroup(this.CHANGE_STREAM, this.CONSUMER_GROUP);
    console.log(`✅ Consumer Group 생성 완료: ${this.CONSUMER_GROUP}`);

    this.isRunning = true;
    this.processLoop();
  }

  /**
   * 데몬 중지
   */
  async stop(): Promise<void> {
    console.log('⏹️ 영속화 데몬 중지 중...');
    this.isRunning = false;
  }

  /**
   * 메인 처리 루프
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('❌ 영속화 오류:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * 배치 처리
   */
  private async processBatch(): Promise<void> {
    const client = this.redis.getClient();

    // 스트림에서 읽기
    const messages = await this.redis.readGroup(
      this.CHANGE_STREAM,
      this.CONSUMER_GROUP,
      this.CONSUMER_NAME,
      this.BATCH_SIZE,
      10000 // 10초 대기
    );

    if (messages.length === 0) {
      return;
    }

    // 변경 로그 파싱 및 병합 (coalesce)
    const changeMap = new Map<string, ChangeLogEntry>();

    for (const message of messages) {
      const entry: ChangeLogEntry = {
        entityType: message.data.entityType as EntityType,
        id: message.data.id,
        op: message.data.op as any,
        version: parseInt(message.data.version, 10),
        changes: JSON.parse(message.data.changes || '{}'),
        updatedAt: parseInt(message.data.updatedAt, 10),
      };

      const key = `${entry.entityType}:${entry.id}`;
      const existing = changeMap.get(key);

      // 최신 버전만 유지
      if (!existing || entry.version > existing.version) {
        changeMap.set(key, entry);
      }
    }

    // 엔티티 타입별로 그룹화
    const byType = new Map<EntityType, ChangeLogEntry[]>();
    
    for (const entry of changeMap.values()) {
      if (!byType.has(entry.entityType)) {
        byType.set(entry.entityType, []);
      }
      byType.get(entry.entityType)!.push(entry);
    }

    // 타입별로 MongoDB에 저장
    for (const [type, entries] of byType.entries()) {
      await this.persistToMongoDB(type, entries);
    }

    // 모든 메시지 ACK
    for (const message of messages) {
      await this.redis.ack(this.CHANGE_STREAM, this.CONSUMER_GROUP, message.id);
    }

    console.log(`💾 영속화 완료: ${changeMap.size}개 엔티티`);
  }

  /**
   * MongoDB에 영속화
   */
  private async persistToMongoDB(
    type: EntityType,
    entries: ChangeLogEntry[]
  ): Promise<void> {
    const client = this.redis.getClient();
    const modelName = this.getModelName(type);
    const Model = mongoose.model(modelName);

    const bulkOps: any[] = [];

    for (const entry of entries) {
      if (entry.op === 'delete') {
        // 삭제 처리
        bulkOps.push({
          deleteOne: {
            filter: { _id: entry.id },
          },
        });
        continue;
      }

      // Redis에서 전체 데이터 로드
      const entityKey = `${type}:{${entry.id}}`;
      const data = await client.hgetall(entityKey);

      if (!data || Object.keys(data).length === 0) {
        console.warn(`⚠️ Redis에서 엔티티를 찾을 수 없음: ${entityKey}`);
        continue;
      }

      // 역직렬화
      const document = this.deserialize(data);
      delete document.dirty; // MongoDB에는 저장하지 않음
      delete document.version; // MongoDB에는 저장하지 않음

      // Upsert
      bulkOps.push({
        updateOne: {
          filter: { _id: entry.id },
          update: { $set: document },
          upsert: true,
        },
      });
    }

    if (bulkOps.length === 0) {
      return;
    }

    // BulkWrite 실행
    try {
      await Model.bulkWrite(bulkOps, { ordered: false });

      // Dirty 플래그 클리어
      for (const entry of entries) {
        if (entry.op !== 'delete') {
          await this.gameCache.clearDirty(type, entry.id, entry.version);
        }
      }

      console.log(`✅ ${type} 영속화: ${bulkOps.length}개`);
    } catch (error) {
      console.error(`❌ ${type} 영속화 실패:`, error);
      throw error;
    }
  }

  /**
   * 엔티티 타입 → MongoDB 모델명
   */
  private getModelName(type: EntityType): string {
    const mapping: Record<EntityType, string> = {
      [EntityType.GENERAL]: 'General',
      [EntityType.CITY]: 'City',
      [EntityType.NATION]: 'Nation',
      [EntityType.DIPLOMACY]: 'Diplomacy',
    };
    return mapping[type];
  }

  /**
   * 역직렬화 (Redis → MongoDB)
   */
  private deserialize(data: Record<string, string>): any {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // _id 필드 처리
      if (key === 'id') {
        result._id = value;
        continue;
      }

      // 숫자 변환
      if (this.isNumericField(key)) {
        result[key] = parseInt(value, 10) || parseFloat(value) || 0;
      }
      // 불린 변환
      else if (key === 'dirty') {
        result[key] = value === 'true' || value === '1';
      }
      // JSON 파싱 시도
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

    return result;
  }

  /**
   * 숫자 필드 판단
   */
  private isNumericField(key: string): boolean {
    const numericFields = [
      'version', 'updatedAt', 'createdAt',
      'leadership', 'strength', 'intel',
      'leadership_exp', 'strength_exp', 'intel_exp',
      'train', 'atmos', 'crew', 'gold', 'rice',
      'exp', 'ded', 'injury',
      'agri', 'comm', 'tech', 'def', 'wall', 'secu', 'pop', 'trust',
      'agri_max', 'comm_max', 'def_max', 'wall_max', 'secu_max', 'pop_max',
      'level', 'turn',
    ];
    return numericFields.includes(key) || key.endsWith('_exp') || key.endsWith('Count');
  }

  /**
   * 유틸리티: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
