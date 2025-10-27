import { RedisService } from '../../infrastructure/cache/redis.service';
import { GameStateCache, EntityType } from '../../infrastructure/cache/game-state-cache';
import { DomesticHandler } from './handlers/patterns/domestic.handler';
import { MilitaryHandler } from './handlers/patterns/military.handler';
import { CommandType } from '../command/@types/command.types';
import fs from 'fs';
import path from 'path';

/**
 * 커맨드 워커
 * 
 * Redis Streams에서 커맨드를 소비하고 게임 로직 실행:
 * - stream:commands에서 읽기
 * - GameStateCache를 사용하여 상태 로드
 * - 패턴별 핸들러 실행
 * - 변경사항 자동 기록 (stream:changes)
 * - 중복 실행 방지
 */
export class CommandWorker {
  private redis: RedisService;
  private gameCache: GameStateCache;
  private isRunning = false;
  private readonly COMMAND_STREAM = 'stream:commands';
  private readonly CONSUMER_GROUP = 'command:workers';
  private readonly CONSUMER_NAME: string;
  
  // Lua 스크립트
  private trainScript: string;
  private domesticScript: string;

  constructor() {
    this.redis = new RedisService();
    this.gameCache = new GameStateCache();
    this.CONSUMER_NAME = `worker-${process.pid}`;
    
    this.trainScript = fs.readFileSync(
      path.join(__dirname, 'scripts/train.lua'),
      'utf-8'
    );
    this.domesticScript = fs.readFileSync(
      path.join(__dirname, 'scripts/domestic.lua'),
      'utf-8'
    );
  }

  /**
   * 워커 시작
   */
  async start(): Promise<void> {
    console.log('🎮 커맨드 워커 시작 중...');
    
    // Consumer Group 생성 (이미 존재하면 무시)
    await this.redis.createConsumerGroup(this.COMMAND_STREAM, this.CONSUMER_GROUP);
    console.log(`✅ Consumer Group 생성 완료: ${this.CONSUMER_GROUP}`);

    this.isRunning = true;
    this.processLoop();
  }

  /**
   * 워커 중지
   */
  async stop(): Promise<void> {
    console.log('⏹️ 커맨드 워커 중지 중...');
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
        console.error('❌ 커맨드 처리 오류:', error);
        await this.sleep(1000);
      }
    }
  }

  /**
   * 배치 처리
   */
  private async processBatch(): Promise<void> {
    const client = this.redis.getClient();

    // 스트림에서 읽기 (블로킹, 5초 대기)
    const messages = await this.redis.readGroup(
      this.COMMAND_STREAM,
      this.CONSUMER_GROUP,
      this.CONSUMER_NAME,
      10, // 한 번에 10개씩
      5000 // 5초 대기
    );

    if (messages.length === 0) {
      return;
    }

    // 각 커맨드 처리
    for (const message of messages) {
      try {
        await this.processCommand(message.id, message.data);
        
        // 처리 완료 후 ACK
        await this.redis.ack(this.COMMAND_STREAM, this.CONSUMER_GROUP, message.id);
      } catch (error) {
        console.error(`❌ 커맨드 처리 실패 (${message.id}):`, error);
        // 재처리를 위해 ACK하지 않음
      }
    }
  }

  /**
   * 개별 커맨드 처리
   */
  private async processCommand(
    streamId: string,
    data: Record<string, string>
  ): Promise<void> {
    const commandId = data.commandId;
    const commandType = data.type as CommandType;
    const generalId = data.generalId;
    const payload = JSON.parse(data.payload || '{}');
    const turn = parseInt(data.turn || '0', 10);

    console.log(`🎯 커맨드 처리 시작: ${commandType} (${commandId})`);

    // De-dup 체크
    const dedupKey = `dedup:command:${commandId}`;
    const client = await this.redis.getClient();
    const alreadyProcessed = await client.exists(dedupKey);
    
    if (alreadyProcessed) {
      console.log(`⏭️ 이미 처리된 커맨드 건너뜀: ${commandId}`);
      return;
    }

    // 커맨드 타입별 처리
    const handler = this.getHandler(commandType);
    
    if (!handler) {
      console.error(`❌ 지원하지 않는 커맨드 타입: ${commandType}`);
      return;
    }

    // 컨텍스트 준비
    const context = {
      commandId,
      generalId,
      type: commandType,
      payload,
      turn,
      rng: Math.random, // TODO: 시드 기반 RNG
      generalRepo: this.createRepository(EntityType.GENERAL),
      cityRepo: this.createRepository(EntityType.CITY),
      nationRepo: this.createRepository(EntityType.NATION),
    };

    // 핸들러 실행
    const result = await handler.handle(context);

    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.error(`❌ 커맨드 실행 실패: ${result.message}`);
    }
  }

  /**
   * 커맨드 타입별 핸들러 반환
   */
  private getHandler(type: CommandType): any {
    // 내정 커맨드
    const domesticTypes = [
      CommandType.DEVELOP_AGRICULTURE,
      CommandType.INVEST_COMMERCE,
      CommandType.RESEARCH_TECH,
      CommandType.FORTIFY_DEFENSE,
      CommandType.REPAIR_WALL,
      CommandType.IMPROVE_SECURITY,
      CommandType.ENCOURAGE_SETTLEMENT,
      CommandType.GOVERN_PEOPLE,
    ];

    if (domesticTypes.includes(type)) {
      return new DomesticHandler();
    }

    // 군사 커맨드
    const militaryTypes = [
      CommandType.TRAIN,
      CommandType.BOOST_MORALE,
      CommandType.CONSCRIPT,
      CommandType.RECRUIT,
      CommandType.DISMISS_TROOPS,
    ];

    if (militaryTypes.includes(type)) {
      return new MilitaryHandler();
    }

    return null;
  }

  /**
   * Repository 생성 (Redis 우선)
   */
  private createRepository(type: EntityType): any {
    return {
      findById: async (id: string) => {
        return await this.gameCache.get(type, id);
      },
      update: async (id: string, changes: Record<string, any>) => {
        const entity = await this.gameCache.get(type, id);
        if (!entity) {
          throw new Error(`${type}을(를) 찾을 수 없음: ${id}`);
        }
        
        Object.assign(entity, changes);
        await this.gameCache.set(type, entity, changes);
      },
    };
  }

  /**
   * 유틸리티: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
