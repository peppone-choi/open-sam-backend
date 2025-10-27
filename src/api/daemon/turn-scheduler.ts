import { RedisService } from '../../infrastructure/cache/redis.service';
import { logger } from '../common/utils/logger';
import { GameSessionRepository } from '../game-session/repository/game-session.repository';
import { EntityRepository } from '../../common/repository/entity-repository';

/**
 * 턴 스케줄러 (완전 구현)
 * 
 * 턴제 모드에서:
 * - 자동 턴 진행 (turnInterval마다)
 * - 턴 당기기/미루기
 * - 턴 번호 관리
 */
export class TurnScheduler {
  private redis: RedisService;
  private sessionRepo: GameSessionRepository;
  private isRunning = false;
  private readonly POLL_INTERVAL = 1000;
  private readonly COMMAND_STREAM = 'stream:commands';

  constructor(sessionRepo: GameSessionRepository) {
    this.redis = new RedisService();
    this.sessionRepo = sessionRepo;
  }

  async start() {
    this.isRunning = true;
    logger.info('⏰ 턴 스케줄러 시작');
    this.poll();
  }

  stop() {
    this.isRunning = false;
    logger.info('⏸️  턴 스케줄러 중지');
  }

  private async poll() {
    while (this.isRunning) {
      try {
        await this.checkTurnProgress();
        await this.sleep(this.POLL_INTERVAL);
      } catch (error) {
        logger.error('턴 스케줄러 오류:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * 턴 진행 체크
   */
  private async checkTurnProgress() {
    const sessions = await this.sessionRepo.findAll();

    for (const session of sessions) {
      if (session.gameMode !== 'turnBased' || session.status !== 'running') {
        continue;
      }

      const turnConfig = session.turnConfig;
      if (!turnConfig?.lastTurnAt) continue;

      const now = Date.now();
      const lastTurnTime = new Date(turnConfig.lastTurnAt).getTime();
      const turnIntervalMs = session.turnInterval * 1000;

      // 턴 간격이 지났으면 자동 진행
      if (now - lastTurnTime >= turnIntervalMs) {
        await this.advanceTurn(session.id);
        
        await this.sessionRepo.update(session.id, {
          'turnConfig.lastTurnAt': new Date()
        } as any);
      }
    }
  }

  /**
   * 턴 진행
   * 
   * 모든 Commander의 큐에서 첫 번째 커맨드를 실행
   */
  async advanceTurn(sessionId: string): Promise<number> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.gameMode !== 'turnBased') {
      throw new Error('턴제 모드가 아닙니다');
    }

    const client = this.redis.getClient();
    const turnKey = `s:${sessionId}:turn`;
    
    // 턴 번호 증가
    const currentTurnStr = await client.get(turnKey);
    const currentTurn = parseInt(currentTurnStr || '0', 10);
    const nextTurn = currentTurn + 1;
    await client.set(turnKey, nextTurn.toString());

    logger.info(`🔄 세션 ${sessionId} 턴 ${nextTurn} 진행`);

    // 세션의 모든 Commander 큐에서 커맨드 실행
    const queuePattern = `s:${sessionId}:c:*:queue`;
    const queueKeys = await this.scanKeys(queuePattern);
    
    let executedCount = 0;

    for (const queueKey of queueKeys) {
      const match = queueKey.match(/s:[^:]+:c:([^:]+):queue/);
      if (!match) continue;
      
      const commanderId = match[1];
      const currentKey = `s:${sessionId}:c:${commanderId}:current`;

      // 큐에서 다음 커맨드 가져오기
      const commandId = await client.lpop(queueKey);
      
      if (commandId) {
        // 현재 실행 중으로 설정
        await client.set(currentKey, commandId);
        
        // 스트림에 발행
        await client.xadd(
          this.COMMAND_STREAM,
          '*',
          'commandId', commandId,
          'sessionId', sessionId,
          'commanderId', commanderId,
          'status', 'EXECUTING'
        );
        
        executedCount++;
        logger.info(`  ✅ Commander ${commanderId}: 커맨드 ${commandId} 실행`);
      }
    }

    logger.info(`✅ 세션 ${sessionId} 턴 ${nextTurn} 완료 (${executedCount}개 실행)`);
    return nextTurn;
  }

  /**
   * 턴 당기기
   */
  async accelerateTurn(sessionId: string, turnCount: number): Promise<void> {
    if (turnCount <= 0) throw new Error('당길 턴 수는 0보다 커야 합니다');

    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.gameMode !== 'turnBased') {
      throw new Error('턴제 모드가 아닙니다');
    }

    const client = this.redis.getClient();
    const executingKey = `s:${sessionId}:executing`;

    // 모든 실행 중인 커맨드의 완료 턴을 앞당김
    const commands = await client.zrange(executingKey, 0, -1, 'WITHSCORES');

    for (let i = 0; i < commands.length; i += 2) {
      const commandId = commands[i];
      const oldTurn = parseInt(commands[i + 1], 10);
      const newTurn = Math.max(0, oldTurn - turnCount);

      await client.zrem(executingKey, commandId);
      await client.zadd(executingKey, newTurn, commandId);
    }

    logger.info(`⏩ 세션 ${sessionId}: ${turnCount}턴 당김`);
  }

  /**
   * 턴 미루기
   */
  async delayTurn(sessionId: string, turnCount: number): Promise<void> {
    if (turnCount <= 0) throw new Error('미룰 턴 수는 0보다 커야 합니다');

    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.gameMode !== 'turnBased') {
      throw new Error('턴제 모드가 아닙니다');
    }

    const client = this.redis.getClient();
    const executingKey = `s:${sessionId}:executing`;

    // 모든 실행 중인 커맨드의 완료 턴을 늦춤
    const commands = await client.zrange(executingKey, 0, -1, 'WITHSCORES');

    for (let i = 0; i < commands.length; i += 2) {
      const commandId = commands[i];
      const oldTurn = parseInt(commands[i + 1], 10);
      const newTurn = oldTurn + turnCount;

      await client.zrem(executingKey, commandId);
      await client.zadd(executingKey, newTurn, commandId);
    }

    logger.info(`⏸️  세션 ${sessionId}: ${turnCount}턴 미룸`);
  }

  /**
   * 현재 턴 번호 조회
   */
  async getCurrentTurn(sessionId: string): Promise<number> {
    const client = this.redis.getClient();
    const turnKey = `s:${sessionId}:turn`;
    const turnStr = await client.get(turnKey);
    return parseInt(turnStr || '0', 10);
  }

  /**
   * Redis 키 스캔
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const client = this.redis.getClient();
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
