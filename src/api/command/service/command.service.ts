import { CommandRepository } from '../repository/command.repository';
import { CommandQueue } from '../../../infrastructure/queue/command-queue';
import { ICommand, CommandType, CommandStatus, SubmitCommandDto } from '../@types/command.types';
import { HttpException } from '../../../common/errors/HttpException';
import { GameSessionRepository } from '../../game-session/repository/game-session.repository';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { getExecutionTime } from '../../../common/constants/command-execution-time';
import { EntityRepository } from '../../../common/repository/entity-repository';
import { ResourceService, Cost } from '../../../common/services/resource.service';
import { Role, createRef } from '../../../common/@types/role.types';

/**
 * Command Service (비즈니스 로직 계층)
 * 
 * Entity 시스템 통합:
 * - EntityRepository를 사용한 Commander 조회
 * - ResourceService를 사용한 CP 검증 및 소비
 * - CQRS 패턴 유지
 */
export class CommandService {
  private redis: RedisService;

  constructor(
    private repository: CommandRepository,
    private commandQueue: CommandQueue,
    private sessionRepository: GameSessionRepository
  ) {
    this.redis = new RedisService();
  }

  /**
   * 명령 제출
   * 
   * 턴제 모드: Redis ZSET에 예약
   * 실시간 모드: Redis Streams에 즉시 발행
   */
  async submit(dto: SubmitCommandDto): Promise<{ messageId: string }> {
    if (!dto.commanderId || !dto.type || !dto.payload) {
      throw new HttpException(400, '잘못된 명령 데이터입니다.');
    }

    if (!Object.values(CommandType).includes(dto.type)) {
      throw new HttpException(400, '잘못된 명령 타입입니다.');
    }

    const sessionId = dto.sessionId || 'default';
    const session = await this.sessionRepository.findById(sessionId);
    
    if (!session) {
      throw new HttpException(404, '게임 세션을 찾을 수 없습니다.');
    }

    // Entity 시스템을 통한 Commander 조회
    const commanderRef = createRef(Role.COMMANDER, dto.commanderId, session.scenarioId || 'sangokushi');
    const commander = await EntityRepository.findById(commanderRef);
    
    if (!commander) {
      throw new HttpException(404, '지휘관을 찾을 수 없습니다.');
    }

    // CP 검증 (ResourceService 사용)
    const cpCost = dto.cpCost || 0;
    const cpType = dto.cpType || 'PCP';
    const cpResourceId = cpType === 'PCP' ? 'pcp' : 'mcp';
    
    if (cpCost > 0) {
      const costs: Cost[] = [{
        id: cpResourceId,
        amount: cpCost,
        allowDebt: false,
      }];

      try {
        ResourceService.validateCost(
          commander.resources || {},
          costs,
          session.scenarioId || 'sangokushi'
        );
      } catch (error) {
        throw new HttpException(400, `CP가 부족합니다. (필요: ${cpCost}, 타입: ${cpType})`);
      }

      // CP 소비 (commit)
      ResourceService.applyCost(commander.resources || {}, costs, 'commit');
      
      // Entity 업데이트
      await EntityRepository.patch(
        commanderRef,
        { resources: commander.resources },
        commander.version
      );
    }

    const client = this.redis.getClient();
    const queueKey = `s:${sessionId}:c:${dto.commanderId}:queue`;
    const currentKey = `s:${sessionId}:c:${dto.commanderId}:current`;

    // DB에 Command 레코드 생성 (영속화) - PENDING 상태
    const command = await this.repository.create({
      sessionId,
      commanderId: dto.commanderId,
      type: dto.type,
      status: CommandStatus.PENDING,
      payload: dto.payload,
      cpCost,
      cpType,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Redis 큐에 추가 (RPUSH - 뒤에 추가)
    await client.rpush(queueKey, command.id);

    // 현재 실행 중인 커맨드가 없으면 큐에서 첫 번째를 꺼내서 실행
    const currentCommand = await client.get(currentKey);
    if (!currentCommand) {
      // 실시간 모드면 즉시 시작, 턴제 모드면 턴 진행 시 시작
      if (session.gameMode === 'realtime') {
        await this.startNextCommand(sessionId, dto.commanderId);
      }
    }

    return { messageId: command.id };
  }

  /**
   * 다음 커맨드 시작 (큐에서 첫 번째를 꺼내서 실행)
   */
  private async startNextCommand(sessionId: string, commanderId: string): Promise<void> {
    const client = this.redis.getClient();
    const queueKey = `s:${sessionId}:c:${commanderId}:queue`;
    const currentKey = `s:${sessionId}:c:${commanderId}:current`;

    // 큐에서 첫 번째 커맨드 가져오기 (LPOP - 앞에서 꺼내기)
    const nextCommandId = await client.lpop(queueKey);
    
    if (!nextCommandId) return;

    const command = await this.repository.findById(nextCommandId);
    if (!command) return;
    
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) return;

    // current 설정
    await client.set(currentKey, nextCommandId);
    
    // DB 상태 업데이트 (EXECUTING)
    await this.repository.updateStatus(nextCommandId, CommandStatus.EXECUTING);
    
    // 스트림에 발행 → 즉시 핸들러 실행 → 상태 적용
    await this.commandQueue.publish({
      commanderId: command.commanderId,
      type: command.type,
      payload: command.payload,
      sessionId,
      commandId: nextCommandId,
    } as any);
    
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
    
    // ZSET에 등록 (완료 예정 시간으로 자동 완료 처리)
    await client.zadd(executingKey, completeScore, nextCommandId);
  }

  /**
   * ID로 조회
   */
  async getById(id: string): Promise<ICommand | null> {
    return await this.repository.findById(id);
  }

  /**
   * 지휘관별 명령 조회
   */
  async getByCommanderId(
    commanderId: string,
    sessionId?: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<ICommand[]> {
    if (sessionId) {
      return await this.repository.findBySessionAndCommander(sessionId, commanderId, limit, skip);
    }
    return await this.repository.findByCommanderId(commanderId, limit, skip);
  }

  /**
   * 실행 중인 명령 조회
   */
  async getExecuting(sessionId?: string): Promise<ICommand[]> {
    return await this.repository.findExecuting(sessionId);
  }

  /**
   * 명령 취소
   */
  async cancel(id: string, commanderId: string): Promise<ICommand> {
    const command = await this.repository.findById(id);
    
    if (!command) {
      throw new HttpException(404, '명령을 찾을 수 없습니다.');
    }

    if (command.commanderId !== commanderId) {
      throw new HttpException(403, '해당 명령을 취소할 권한이 없습니다.');
    }

    if (command.status !== CommandStatus.PENDING && command.status !== CommandStatus.SCHEDULED) {
      throw new HttpException(400, '취소할 수 없는 상태의 명령입니다.');
    }

    // CP 환불 (ResourceService 사용)
    if (command.cpCost > 0) {
      const session = await this.sessionRepository.findById(command.sessionId);
      if (session) {
        const commanderRef = createRef(Role.COMMANDER, commanderId, session.scenarioId || 'sangokushi');
        const commander = await EntityRepository.findById(commanderRef);
        
        if (commander) {
          const cpResourceId = command.cpType === 'PCP' ? 'pcp' : 'mcp';
          const costs: Cost[] = [{
            id: cpResourceId,
            amount: command.cpCost,
            allowDebt: true,
          }];

          ResourceService.applyCost(commander.resources || {}, costs, 'refund');
          
          await EntityRepository.patch(
            commanderRef,
            { resources: commander.resources },
            commander.version
          );
        }
      }
    }

    // 상태 업데이트
    const updated = await this.repository.updateStatus(
      id,
      CommandStatus.CANCELLED,
      undefined,
      '사용자가 취소함'
    );

    if (!updated) {
      throw new HttpException(500, '명령 취소 중 오류가 발생했습니다.');
    }

    // Redis 큐에서 제거
    const client = this.redis.getClient();
    const queueKey = `s:${command.sessionId}:c:${commanderId}:queue`;
    await client.lrem(queueKey, 0, id);

    return updated;
  }
}
