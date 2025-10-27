import { RedisService } from '../../infrastructure/cache/redis.service';
import { logger } from '../common/utils/logger';
import { CommandRepository } from '../command/repository/command.repository';
import { GameSessionRepository } from '../game-session/repository/game-session.repository';
import { CommandType, CommandStatus } from '../command/@types/command.types';

/**
 * Command Processor (Entity 기반)
 * 
 * Redis Streams에서 명령을 소비하고 처리
 * 모든 엔티티는 EntityRepository를 통해 접근
 */
export class CommandProcessor {
  private redis: RedisService;
  private commandRepo: CommandRepository;
  private sessionRepo: GameSessionRepository;
  private isRunning = false;
  private readonly STREAM_KEY = 'stream:commands';
  private readonly GROUP_NAME = 'game-daemon';
  private readonly CONSUMER_NAME = 'processor-1';
  private readonly LOCK_TTL = 30000;

  constructor(
    commandRepo: CommandRepository,
    sessionRepo: GameSessionRepository
  ) {
    this.redis = new RedisService();
    this.commandRepo = commandRepo;
    this.sessionRepo = sessionRepo;
  }

  async start() {
    this.isRunning = true;
    logger.info('🔄 커맨드 프로세서 시작 (Entity 기반)');

    try {
      await this.redis.createConsumerGroup(this.STREAM_KEY, this.GROUP_NAME);
      logger.info(`✅ Consumer group 생성: ${this.GROUP_NAME}`);
    } catch (error) {
      // Group already exists
    }

    this.poll();
  }

  stop() {
    this.isRunning = false;
    logger.info('⏸️  커맨드 프로세서 중지');
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const messages = await this.redis.readGroup(
          this.STREAM_KEY,
          this.GROUP_NAME,
          this.CONSUMER_NAME,
          10,
          1000
        );

        if (messages && messages.length > 0) {
          for (const message of messages) {
            await this.processMessage(message.id, message.data);
          }
        }
      } catch (error) {
        logger.error('폴링 오류:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processMessage(messageId: string, data: any) {
    let lockKey: string | null = null;
    
    try {
      const commandData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (commandData.status === CommandStatus.SCHEDULED) {
        await this.redis.ack(this.STREAM_KEY, this.GROUP_NAME, messageId);
        return;
      }

      const commanderId = commandData.commanderId || commandData.generalId;
      logger.info(`📨 커맨드 처리: ${commandData.type} (${messageId})`);

      lockKey = await this.acquireLock(commanderId);
      if (!lockKey) {
        logger.warn(`⏳ Commander ${commanderId} 락 실패, 재시도`);
        return;
      }

      const command = await this.commandRepo.create({
        sessionId: commandData.sessionId || 'default',
        commanderId: commanderId,
        type: commandData.type,
        status: CommandStatus.EXECUTING,
        payload: commandData.payload,
        cpCost: commandData.cpCost || 0,
        cpType: commandData.cpType || 'PCP',
        startTime: new Date(),
      });

      // TODO: 핸들러 실행 (EntityRepository 사용)
      await this.processCommand(command.id, commandData);

      await this.redis.ack(this.STREAM_KEY, this.GROUP_NAME, messageId);
      logger.info(`✅ 커맨드 완료: ${messageId}`);

    } catch (error) {
      logger.error(`❌ 커맨드 오류 ${messageId}:`, error);
    } finally {
      if (lockKey) {
        await this.releaseLock(lockKey);
      }
    }
  }

  private async processCommand(commandId: string, data: any) {
    // TODO: Entity 기반 핸들러로 리팩토링
    logger.info(`처리 중: ${data.type}`);
    
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { message: 'Entity 시스템으로 마이그레이션 필요' }
    );
  }

  private async acquireLock(entityId: string): Promise<string | null> {
    const lockKey = `lock:entity:${entityId}`;
    const client = this.redis.getClient();
    const acquired = await client.set(lockKey, '1', 'PX', this.LOCK_TTL, 'NX');
    return acquired ? lockKey : null;
  }

  private async releaseLock(lockKey: string): Promise<void> {
    const client = this.redis.getClient();
    await client.del(lockKey);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
