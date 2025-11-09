// @ts-nocheck
import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';
import { LogFormatType, LogType } from '../../types/log.types';
import { logger } from '../../common/logger';

/**
 * ActionLogger 클래스
 * 
 * PHP의 ActionLogger를 참고하여 구현
 * 장수/국가/전역 행동 로그를 메모리에 저장 후 일괄 flush
 * 
 * @example
 * const logger = new ActionLogger(generalId, nationId, year, month, sessionId);
 * logger.pushGeneralActionLog("쌀 1000석을 구입했습니다.", LogFormatType.MONTH);
 * logger.pushGeneralHistoryLog("시장에서 쌀 구입", LogFormatType.YEAR_MONTH);
 * await logger.flush();
 */
export class ActionLogger {
  private generalHistoryLog: string[] = [];
  private generalActionLog: string[] = [];
  private generalBattleResultLog: string[] = [];
  private generalBattleDetailLog: string[] = [];
  private nationalHistoryLog: string[] = [];
  private globalHistoryLog: string[] = [];
  private globalActionLog: string[] = [];

  private autoFlush: boolean;

  constructor(
    private generalId: number,
    private nationId: number,
    private year: number,
    private month: number,
    private sessionId: string,
    autoFlush: boolean = true
  ) {
    this.autoFlush = autoFlush;
  }

  /**
   * 장수 이력 로그 추가
   * 중요한 행동의 요약 (예: "시장에서 쌀 구입", "적 장수 격파")
   */
  pushGeneralHistoryLog(text: string | string[], formatType: LogFormatType = LogFormatType.YEAR_MONTH): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGeneralHistoryLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.generalHistoryLog.push(formatted);
  }

  /**
   * 장수 행동 로그 추가
   * 상세한 행동 기록 (예: "쌀 1000석을 시장에서 구입했습니다.")
   */
  pushGeneralActionLog(text: string | string[], formatType: LogFormatType = LogFormatType.MONTH): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGeneralActionLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.generalActionLog.push(formatted);
  }

  /**
   * 전투 결과 로그 추가
   */
  pushGeneralBattleResultLog(text: string | string[], formatType: LogFormatType = LogFormatType.RAWTEXT): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGeneralBattleResultLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.generalBattleResultLog.push(formatted);
  }

  /**
   * 전투 상세 로그 추가
   */
  pushGeneralBattleDetailLog(text: string | string[], formatType: LogFormatType = LogFormatType.PLAIN): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGeneralBattleDetailLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.generalBattleDetailLog.push(formatted);
  }

  /**
   * 국가 이력 로그 추가
   */
  pushNationalHistoryLog(text: string | string[], formatType: LogFormatType = LogFormatType.YEAR_MONTH): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushNationalHistoryLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.nationalHistoryLog.push(formatted);
  }

  /**
   * 전역 행동 로그 추가
   */
  pushGlobalActionLog(text: string | string[], formatType: LogFormatType = LogFormatType.MONTH): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGlobalActionLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.globalActionLog.push(formatted);
  }

  /**
   * 전역 이력 로그 추가
   */
  pushGlobalHistoryLog(text: string | string[], formatType: LogFormatType = LogFormatType.YEAR_MONTH): void {
    if (!text) return;

    if (Array.isArray(text)) {
      text.forEach((item) => this.pushGlobalHistoryLog(item, formatType));
      return;
    }

    const formatted = this.formatText(text, formatType);
    this.globalHistoryLog.push(formatted);
  }

  /**
   * 텍스트 포맷팅
   * PHP의 formatText() 메서드를 참고
   */
  private formatText(text: string, formatType: LogFormatType): string {
    switch (formatType) {
      case LogFormatType.RAWTEXT:
        return text;

      case LogFormatType.PLAIN:
        return `<C>●</>${text}`;

      case LogFormatType.YEAR_MONTH:
        return `<C>●</>${this.year}년 ${this.month}월: ${text}`;

      case LogFormatType.YEAR:
        return `<C>●</>${this.year}년: ${text}`;

      case LogFormatType.MONTH:
        return `<C>●</>${this.month}월: ${text}`;

      case LogFormatType.EVENT_PLAIN:
        return `<S>◆</>${text}`;

      case LogFormatType.EVENT_YEAR_MONTH:
        return `<S>◆</>${this.year}년 ${this.month}월: ${text}`;

      case LogFormatType.NOTICE:
        return `<R>★</>${text}`;

      case LogFormatType.NOTICE_YEAR_MONTH:
        return `<R>★</>${this.year}년 ${this.month}월: ${text}`;

      default:
        return text;
    }
  }

  /**
   * 로그 롤백 (예외 상황 처리용)
   */
  rollback(): {
    generalHistoryLog: string[];
    generalActionLog: string[];
    generalBattleResultLog: string[];
    generalBattleDetailLog: string[];
    nationalHistoryLog: string[];
    globalHistoryLog: string[];
    globalActionLog: string[];
  } {
    const backup = {
      generalHistoryLog: [...this.generalHistoryLog],
      generalActionLog: [...this.generalActionLog],
      generalBattleResultLog: [...this.generalBattleResultLog],
      generalBattleDetailLog: [...this.generalBattleDetailLog],
      nationalHistoryLog: [...this.nationalHistoryLog],
      globalHistoryLog: [...this.globalHistoryLog],
      globalActionLog: [...this.globalActionLog],
    };

    this.generalHistoryLog = [];
    this.generalActionLog = [];
    this.generalBattleResultLog = [];
    this.generalBattleDetailLog = [];
    this.nationalHistoryLog = [];
    this.globalHistoryLog = [];
    this.globalActionLog = [];

    return backup;
  }

  /**
   * 메모리의 모든 로그를 DB에 저장
   * autoFlush가 true면 자동으로 호출됨
   */
  async flush(): Promise<void> {
    try {
      // 장수 이력 로그
      if (this.generalHistoryLog.length > 0 && this.generalId) {
        await this.saveGeneralLogs(LogType.HISTORY, this.generalHistoryLog);
        this.generalHistoryLog = [];
      }

      // 장수 행동 로그
      if (this.generalActionLog.length > 0 && this.generalId) {
        await this.saveGeneralLogs(LogType.ACTION, this.generalActionLog);
        this.generalActionLog = [];
      }

      // 전투 결과 로그
      if (this.generalBattleResultLog.length > 0 && this.generalId) {
        await this.saveGeneralLogs(LogType.BATTLE_RESULT, this.generalBattleResultLog);
        this.generalBattleResultLog = [];
      }

      // 전투 상세 로그
      if (this.generalBattleDetailLog.length > 0 && this.generalId) {
        await this.saveGeneralLogs(LogType.BATTLE_DETAIL, this.generalBattleDetailLog);
        this.generalBattleDetailLog = [];
      }

      // 국가 이력 로그 → world_history (nation_id > 0)
      if (this.nationalHistoryLog.length > 0 && this.nationId) {
        await this.saveNationLogs(this.nationalHistoryLog);
        this.nationalHistoryLog = [];
      }

      // 전역 이력 로그 → world_history (nation_id = 0)
      if (this.globalHistoryLog.length > 0) {
        await this.saveGlobalHistoryLogs(this.globalHistoryLog);
        this.globalHistoryLog = [];
      }

      // 전역 행동 로그 → general_record (general_id = 0, log_type = 'history')
      // PHP: pushGlobalActionLog는 general_record에 저장
      if (this.globalActionLog.length > 0) {
        await this.saveGlobalActionLogs(this.globalActionLog);
        this.globalActionLog = [];
      }
    } catch (error: any) {
      logger.error('[ActionLogger] flush error:', error);
      throw error;
    }
  }

  /**
   * 장수 로그 저장 (일괄 insert) → general_record
   */
  private async saveGeneralLogs(logType: LogType, logs: string[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((text) => ({
      session_id: this.sessionId,
      general_id: this.generalId,
      log_type: logType,
      year: this.year,
      month: this.month,
      text: text,
    }));

    // 일괄 insert
    await GeneralRecord.insertMany(records);

    logger.info(`[ActionLogger] Saved ${logs.length} ${logType} logs for general ${this.generalId}`);
  }

  /**
   * 국가 로그 저장 → world_history (nation_id > 0)
   */
  private async saveNationLogs(logs: string[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((text) => ({
      session_id: this.sessionId,
      nation_id: this.nationId,
      year: this.year,
      month: this.month,
      text: text,
    }));

    await WorldHistory.insertMany(records);

    logger.info(`[ActionLogger] Saved ${logs.length} nation history logs for nation ${this.nationId}`);
  }

  /**
   * 전역 이력 로그 저장 → world_history (nation_id = 0)
   */
  private async saveGlobalHistoryLogs(logs: string[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((text) => ({
      session_id: this.sessionId,
      nation_id: 0, // 전역 = 0
      year: this.year,
      month: this.month,
      text: text,
    }));

    await WorldHistory.insertMany(records);

    logger.info(`[ActionLogger] Saved ${logs.length} global history logs`);
  }

  /**
   * 전역 행동 로그 저장 → general_record (general_id = 0)
   * PHP: pushGlobalActionLog는 general_record에 저장
   */
  private async saveGlobalActionLogs(logs: string[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((text) => ({
      session_id: this.sessionId,
      general_id: 0, // 전역 = 0
      log_type: LogType.HISTORY, // PHP와 동일하게 'history' 타입
      year: this.year,
      month: this.month,
      text: text,
    }));

    await GeneralRecord.insertMany(records);

    logger.info(`[ActionLogger] Saved ${logs.length} global action logs`);
  }

  /**
   * 자동 flush (destructor 역할)
   * Node.js에는 destructor가 없으므로 명시적으로 호출 필요
   */
  async destroy(): Promise<void> {
    if (this.autoFlush) {
      await this.flush();
    }
  }
}
