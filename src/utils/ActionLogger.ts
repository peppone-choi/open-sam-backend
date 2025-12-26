import { logger } from '../common/logger';
import { configManager } from '../config/ConfigManager';

const { system } = configManager.get();

interface LogEntry {
  timestamp: Date;
  sessionId: string;
  generalId?: number;
  nationId?: number;
  action: string;
  message: string;
  type: string;
}

export class ActionLogger {
  private static logs: LogEntry[] = [];
  private static nationalHistoryLogs: LogEntry[] = [];
  
  static PLAIN = 'PLAIN';
  static INFO = 'INFO';
  static WARNING = 'WARNING';
  static ERROR = 'ERROR';

  // Instance properties for PHP compatibility
  private sessionId: string;
  private generalNo?: number;
  private nationId?: number;
  private year?: number;
  private month?: number;

  constructor(generalNo?: number, nationId?: number, year?: number, month?: number, sessionId: string = system.sessionId, _autoFlush: boolean = true) {
    this.sessionId = sessionId;
    this.generalNo = generalNo;
    this.nationId = nationId;
    this.year = year;
    this.month = month;
  }

  pushGeneralActionLog(message: string, type: string = ActionLogger.PLAIN): void {
    ActionLogger.log(this.generalNo, 'general_action', message, type, this.sessionId);
  }

  pushGeneralHistoryLog(message: string, type: string = ActionLogger.PLAIN): void {
    ActionLogger.log(this.generalNo, 'general_history', message, type, this.sessionId);
  }

  pushGlobalActionLog(message: string, type: string = ActionLogger.PLAIN): void {
    if (this.nationId) {
      ActionLogger.pushNationalHistoryLog(this.nationId, 'global_action', message, type, this.sessionId);
    }
  }

  pushGlobalHistoryLog(message: string, type: string = ActionLogger.PLAIN): void {
    if (this.nationId) {
      ActionLogger.pushNationalHistoryLog(this.nationId, 'global_history', message, type, this.sessionId);
    }
  }

  async flush(): Promise<void> {
    return ActionLogger.flush();
  }

  static warn(message: string, ...args: any[]): void {
    logger.warn(message, ...args);
  }

  static info(message: string, ...args: any[]): void {
    logger.info(message, ...args);
  }

  /**
   * 일반 액션 로그 기록
   */
  static log(generalId: number | undefined, action: string, message: string, type: string = ActionLogger.PLAIN, sessionId: string = system.sessionId): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      sessionId,
      generalId,
      action,
      message,
      type
    };
    
    this.logs.push(entry);
    
    // 콘솔에도 출력 (개발 환경)
    if (system.nodeEnv === 'development') {
      logger.debug(`[ActionLog] General ${generalId}: ${action} - ${message}`);
    }
    
    // 로그가 너무 많이 쌓이면 자동으로 flush
    if (this.logs.length > 1000) {
      void this.flush();
    }
  }

  /**
   * 국가 역사 로그 기록
   */
  static pushNationalHistoryLog(
    nationId: number,
    action: string,
    message: string,
    type: string = ActionLogger.PLAIN,
    sessionId: string = system.sessionId
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      sessionId,
      nationId,
      action,
      message,
      type
    };
    
    this.nationalHistoryLogs.push(entry);
    
    if (system.nodeEnv === 'development') {
      logger.debug(`[NationalHistoryLog] Nation ${nationId}: ${action} - ${message}`);
    }
    
    if (this.nationalHistoryLogs.length > 500) {
      void this.flushNationalHistory();
    }
  }

  /**
   * 일반 로그를 DB에 저장
   */
  static async flush(): Promise<void> {
    if (this.logs.length === 0) return;
    
    try {
      const { generalRecordRepository } = await import('../repositories/general-record.repository');
      const { GameEventEmitter } = await import('../services/gameEventEmitter');
      
      const currentLogs = [...this.logs];
      this.logs = [];

      for (const log of currentLogs) {
        if (!log.generalId) continue;
        
        const logType = log.action.includes('history') ? 'history' : 'action';
        
        const savedLog = await generalRecordRepository.create({
          session_id: log.sessionId,
          general_id: log.generalId,
          log_type: logType,
          text: log.message,
          date: log.timestamp
        });
        
        if (savedLog) {
          const logId = savedLog._id?.toString() || savedLog.id || 0;
          GameEventEmitter.broadcastLogUpdate(
            log.sessionId,
            log.generalId,
            logType as 'action' | 'history',
            logId,
            log.message
          );
        }
      }
    } catch (error) {
      logger.error('Failed to flush action logs:', error);
    }
  }

  /**
   * 국가 역사 로그를 DB에 저장
   */
  static async flushNationalHistory(): Promise<void> {
    if (this.nationalHistoryLogs.length === 0) return;
    
    try {
      const { NgHistory } = await import('../models/ng_history.model');
      const { sessionRepository } = await import('../repositories/session.repository');
      
      const currentLogs = [...this.nationalHistoryLogs];
      this.nationalHistoryLogs = [];

      const logsBySession = new Map<string, { global_history: string[], global_action: string[] }>();
      
      for (const log of currentLogs) {
        const sessionId = log.sessionId || system.sessionId;
        if (!logsBySession.has(sessionId)) {
          logsBySession.set(sessionId, { global_history: [], global_action: [] });
        }
        
        const sessionLogs = logsBySession.get(sessionId)!;
        if (log.action === 'global_history') {
          sessionLogs.global_history.push(log.message);
        } else if (log.action === 'global_action') {
          sessionLogs.global_action.push(log.message);
        }
      }
      
      for (const [sessionId, logs] of logsBySession) {
        const session = await sessionRepository.findBySessionId(sessionId);
        if (!session) continue;
        
        const sessionData = session.data || {};
        const year = sessionData.game_env?.year || sessionData.year || 1;
        const month = sessionData.game_env?.month || sessionData.month || 1;
        
        let history = await (NgHistory as any).findOne({
          server_id: sessionId,
          year: year,
          month: month
        });
        
        if (!history) {
          history = new (NgHistory as any)({
            server_id: sessionId,
            year: year,
            month: month,
            global_history: [],
            global_action: [],
            nations: [],
            map: null
          });
        }
        
        history.global_history = [...(history.global_history || []), ...logs.global_history];
        history.global_action = [...(history.global_action || []), ...logs.global_action];
        
        await history.save();
      }
    } catch (error) {
      logger.error('Failed to flush national history logs:', error);
    }
  }

  static async flushAll(): Promise<void> {
    await Promise.all([
      this.flush(),
      this.flushNationalHistory()
    ]);
  }

  static getStats(): { generalLogs: number; nationalLogs: number } {
    return {
      generalLogs: this.logs.length,
      nationalLogs: this.nationalHistoryLogs.length
    };
  }
}
