import { logger } from '../common/logger';

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

  constructor(generalNo?: number, nationId?: number, year?: number, month?: number, sessionId: string = 'sangokushi_default') {
    this.sessionId = sessionId;
    this.generalNo = generalNo;
    this.nationId = nationId;
    this.year = year;
    this.month = month;
  }

  pushGeneralActionLog(message: string, type: string = ActionLogger.PLAIN): void {
    ActionLogger.log(this.generalNo, 'general_action', message, type);
  }

  pushGeneralHistoryLog(message: string, type: string = ActionLogger.PLAIN): void {
    ActionLogger.log(this.generalNo, 'general_history', message, type);
  }

  pushGlobalActionLog(message: string, type: string = ActionLogger.PLAIN): void {
    if (this.nationId) {
      ActionLogger.pushNationalHistoryLog(this.nationId, 'global_action', message, type);
    }
  }

  pushGlobalHistoryLog(message: string, type: string = ActionLogger.PLAIN): void {
    if (this.nationId) {
      ActionLogger.pushNationalHistoryLog(this.nationId, 'global_history', message, type);
    }
  }

  async flush(): Promise<void> {
    return ActionLogger.flush();
  }

  // Logger method aliases for compatibility
  static warn(message: string, ...args: any[]): void {
    logger.warn(message, ...args);
  }

  static info(message: string, ...args: any[]): void {
    logger.info(message, ...args);
  }

  /**
   * 일반 액션 로그 기록
   */
  static log(generalId: number | undefined, action: string, message: string, type: string = ActionLogger.PLAIN, sessionId: string = 'sangokushi_default'): void {
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
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[ActionLog] General ${generalId}: ${action} - ${message}`);
    }
    
    // 로그가 너무 많이 쌓이면 자동으로 flush
    if (this.logs.length > 1000) {
      this.flush();
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
    sessionId: string = 'sangokushi_default'
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
    
    // 개발 환경에서 콘솔 출력
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[NationalHistoryLog] Nation ${nationId}: ${action} - ${message}`);
    }
    
    // 로그가 너무 많이 쌓이면 자동으로 flush
    if (this.nationalHistoryLogs.length > 500) {
      this.flushNationalHistory();
    }
  }

  /**
   * 일반 로그를 DB에 저장하고 메모리에서 제거
   */
  static async flush(): Promise<void> {
    if (this.logs.length === 0) {
      return;
    }
    
    try {
      const { generalRecordRepository } = await import('../repositories/general-record.repository');
      const { GameEventEmitter } = await import('../services/gameEventEmitter');
      
      // DB에 로그 저장 및 WebSocket 브로드캐스트
      for (const log of this.logs) {
        if (!log.generalId) continue;
        
        // action type에 따라 log_type 결정
        const logType = log.action.includes('history') ? 'history' : 'action';
        
        const savedLog = await generalRecordRepository.create({
          session_id: log.sessionId,
          general_id: log.generalId,
          log_type: logType,
          text: log.message,
          date: log.timestamp
        });
        
        // WebSocket으로 실시간 브로드캐스트
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
      
      // 로그 초기화
      this.logs = [];
    } catch (error) {
      logger.error('Failed to flush action logs:', error);
    }
  }

  /**
   * 국가 역사 로그를 DB에 저장하고 메모리에서 제거
   */
  static async flushNationalHistory(): Promise<void> {
    if (this.nationalHistoryLogs.length === 0) {
      return;
    }
    
    try {
      
      // await WorldHistory.insertMany(this.nationalHistoryLogs);
      
      // 로그 초기화
      this.nationalHistoryLogs = [];
    } catch (error) {
      logger.error('Failed to flush national history logs:', error);
    }
  }

  /**
   * 모든 로그 flush
   */
  static async flushAll(): Promise<void> {
    await Promise.all([
      this.flush(),
      this.flushNationalHistory()
    ]);
  }

  /**
   * 로그 통계 조회
   */
  static getStats(): { generalLogs: number; nationalLogs: number } {
    return {
      generalLogs: this.logs.length,
      nationalLogs: this.nationalHistoryLogs.length
    };
  }
}
