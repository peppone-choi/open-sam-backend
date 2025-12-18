// @ts-nocheck
import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';
import { LogFormatType, LogType } from '../../types/log.types';
import { logger } from '../../common/logger';

/**
 * 로그 엔트리 (년/월 포함)
 */
interface LogEntry {
  text: string;
  year: number;
  month: number;
}

/**
 * ActionLogger 클래스
 * 
 * PHP의 ActionLogger를 참고하여 구현
 * 장수/국가/전역 행동 로그를 메모리에 저장 후 일괄 flush
 * 
 * ✅ 성능 최적화: autoFlush 기본값 false, 배치 처리 지원
 * 
 * @example
 * const actionLogger = new ActionLogger(generalId, nationId, year, month, sessionId);
 * actionLogger.pushGeneralActionLog("쌀 1000석을 구입했습니다.", LogFormatType.MONTH);
 * actionLogger.setYearMonth(185, 2); // 년/월 변경 (배치 처리 시)
 * actionLogger.pushGeneralHistoryLog("시장에서 쌀 구입", LogFormatType.YEAR_MONTH);
 * await actionLogger.flush(); // 한번에 저장
 */
export class ActionLogger {
  // ✅ 성능 최적화: 년/월 정보를 함께 저장
  private generalHistoryLog: LogEntry[] = [];
  private generalActionLog: LogEntry[] = [];
  private generalBattleResultLog: LogEntry[] = [];
  private generalBattleDetailLog: LogEntry[] = [];
  private nationalHistoryLog: LogEntry[] = [];
  private globalHistoryLog: LogEntry[] = [];
  private globalActionLog: LogEntry[] = [];

  private autoFlush: boolean;
  private isFlushing: boolean = false; // 중복 flush 방지 플래그

  constructor(
    private generalId: number,
    private nationId: number,
    private year: number,
    private month: number,
    private sessionId: string = 'sangokushi_default',
    autoFlush: boolean = true // 기본값 true (호환성), 배치 처리 시 false 전달
  ) {
    this.autoFlush = autoFlush;
  }

  /**
   * ✅ 배치 모드 활성화/비활성화
   * 배치 모드에서는 autoFlush가 비활성화되고, 수동으로 flush() 호출 필요
   */
  setBatchMode(enabled: boolean): void {
    this.autoFlush = !enabled;
  }

  /**
   * ✅ 배치 처리 시 년/월 변경
   */
  setYearMonth(year: number, month: number): void {
    this.year = year;
    this.month = month;
  }

  /**
   * ✅ 현재 년도 반환
   */
  getYear(): number {
    return this.year;
  }

  /**
   * ✅ 현재 월 반환
   */
  getMonth(): number {
    return this.month;
  }

  /**
   * ✅ 현재 로그 개수 반환 (디버깅/모니터링용)
   */
  getLogCount(): number {
    return this.generalHistoryLog.length +
      this.generalActionLog.length +
      this.generalBattleResultLog.length +
      this.generalBattleDetailLog.length +
      this.nationalHistoryLog.length +
      this.globalHistoryLog.length +
      this.globalActionLog.length;
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
    this.generalHistoryLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.generalActionLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.generalBattleResultLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.generalBattleDetailLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.nationalHistoryLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.globalActionLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
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
    this.globalHistoryLog.push({ text: formatted, year: this.year, month: this.month });
    
    if (this.autoFlush) {
      this.flush().catch(err => logger.error('[ActionLogger] Auto-flush failed:', err));
    }
  }

  /**
   * 전투 결과 템플릿 로그
   * PHP ActionLogger.pushBattleResultTemplate() 이식
   * 전투 결과를 정형화된 형식으로 로그에 기록
   * PHP와 동일하게 battleResult, battleDetail, action 세 곳에 기록
   * 
   * @param me - 내 전투 유닛
   * @param oppose - 상대 전투 유닛
   */
  pushBattleResultTemplate(me: any, oppose: any): void {
    // 도시인 경우 전투 결과 로그 기록 안 함
    if (!me || me.constructor?.name === 'WarUnitCity') {
      return;
    }

    try {
      const myCrewType = me.getCrewTypeShortName?.() || me.getCrewTypeName?.() || '병사';
      const myName = me.getName?.() || '나';
      const myRemainCrew = me.getHP?.() || 0;
      const myKilledCrew = -(me.getDeadCurrentBattle?.() || me.getDead?.() || 0);

      const opposeCrewType = oppose?.getCrewTypeShortName?.() || oppose?.getCrewTypeName?.() || '적병';
      const opposeName = oppose?.getName?.() || '상대';
      const opposeRemainCrew = oppose?.getHP?.() || 0;
      const opposeKilledCrew = -(oppose?.getDeadCurrentBattle?.() || oppose?.getDead?.() || 0);

      // 전투 유형 결정
      let warType: string;
      let warTypeStr: string;
      if (!me.isAttacker?.()) {
        warType = 'defense';
        warTypeStr = '←';
      } else if (oppose?.constructor?.name === 'WarUnitCity') {
        warType = 'siege';
        warTypeStr = '→';
      } else {
        warType = 'attack';
        warTypeStr = '→';
      }

      // 전투 결과 텍스트 생성 (PHP small_war_log 템플릿 형식)
      const resultText = `【${warType === 'defense' ? '방어' : warType === 'siege' ? '공성' : '공격'}】 ${myName}(${myCrewType}) ${myRemainCrew}(${myKilledCrew >= 0 ? '+' : ''}${myKilledCrew}) ${warTypeStr} ${opposeName}(${opposeCrewType}) ${opposeRemainCrew}(${opposeKilledCrew >= 0 ? '+' : ''}${opposeKilledCrew})`;

      // PHP와 동일하게 세 곳에 기록
      this.pushGeneralBattleResultLog(resultText, LogFormatType.EVENT_YEAR_MONTH);
      this.pushGeneralBattleDetailLog(resultText, LogFormatType.EVENT_YEAR_MONTH);
      this.pushGeneralActionLog(resultText, LogFormatType.EVENT_YEAR_MONTH);
    } catch (error) {
      logger.error('[ActionLogger] pushBattleResultTemplate error:', error);
    }
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
        // PHP와 동일: 콜론 뒤에 공백 없음
        return `<C>●</>${this.year}년 ${this.month}월:${text}`;

      case LogFormatType.YEAR:
        return `<C>●</>${this.year}년:${text}`;

      case LogFormatType.MONTH:
        return `<C>●</>${this.month}월:${text}`;

      case LogFormatType.EVENT_PLAIN:
        return `<S>◆</>${text}`;

      case LogFormatType.EVENT_YEAR_MONTH:
        return `<S>◆</>${this.year}년 ${this.month}월:${text}`;

      case LogFormatType.NOTICE:
        return `<R>★</>${text}`;

      case LogFormatType.NOTICE_YEAR_MONTH:
        return `<R>★</>${this.year}년 ${this.month}월:${text}`;

      default:
        return text;
    }
  }

  /**
   * 로그 롤백 (예외 상황 처리용)
   */
  rollback(): {
    generalHistoryLog: LogEntry[];
    generalActionLog: LogEntry[];
    generalBattleResultLog: LogEntry[];
    generalBattleDetailLog: LogEntry[];
    nationalHistoryLog: LogEntry[];
    globalHistoryLog: LogEntry[];
    globalActionLog: LogEntry[];
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
   * 메모리의 모든 로그를 DB에 저장 (일괄 처리)
   * ✅ 성능 최적화: 배치 처리 완료 후 한번만 호출
   */
  async flush(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const totalLogs = this.getLogCount();

    try {
      // 각 로그 배열을 복사하고 원본 비우기
      const historyLogs = [...this.generalHistoryLog];
      const actionLogs = [...this.generalActionLog];
      const battleResultLogs = [...this.generalBattleResultLog];
      const battleDetailLogs = [...this.generalBattleDetailLog];
      const nationalLogs = [...this.nationalHistoryLog];
      const globalHistoryLogs = [...this.globalHistoryLog];
      const globalActionLogs = [...this.globalActionLog];

      // 원본 배열 비우기
      this.generalHistoryLog = [];
      this.generalActionLog = [];
      this.generalBattleResultLog = [];
      this.generalBattleDetailLog = [];
      this.nationalHistoryLog = [];
      this.globalHistoryLog = [];
      this.globalActionLog = [];

      // ✅ 성능 최적화: 모든 로그를 병렬로 저장
      const savePromises: Promise<void>[] = [];

      if (historyLogs.length > 0 && this.generalId) {
        savePromises.push(this.saveGeneralLogs(LogType.HISTORY, historyLogs));
      }
      if (actionLogs.length > 0 && this.generalId) {
        savePromises.push(this.saveGeneralLogs(LogType.ACTION, actionLogs));
      }
      if (battleResultLogs.length > 0 && this.generalId) {
        // PHP: log_type='battle_brief'
        savePromises.push(this.saveGeneralLogs(LogType.BATTLE_BRIEF, battleResultLogs));
      }
      if (battleDetailLogs.length > 0 && this.generalId) {
        // PHP: log_type='battle'
        savePromises.push(this.saveGeneralLogs(LogType.BATTLE, battleDetailLogs));
      }
      if (nationalLogs.length > 0 && this.nationId) {
        savePromises.push(this.saveNationLogs(nationalLogs));
      }
      if (globalHistoryLogs.length > 0) {
        savePromises.push(this.saveGlobalHistoryLogs(globalHistoryLogs));
      }
      if (globalActionLogs.length > 0) {
        savePromises.push(this.saveGlobalActionLogs(globalActionLogs));
      }

      await Promise.all(savePromises);

      if (totalLogs > 0) {
        logger.debug(`[ActionLogger] Flushed ${totalLogs} logs in batch`);
      }
    } catch (error: any) {
      logger.error('[ActionLogger] flush error:', error);
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 장수 로그 저장 (일괄 insert) → general_record
   * ✅ 성능 최적화: 각 로그에 저장된 년/월 사용
   */
  private async saveGeneralLogs(logType: LogType, logs: LogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((entry) => ({
      session_id: this.sessionId,
      general_id: this.generalId,
      log_type: logType,
      year: entry.year,
      month: entry.month,
      text: entry.text,
    }));

    const savedRecords = await GeneralRecord.insertMany(records);

    // WebSocket 브로드캐스트 (배치로 한번에)
    try {
      const { GameEventEmitter } = await import('../gameEventEmitter');
      // ✅ 배치 브로드캐스트 (마지막 로그만 전송하여 클라이언트가 새로고침하도록)
      if (savedRecords.length > 0) {
        const lastRecord = savedRecords[savedRecords.length - 1];
        const lastEntry = logs[logs.length - 1];
        GameEventEmitter.broadcastLogUpdate(
          this.sessionId,
          this.generalId,
          logType as 'action' | 'history',
          lastRecord._id?.toString() || lastRecord.id || 0,
          lastEntry.text,
          logs.length // 총 로그 개수 전달
        );
      }
    } catch (error) {
      // WebSocket 실패해도 계속 진행
    }

    logger.debug(`[ActionLogger] Saved ${logs.length} ${logType} logs for general ${this.generalId}`);
  }

  /**
   * 국가 로그 저장 → world_history (nation_id > 0)
   */
  private async saveNationLogs(logs: LogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((entry) => ({
      session_id: this.sessionId,
      nation_id: this.nationId,
      year: entry.year,
      month: entry.month,
      text: entry.text,
    }));

    await WorldHistory.insertMany(records);

    logger.debug(`[ActionLogger] Saved ${logs.length} nation history logs for nation ${this.nationId}`);
  }

  /**
   * 전역 이력 로그 저장 → world_history (nation_id = 0)
   * ✅ 성능 최적화: insertMany + ordered: false (중복 무시)
   */
  private async saveGlobalHistoryLogs(logs: LogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((entry) => ({
      session_id: this.sessionId,
      nation_id: 0,
      year: entry.year,
      month: entry.month,
      text: entry.text,
    }));

    try {
      // ✅ ordered: false로 중복 에러 무시하고 계속 진행
      await WorldHistory.insertMany(records, { ordered: false });
    } catch (error: any) {
      // BulkWriteError는 일부만 성공해도 발생
      if (error.code !== 11000 && !error.writeErrors) {
        throw error;
      }
      const successCount = error.insertedDocs?.length || (logs.length - (error.writeErrors?.length || 0));
      logger.debug(`[ActionLogger] Saved ${successCount}/${logs.length} global history logs (duplicates ignored)`);
      return;
    }

    logger.debug(`[ActionLogger] Saved ${logs.length} global history logs`);
  }

  /**
   * 전역 행동 로그 저장 → general_record (general_id = 0)
   */
  private async saveGlobalActionLogs(logs: LogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const records = logs.map((entry) => ({
      session_id: this.sessionId,
      general_id: 0,
      log_type: LogType.HISTORY,
      year: entry.year,
      month: entry.month,
      text: entry.text,
    }));

    const savedRecords = await GeneralRecord.insertMany(records);

    // WebSocket 브로드캐스트
    try {
      const { GameEventEmitter } = await import('../gameEventEmitter');
      if (savedRecords.length > 0) {
        const lastRecord = savedRecords[savedRecords.length - 1];
        const lastEntry = logs[logs.length - 1];
        GameEventEmitter.broadcastLogUpdate(
          this.sessionId,
          0,
          'history',
          lastRecord._id?.toString() || lastRecord.id || 0,
          lastEntry.text,
          logs.length
        );
      }
    } catch (error) {
      // WebSocket 실패해도 계속 진행
    }

    logger.debug(`[ActionLogger] Saved ${logs.length} global action logs`);
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
