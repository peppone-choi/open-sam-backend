import { RedisService } from '../../infrastructure/cache/redis.service';
import { logger } from '../common/utils/logger';
import { CommandRepository } from '../command/repository/command.repository';
import { GameSessionRepository } from '../game-session/repository/game-session.repository';
import { CommandStatus } from '../command/@types/command.types';
import { getExecutionTime } from '../../common/constants/command-execution-time';

/**
 * Command Completer
 * 
 * ZSET을 폴링하여 완료 시간이 된 커맨드를 COMPLETED 처리하고
 * 다음 커맨드를 자동으로 시작
 * 
 * Entity 기반으로 리팩토링 완료
 */
export class CommandCompleter {
  private redis: RedisService;
  private commandRepo: CommandRepository;
  private sessionRepo: GameSessionRepository;
  private isRunning = false;
  private readonly POLL_INTERVAL = 1000; // 1초마다 폴링

  constructor() {
    this.redis = new RedisService();
    this.commandRepo = new CommandRepository();
    this.sessionRepo = new GameSessionRepository();
  }

  /**
   * Completer 시작
   */
  async start() {
    this.isRunning = true;
    logger.info('⏱️  커맨드 완료 처리기 시작');
    this.poll();
  }

  /**
   * Completer 중지
   */
  stop() {
    this.isRunning = false;
    logger.info('⏸️  커맨드 완료 처리기 중지');
  }

  /**
   * 주기적 폴링
   */
  private async poll() {
    while (this.isRunning) {
      try {
        await this.checkCompletedCommands();
        await this.sleep(this.POLL_INTERVAL);
      } catch (error) {
        logger.error('완료 처리기 오류:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * 완료된 커맨드 확인 및 처리
   */
  private async checkCompletedCommands() {
    // 모든 활성 게임 세션 조회
    const sessions = await this.sessionRepo.findByStatus('running');

    for (const session of sessions) {
      const client = this.redis.getClient();
      const executingKey = `s:${session.id}:executing`;
      
      let threshold: number;
      
      if (session.gameMode === 'realtime') {
        // 실시간: 현재 시간(ms) 이하
        threshold = Date.now();
      } else {
        // 턴제: 현재 턴 이하
        const turnKey = `s:${session.id}:turn`;
        const currentTurnStr = await client.get(turnKey);
        threshold = parseInt(currentTurnStr || '0', 10);
      }
      
      // 완료된 커맨드 조회 (score <= threshold)
      const completedCommandIds = await client.zrangebyscore(executingKey, 0, threshold);
      
      for (const commandId of completedCommandIds) {
        await this.completeCommand(session.id, commandId);
      }
    }
  }

  /**
   * 커맨드 완료 처리
   */
  private async completeCommand(sessionId: string, commandId: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      
      // Command 조회
      const command = await this.commandRepo.findById(commandId);
      
      if (!command) {
        logger.warn(`커맨드를 찾을 수 없음: ${commandId}`);
        return;
      }

      logger.info(`✅ 커맨드 완료: ${command.type} (${commandId})`);

      // 커맨드 상태 업데이트
      await this.commandRepo.updateStatus(
        commandId,
        CommandStatus.COMPLETED,
        { message: '정상 완료' }
      );

      // ZSET에서 제거
      const executingKey = `s:${sessionId}:executing`;
      await client.zrem(executingKey, commandId);

      // current 키 삭제 (c: commander로 변경)
      const currentKey = `s:${sessionId}:c:${command.commanderId}:current`;
      await client.del(currentKey);

      // 다음 커맨드 시작
      await this.startNextCommand(sessionId, command.commanderId);

    } catch (error) {
      logger.error(`커맨드 완료 처리 오류 (${commandId}):`, error);
    }
  }

  /**
   * 다음 커맨드 시작
   */
  private async startNextCommand(sessionId: string, commanderId: string): Promise<void> {
    const client = this.redis.getClient();
    // c: commander로 변경
    const queueKey = `s:${sessionId}:c:${commanderId}:queue`;
    const currentKey = `s:${sessionId}:c:${commanderId}:current`;

    // 큐에서 첫 번째 커맨드 가져오기
    const nextCommandId = await client.lpop(queueKey);
    if (!nextCommandId) return;

    const command = await this.commandRepo.findById(nextCommandId);
    
    if (!command) {
      logger.warn(`다음 커맨드를 찾을 수 없음: ${nextCommandId}`);
      return;
    }
    
    const session = await this.sessionRepo.findById(sessionId);
    
    if (!session) {
      logger.warn(`세션을 찾을 수 없음: ${sessionId}`);
      return;
    }

    // current 설정
    await client.set(currentKey, nextCommandId);
    
    // DB 상태 업데이트 (EXECUTING)
    await this.commandRepo.updateStatus(nextCommandId, CommandStatus.EXECUTING);
    
    // 스트림에 발행 → 즉시 핸들러 실행 → 상태 적용
    await client.xadd(
      'stream:commands',
      '*',
      'commandId', nextCommandId,
      'sessionId', sessionId,
      'commanderId', commanderId,
      'type', command.type,
      'payload', JSON.stringify(command.payload)
    );
    
    logger.info(`🔄 다음 커맨드 시작: ${command.type} (${nextCommandId})`);
    
    // 완료 시간 계산
    const executingKey = `s:${sessionId}:executing`;
    let completeScore: number;
    
    if (session.gameMode === 'realtime') {
      // 실시간: 현재시간(ms) + 실행시간(초)
      const executionTime = getExecutionTime(command.type);
      completeScore = Date.now() + (executionTime * 1000);
    } else {
      // 턴제: 현재턴 + 1
      const turnKey = `s:${sessionId}:turn`;
      const currentTurnStr = await client.get(turnKey);
      const currentTurn = parseInt(currentTurnStr || '0', 10);
      completeScore = currentTurn + 1;
    }
    
    // ZSET에 등록 (완료 예정)
    await client.zadd(executingKey, completeScore, nextCommandId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
