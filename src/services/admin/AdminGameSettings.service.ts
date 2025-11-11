import { sessionRepository } from '../../repositories/session.repository';
import { ActionLogger } from '../logger/ActionLogger';
import { LogFormatType } from '../../types/log.types';
import { SendSystemNoticeService } from '../message/SendSystemNotice.service';
import { Util } from '../../utils/Util';

/**
 * AdminGameSettings Service
 * 운영자 게임 설정 관리 (PHP: _admin1.php)
 * 
 * 기능:
 * - 운영자 메시지 설정
 * - 중원정세 추가 (전역 로그)
 * - 시작 시간 변경
 * - 최대 장수/국가 수 설정
 * - 턴 기간 변경
 */
export class AdminGameSettingsService {
  /**
   * 운영자 메시지 설정 (전체 공지)
   */
  static async setAdminMessage(sessionId: string, message: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      // game_env에 msg 저장
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.msg = message;
      
      session.markModified('data');
      session.markModified('data.game_env');
      
      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: '운영자 메시지가 설정되었습니다',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 중원정세 추가 (전역 로그)
   * PHP: pushGlobalHistoryLog(["<R>★</><S>{$log}</>"])
   */
  static async addGlobalLog(sessionId: string, logText: string, user: any) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};
      const year = gameEnv.year || 220;
      const month = gameEnv.month || 1;

      // ActionLogger로 전역 이력 추가
      const logger = new ActionLogger(0, 0, year, month, sessionId, false);
      const formattedLog = `<R>★</><S>${logText}</>`;
      logger.pushGlobalHistoryLog(formattedLog, LogFormatType.RAWTEXT);
      await logger.flush();

      return {
        success: true,
        message: '중원정세가 추가되었습니다',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 전체 공지 전송
   */
  static async sendNoticeToAll(sessionId: string, text: string) {
    return await SendSystemNoticeService.sendToAll(sessionId, text);
  }

  /**
   * 시작 시간 변경
   */
  static async setStartTime(sessionId: string, starttime: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.starttime = starttime;

      session.markModified('data');
      session.markModified('data.game_env');

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: '시작 시간이 변경되었습니다',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 최대 장수 수 설정
   */
  static async setMaxGeneral(sessionId: string, maxGeneral: number) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.maxgeneral = maxGeneral;

      session.markModified('data');
      session.markModified('data.game_env');

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: `최대 장수 수가 ${maxGeneral}명으로 설정되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 최대 국가 수 설정
   */
  static async setMaxNation(sessionId: string, maxNation: number) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.maxnation = maxNation;

      session.markModified('data');
      session.markModified('data.game_env');

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: `최대 국가 수가 ${maxNation}개로 설정되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 시작 년도 설정
   */
  static async setStartYear(sessionId: string, startYear: number) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.startyear = startYear;

      session.markModified('data');
      session.markModified('data.game_env');

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: `시작 년도가 ${startYear}년으로 설정되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 턴 기간 변경
   */
  static async setTurnTerm(sessionId: string, turnTerm: number) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      // 허용된 턴 기간 체크
      const allowedTerms = [1, 2, 5, 10, 20, 30, 60, 120];
      if (!allowedTerms.includes(turnTerm)) {
        return {
          success: false,
          message: '허용되지 않는 턴 기간입니다 (1/2/5/10/20/30/60/120분만 가능)',
        };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      
      const gameEnv = session.data.game_env;
      
      // PHP ServerTool과 동일한 로직: turnterm 변경 시 starttime을 역산
      // 이렇게 하면 게임 내 년/월이 유지되면서 turnterm만 변경됨
      const startyear = gameEnv.startyear || 180;
      const year = gameEnv.year || startyear;
      const month = gameEnv.month || 1;
      const turntime = gameEnv.turntime ? new Date(gameEnv.turntime) : new Date();
      
      // ⚠️ CRITICAL FIX: 경과한 턴 수 계산
      // 현재 년/월로부터 경과한 게임 내 월 수를 계산하고, 이를 현실 턴 수로 변환
      let elapsedTurns: number;
      try {
        const currentMonths = Util.joinYearMonth(year, month);
        const startMonths = Util.joinYearMonth(startyear, 1);
        const elapsedGameMonths = currentMonths - startMonths; // 게임 내 경과 월 수
        
        // 게임 내 1개월 = 현실 1턴이므로, 경과한 게임 월 수 = 경과한 턴 수
        elapsedTurns = elapsedGameMonths;
        
        // 비정상적으로 큰 경과 턴 수 체크
        const MAX_REASONABLE_TURNS = 100 * 12; // 100년치 게임 시간
        if (elapsedTurns > MAX_REASONABLE_TURNS || elapsedTurns < 0) {
          throw new Error(`Elapsed turns ${elapsedTurns} is out of reasonable range`);
        }
      } catch (error: any) {
        console.error(`[AdminGameSettings] ⚠️ Error calculating elapsed turns:`, error.message);
        // 안전한 기본값 사용
        elapsedTurns = 0;
      }
      
      // 새로운 turnterm으로 starttime 역산
      const elapsedMinutes = elapsedTurns * turnTerm;
      const { ExecuteEngineService } = await import('../global/ExecuteEngine.service');
      const turntimeCut = ExecuteEngineService.cutTurn(turntime, turnTerm);
      const newStarttime = new Date(turntimeCut.getTime() - elapsedMinutes * 60 * 1000);
      const newStarttimeCut = ExecuteEngineService.cutTurn(newStarttime, turnTerm);
      
      // starttime 유효성 검증
      const now = new Date();
      const tenYearsAgo = now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000;
      
      if (newStarttimeCut.getTime() < tenYearsAgo) {
        console.warn(`[AdminGameSettings] ⚠️ Calculated starttime is too far in the past, using current time`);
        gameEnv.starttime = turntimeCut.toISOString();
        gameEnv.year = startyear;
        gameEnv.month = 1;
      } else {
        gameEnv.starttime = newStarttimeCut.toISOString();
      }
      
      const oldTurnTerm = gameEnv.turnterm || 60;
      gameEnv.turnterm = turnTerm;
      
      let updatedCount = 0;
      
      // ⚠️ CRITICAL: 모든 장수의 turntime 재계산 (PHP ServerTool::changeServerTerm 구현)
      if (oldTurnTerm !== turnTerm) {
        const { generalRepository } = await import('../../repositories/general.repository');
        const servTurnTime = turntime;
        const unitDiff = turnTerm / oldTurnTerm; // 새 턴타임 / 기존 턴타임
        
        console.log(`[AdminGameSettings] Recalculating all generals' turntime (${oldTurnTerm}m → ${turnTerm}m, ratio: ${unitDiff})`);
        
        const generals = await generalRepository.findByFilter({ session_id: sessionId });
        
        for (const general of generals) {
          const genTurnTime = general.turntime ? new Date(general.turntime) : servTurnTime;
          
          // 서버 turntime과의 시간 차이 계산 (초 단위)
          const timeDiff = (genTurnTime.getTime() - servTurnTime.getTime()) / 1000;
          
          // 차이를 새로운 turnterm 비율로 조정
          const newTimeDiff = timeDiff * unitDiff;
          
          // 새로운 turntime 계산
          const newGenTurnTime = new Date(servTurnTime.getTime() + newTimeDiff * 1000);
          
          general.turntime = newGenTurnTime.toISOString();
          await general.save();
          updatedCount++;
        }
        
        console.log(`[AdminGameSettings] Updated ${updatedCount} generals' turntime`);
      }
      
      // Mongoose nested object 변경 감지를 위해 markModified 호출
      session.markModified('data');
      session.markModified('data.game_env');
      
      console.log(`[AdminGameSettings] turnterm changed to ${turnTerm}m, starttime recalculated based on ${year}년 ${month}월`);

      await sessionRepository.saveDocument(session);
      
      // 전역 로그 추가
      const ActionLogger = (await import('../logger/ActionLogger')).ActionLogger;
      const logger = new ActionLogger(0, 0, year, month, sessionId, false);
      logger.pushGlobalHistoryLog(`<R>★</>턴시간이 <C>${turnTerm}분</>으로 변경됩니다.`, (await import('../../types/log.types')).LogFormatType.RAWTEXT);
      await logger.flush();

      return {
        success: true,
        message: `턴 기간이 ${turnTerm}분으로 변경되었습니다 (${updatedCount || 0}명의 장수 턴타임 재계산 완료)`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 게임 설정 조회
   */
  static async getSettings(sessionId: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};

      return {
        success: true,
        settings: {
          msg: gameEnv.msg || '',
          starttime: gameEnv.starttime || '',
          maxgeneral: gameEnv.maxgeneral || 300,
          maxnation: gameEnv.maxnation || 12,
          startyear: gameEnv.startyear || 220,
          turnterm: gameEnv.turnterm || 60,
          turntime: gameEnv.turntime || new Date(),
          year: gameEnv.year || 220,
          month: gameEnv.month || 1,
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
