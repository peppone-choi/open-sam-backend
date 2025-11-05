import { logger } from '../common/logger';

interface LogEntry {
  timestamp: Date;
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

  /**
   * 일반 액션 로그 기록
   */
  static log(generalId: number | undefined, action: string, message: string, type: string = ActionLogger.PLAIN): void {
    const entry: LogEntry = {
      timestamp: new Date(),
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
    type: string = ActionLogger.PLAIN
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
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
      // TODO: DB에 로그 저장 (GeneralLog 모델)
      // await GeneralLog.insertMany(this.logs);
      
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
      // TODO: DB에 국가 역사 로그 저장 (WorldHistory 모델)
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
