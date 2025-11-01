import { CommandRegistry } from './CommandRegistry';
import { CommandFactory } from './CommandFactory';
import { CommandExecutor } from './CommandExecutor';
import { commandRepository } from '../../repositories/command.repository';
import { logger } from '../../common/logger';
import { cacheService } from '../../common/cache/cache.service';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error';

/**
 * 커맨드 서비스
 * 
 * API 레이어에서 사용하는 통합 커맨드 서비스입니다.
 * 커맨드 제출, 조회, 취소 등의 기능을 제공합니다.
 */
export class CommandService {
  /**
   * 커맨드 제출
   * 
   * @param data - 커맨드 데이터
   * @returns 생성된 커맨드 문서
   */
  static async submit(data: {
    sessionId: string;
    generalId: string;
    category: 'general' | 'nation';
    type: string;
    arg?: any;
    priority?: number;
  }) {
    logger.info('커맨드 제출', {
      sessionId: data.sessionId,
      generalId: data.generalId,
      type: data.type
    });

    // 1. 커맨드 유효성 검증
    const validation = await CommandExecutor.validate({
      category: data.category,
      type: data.type,
      generalId: data.generalId,
      sessionId: data.sessionId,
      arg: data.arg
    });

    if (!validation.valid) {
      throw new BadRequestError('커맨드 실행 조건을 만족하지 않습니다', {
        errors: validation.errors
      });
    }

    // 2. 커맨드 DB에 저장
    const command = await commandRepository.create({
      session_id: data.sessionId,
      general_id: data.generalId,
      category: data.category,
      type: data.type,
      arg: data.arg,
      status: 'pending',
      priority: data.priority || 5,
      cost: validation.cost,
      created_at: new Date(),
    });

    // 3. Redis Streams에 발행 (CQRS)
    const { CommandQueue } = await import('../../infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.publish({
      commandId: String(command._id),
      category: data.category,
      type: data.type,
      generalId: data.generalId,
      sessionId: data.sessionId,
      arg: data.arg
    });

    // 4. 캐시 무효화
    await cacheService.invalidate(
      [`command:${command._id}`],
      [`commands:general:${data.generalId}`, 'commands:pending:*']
    );

    logger.info('커맨드 제출 완료', {
      commandId: command._id,
      type: data.type
    });

    return command;
  }

  /**
   * 커맨드 조회
   * 
   * @param commandId - 커맨드 ID
   * @returns 커맨드 문서
   */
  static async getById(commandId: string) {
    return cacheService.getOrLoad(
      `command:${commandId}`,
      () => commandRepository.findById(commandId),
      30
    );
  }

  /**
   * 장수별 커맨드 목록 조회
   * 
   * @param sessionId - 세션 ID
   * @param generalId - 장수 ID
   * @returns 커맨드 목록
   */
  static async getByGeneral(sessionId: string, generalId: string) {
    return cacheService.getOrLoad(
      `commands:general:${generalId}`,
      () => commandRepository.findByGeneral(sessionId, generalId),
      10
    );
  }

  /**
   * 대기 중인 커맨드 목록 조회
   * 
   * @param sessionId - 세션 ID
   * @returns 대기 중인 커맨드 목록
   */
  static async getPending(sessionId: string) {
    return commandRepository.findPending(sessionId);
  }

  /**
   * 커맨드 취소
   * 
   * @param commandId - 커맨드 ID
   * @returns 취소 결과
   */
  static async cancel(commandId: string) {
    const command = await commandRepository.findById(commandId);

    if (!command) {
      throw new NotFoundError('커맨드를 찾을 수 없습니다', { commandId });
    }

    if (command.status !== 'pending') {
      throw new BadRequestError('취소할 수 없는 커맨드입니다', {
        commandId,
        status: command.status
      });
    }

    // 상태 업데이트
    await commandRepository.updateById(commandId, {
      status: 'cancelled',
      cancelled_at: new Date()
    });

    // 캐시 무효화
    await cacheService.invalidate(
      [`command:${commandId}`],
      [`commands:general:${command.general_id}`, 'commands:pending:*']
    );

    logger.info('커맨드 취소 완료', { commandId });

    return { success: true, commandId };
  }

  /**
   * 사용 가능한 커맨드 타입 목록
   */
  static getAvailableTypes() {
    return CommandFactory.getAvailableTypes();
  }

  /**
   * 커맨드 통계
   */
  static getStats() {
    return CommandRegistry.getStats();
  }
}
