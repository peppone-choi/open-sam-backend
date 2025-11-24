import { BaseLoghCommand, ILoghCommandContext } from './BaseLoghCommand';
import { commandRegistry } from './CommandRegistry';
import { logger } from '../../common/logger';
import { BadRequestError, InternalServerError } from '../../common/errors/app-error';
import { randomUUID } from 'crypto';

/**
 * LOGH Command Executor
 * 
 * 은하영웅전설 커맨드의 검증, 실행, 결과 처리를 통합 관리합니다.
 */
export class LoghCommandExecutor {
  /**
   * 커맨드 실행
   * 
   * @param commandData - 커맨드 데이터
   * @param commandData.commandType - 커맨드 타입 (예: 'move', 'warp', 'production')
   * @param commandData.commanderNo - 커맨더 번호
   * @param commandData.sessionId - 세션 ID
   * @param commandData.arg - 커맨드 인자
   * @returns 실행 결과
   */
  static async execute(commandData: {
    commandType: string;
    commanderNo: number;
    sessionId: string;
    arg?: any;
  }): Promise<{
    success: boolean;
    commandId: string;
    result?: any;
    error?: string;
  }> {
    const commandId = randomUUID();
    const startTime = Date.now();

    try {
      logger.info('[LOGH] 커맨드 실행 시작', {
        commandId,
        commandType: commandData.commandType,
        commanderNo: commandData.commanderNo,
        sessionId: commandData.sessionId
      });

      // 1. 커맨더 및 환경 데이터 로드
      const { LoghCommander } = await import('../../models/logh/Commander.model');
      const { Session } = await import('../../models/session.model');
      
      const commander = await LoghCommander.findOne({
        session_id: commandData.sessionId,
        no: commandData.commanderNo
      });

      const session = await Session.findOne({ session_id: commandData.sessionId });

      if (!commander) {
        throw new BadRequestError('커맨더를 찾을 수 없습니다', { 
          commanderNo: commandData.commanderNo,
          sessionId: commandData.sessionId
        });
      }

      if (!session) {
        throw new BadRequestError('세션을 찾을 수 없습니다', { 
          sessionId: commandData.sessionId 
        });
      }

      const gameEnv = session.data || {};
      const env = {
        ...gameEnv.game_env,
        ...gameEnv,
        ...(commandData.arg || {}),
        session_id: commandData.sessionId
      };
 
       // 2. 커맨드 인스턴스 생성
      const command = commandRegistry.getCommand(commandData.commandType);
      
      if (!command) {
        throw new BadRequestError('알 수 없는 커맨드 타입입니다', {
          commandType: commandData.commandType
        });
      }

      // 3. Context 생성
      const context: ILoghCommandContext = {
        commander: commander as any, // ILoghCommandExecutor와 호환
        session,
        env
      };

      // Fleet 정보가 필요한 경우 로드
      if (commander.fleetId) {
        const { Fleet } = await import('../../models/logh/Fleet.model');
        const fleet = await Fleet.findOne({ fleetId: commander.fleetId });
        if (fleet) {
          context.fleet = fleet;
        }
      }

      // 4. 실행 조건 검증
      const conditionError = await command.checkConditionExecutable(context);
      if (conditionError) {
        throw new BadRequestError(`커맨드 실행 조건 불충족: ${conditionError}`, {
          commandId,
          commandType: commandData.commandType
        });
      }

      // 5. 커맨드 실행
      const result = await command.execute(context);

      const duration = Date.now() - startTime;

      logger.info('[LOGH] 커맨드 실행 완료', {
        commandId,
        commandType: commandData.commandType,
        success: result.success,
        message: result.message,
        durationMs: duration
      });

      return {
        success: result.success,
        commandId,
        result: {
          message: result.message,
          effects: result.effects || []
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[LOGH] 커맨드 실행 실패', {
        commandId,
        commandType: commandData.commandType,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration
      });

      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new InternalServerError('커맨드 실행 중 오류가 발생했습니다', error as Error, {
        commandId,
        commandType: commandData.commandType
      });
    }
  }

  /**
   * 커맨드 유효성 검증만 수행
   * 
   * @param commandData - 커맨드 데이터
   * @returns 검증 결과
   */
  static async validate(commandData: {
    commandType: string;
    commanderNo: number;
    sessionId: string;
    arg?: any;
  }): Promise<{
    valid: boolean;
    errors?: string[];
    requiredCP?: number;
  }> {
    try {
      const { LoghCommander } = await import('../../models/logh/Commander.model');
      const { Session } = await import('../../models/session.model');
      
      const commander = await LoghCommander.findOne({
        session_id: commandData.sessionId,
        no: commandData.commanderNo
      });

      const session = await Session.findOne({ session_id: commandData.sessionId });

      if (!commander || !session) {
        return {
          valid: false,
          errors: ['커맨더 또는 세션을 찾을 수 없습니다']
        };
      }

      const command = commandRegistry.getCommand(commandData.commandType);
      
      if (!command) {
        return {
          valid: false,
          errors: ['알 수 없는 커맨드 타입입니다']
        };
      }

      const gameEnv = session.data || {};
      const env = {
        ...gameEnv.game_env,
        ...gameEnv,
        session_id: commandData.sessionId
      };

      const context: ILoghCommandContext = {
        commander: commander as any,
        session,
        env
      };

      // Fleet 정보가 필요한 경우 로드
      if (commander.fleetId) {
        const { Fleet } = await import('../../models/logh/Fleet.model');
        const fleet = await Fleet.findOne({ fleetId: commander.fleetId });
        if (fleet) {
          context.fleet = fleet;
        }
      }

      const errors: string[] = [];

      // 조건 검증
      const conditionError = await command.checkConditionExecutable(context);
      if (conditionError) {
        errors.push(conditionError);
      }

      const requiredCP = command.getRequiredCommandPoints();

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        requiredCP
      };

    } catch (error) {
      logger.error('[LOGH] 커맨드 검증 실패', {
        commandType: commandData.commandType,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : '검증 실패']
      };
    }
  }

  /**
   * 사용 가능한 커맨드 목록 조회
   * 
   * @param commanderNo - 커맨더 번호
   * @param sessionId - 세션 ID
   * @returns 사용 가능한 커맨드 목록
   */
  static async getAvailableCommands(
    commanderNo: number,
    sessionId: string
  ): Promise<Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    requiredCP: number;
    requiredTurns: number;
    available: boolean;
    reason?: string;
  }>> {
    try {
      const { LoghCommander } = await import('../../models/logh/Commander.model');
      const { Session } = await import('../../models/session.model');
      
      const commander = await LoghCommander.findOne({
        session_id: sessionId,
        no: commanderNo
      });

      const session = await Session.findOne({ session_id: sessionId });

      if (!commander || !session) {
        return [];
      }

      const gameEnv = session.data || {};
      const env = {
        ...gameEnv.game_env,
        ...gameEnv,
        session_id: sessionId
      };

      const context: ILoghCommandContext = {
        commander: commander as any,
        session,
        env
      };

      // Fleet 정보가 필요한 경우 로드
      if (commander.fleetId) {
        const { Fleet } = await import('../../models/logh/Fleet.model');
        const fleet = await Fleet.findOne({ fleetId: commander.fleetId });
        if (fleet) {
          context.fleet = fleet;
        }
      }

      const allCommandNames = commandRegistry.getAllCommandNames();
      const results = [];

      for (const commandName of allCommandNames) {
        const command = commandRegistry.getCommand(commandName);
        if (!command) continue;

        const conditionError = await command.checkConditionExecutable(context);

        results.push({
          name: command.getName(),
          displayName: command.getDisplayName(),
          description: command.getDescription(),
          category: command.getCategory(),
          requiredCP: command.getRequiredCommandPoints(),
          requiredTurns: command.getRequiredTurns(),
          available: conditionError === null,
          reason: conditionError || undefined
        });
      }

      return results;

    } catch (error) {
      logger.error('[LOGH] 사용 가능 커맨드 조회 실패', {
        commanderNo,
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }
}
