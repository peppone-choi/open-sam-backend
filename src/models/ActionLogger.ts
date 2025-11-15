import { GeneralRecord } from './general_record.model';

export class ActionLogger {
  static RAWTEXT = 0;
  static PLAIN = 1;
  static YEAR_MONTH = 2;
  static YEAR = 3;
  static MONTH = 4;
  static EVENT_PLAIN = 5;
  static EVENT_YEAR_MONTH = 6;
  static NOTICE = 7;
  static NOTICE_YEAR_MONTH = 8;

  private generalID: number;
  private nationID: number;
  private year: number;
  private month: number;
  private actionLogs: Array<{ message: string; type: number }> = [];
  private historyLogs: Array<string> = [];
  private sessionId: string;
  private autoFlush: boolean;

  constructor(generalID: number, nationID: number, year: number, month: number, sessionId: string = 'sangokushi_default', autoFlush: boolean = true) {
    this.generalID = generalID;
    this.nationID = nationID;
    this.year = year;
    this.month = month;
    this.sessionId = sessionId;
    this.autoFlush = autoFlush;
  }

  pushGeneralActionLog(message: string, type: number = ActionLogger.YEAR_MONTH): void {
    this.actionLogs.push({ message, type });
    if (this.autoFlush) {
      this.flush().catch(err => console.error('[ActionLogger] Auto-flush failed:', err));
    }
  }

  pushGeneralHistoryLog(message: string): void {
    this.historyLogs.push(message);
    if (this.autoFlush) {
      this.flush().catch(err => console.error('[ActionLogger] Auto-flush failed:', err));
    }
  }

  async flush(): Promise<void> {
    const records = [];
    
    // Action logs
    for (const log of this.actionLogs) {
      const text = this.formatMessage(log.message, log.type);
      records.push({
        session_id: this.sessionId,
        general_id: this.generalID,
        log_type: 'action',
        year: this.year,
        month: this.month,
        text,
        created_at: new Date()
      });
    }
    
    // History logs
    for (const message of this.historyLogs) {
      records.push({
        session_id: this.sessionId,
        general_id: this.generalID,
        log_type: 'history',
        year: this.year,
        month: this.month,
        text: message,
        created_at: new Date()
      });
    }
    
    if (records.length > 0) {
      try {
        await GeneralRecord.insertMany(records);
      } catch (error) {
        console.error('[ActionLogger] Failed to save logs:', error);
      }
    }
    
    // Clear logs after flush
    this.actionLogs = [];
    this.historyLogs = [];
  }

  private formatMessage(message: string, type: number): string {
    switch (type) {
      case ActionLogger.YEAR_MONTH:
        return `${message} <1>${this.year}년 ${this.month}월</>`;
      case ActionLogger.YEAR:
        return `${message} <1>${this.year}년</>`;
      case ActionLogger.MONTH:
        return `${message} <1>${this.month}월</>`;
      case ActionLogger.PLAIN:
      case ActionLogger.RAWTEXT:
      default:
        return message;
    }
  }

  static log(...args: any[]): void {
    console.log('[ActionLogger]', ...args);
  }
}
