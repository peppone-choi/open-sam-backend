import { CommandFactory } from './CommandFactory';
import { logger } from '../../common/logger';
import { BadRequestError, InternalServerError } from '../../common/errors/app-error';
import { randomUUID } from 'crypto';

/**
 * 커맨드 실행자
 * 
 * 커맨드의 검증, 실행, 결과 처리를 통합 관리합니다.
 */
export class CommandExecutor {
  /**
   * 커맨드 실행
   * 
   * @param commandData - 커맨드 데이터
   * @param commandData.category - 'general' 또는 'nation'
   * @param commandData.type - 커맨드 타입
   * @param commandData.generalId - 장수 ID
   * @param commandData.sessionId - 세션 ID
   * @param commandData.arg - 커맨드 인자
   * @returns 실행 결과
   */
  static async execute(commandData: {
    category: 'general' | 'nation';
    type: string;
    generalId: string;
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
      logger.info('커맨드 실행 시작', {
        commandId,
        category: commandData.category,
        type: commandData.type,
        generalId: commandData.generalId,
        sessionId: commandData.sessionId
      });

      // 1. 장수 및 환경 데이터 로드
      const { generalRepository } = await import('../../repositories/general.repository');
      const { sessionRepository } = await import('../../repositories/session.repository');
      
      const generalNo = parseInt(commandData.generalId, 10);
      const general = await generalRepository.findBySessionAndNo(commandData.sessionId, generalNo);
      const session = await sessionRepository.findBySessionId(commandData.sessionId);

      if (!general) {
        throw new BadRequestError('장수를 찾을 수 없습니다', { generalId: commandData.generalId });
      }

      if (!session) {
        throw new BadRequestError('세션을 찾을 수 없습니다', { sessionId: commandData.sessionId });
      }

      const gameEnv = session.data || {};
      const env = {
        ...gameEnv.game_env,
        ...gameEnv,
        session_id: commandData.sessionId
      };

      // 2. 커맨드 인스턴스 생성
      const command = CommandFactory.create(
        commandData.category,
        commandData.type,
        general,
        env,
        commandData.arg
      );

      // 3. 조건 검증
      if (!command.hasFullConditionMet()) {
        const failReason = command.testFullConditionMet();
        throw new BadRequestError(`커맨드 실행 조건 불충족: ${failReason}`, {
          commandId,
          type: commandData.type
        });
      }

      // 4. 비용 확인
      const [reqGold, reqRice] = command.getCost();
      if (general.getVar('gold') < reqGold || general.getVar('rice') < reqRice) {
        throw new BadRequestError('자금 또는 군량이 부족합니다', {
          required: { gold: reqGold, rice: reqRice },
          current: { gold: general.getVar('gold'), rice: general.getVar('rice') }
        });
      }

      // 5. 커맨드 실행
      // RNG 객체 생성 (간단한 래퍼)
      const rng = {
        nextRangeInt: (min: number, max: number) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        choice: (arr: any[]) => {
          return arr[Math.floor(Math.random() * arr.length)];
        }
      };
      const success = await command.run(rng);

      const duration = Date.now() - startTime;

      logger.info('커맨드 실행 완료', {
        commandId,
        type: commandData.type,
        success,
        durationMs: duration
      });

      return {
        success,
        commandId,
        result: command.getResultTurn()
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('커맨드 실행 실패', {
        commandId,
        type: commandData.type,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration
      });

      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new InternalServerError('커맨드 실행 중 오류가 발생했습니다', error as Error, {
        commandId,
        type: commandData.type
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
    category: 'general' | 'nation';
    type: string;
    generalId: string;
    sessionId: string;
    arg?: any;
  }): Promise<{
    valid: boolean;
    errors?: string[];
    cost?: { gold: number; rice: number };
  }> {
    try {
      // FUTURE: General, Session 로드
      const general: any = null;
      const session: any = null;
      const env = session?.toEnvObject();

      const command = CommandFactory.create(
        commandData.category,
        commandData.type,
        general,
        env,
        commandData.arg
      );

      const errors: string[] = [];

      // 조건 검증
      if (!command.hasFullConditionMet()) {
        errors.push(command.testFullConditionMet());
      }

      // 비용 확인
      const [reqGold, reqRice] = command.getCost();
      if (general.getVar('gold') < reqGold) {
        errors.push(`자금 부족 (필요: ${reqGold}, 보유: ${general.getVar('gold')})`);
      }
      if (general.getVar('rice') < reqRice) {
        errors.push(`군량 부족 (필요: ${reqRice}, 보유: ${general.getVar('rice')})`);
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        cost: { gold: reqGold, rice: reqRice }
      };

    } catch (error) {
      logger.error('커맨드 검증 실패', {
        type: commandData.type,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : '검증 실패']
      };
    }
  }
}
