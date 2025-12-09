// @ts-nocheck - Mongoose model type compatibility issues
import { GeneralLog } from '../models/general-log.model';

export class ActionLogger {
  static readonly PLAIN = 1;
  static readonly NOTICE_YEAR_MONTH = 8;

  private generalNo: number;
  private nationID: number;
  private year: number;
  private month: number;
  private sessionId: string;

  private generalActionLogs: string[] = [];
  private generalHistoryLogs: string[] = [];
  private nationalHistoryLogs: string[] = [];
  private globalActionLogs: string[] = [];
  private globalHistoryLogs: string[] = [];
  private generalBattleLogs: string[][] = [];

  constructor(generalNo: number, nationID: number, year: number, month: number, sessionId: string = 'sangokushi_default') {
    this.generalNo = generalNo;
    this.nationID = nationID;
    this.year = year;
    this.month = month;
    this.sessionId = sessionId;
  }

  /**
   * 유니크 ID 생성 (타임스탬프 + 랜덤)
   */
  private generateId(): number {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  pushGeneralActionLog(message: string, style?: number): void {
    this.generalActionLogs.push(message);
  }

  pushGeneralHistoryLog(message: string): void {
    this.generalHistoryLogs.push(message);
  }

  pushNationalHistoryLog(message: string): void {
    this.nationalHistoryLogs.push(message);
  }

  pushGlobalActionLog(message: string): void {
    this.globalActionLogs.push(message);
  }

  pushGlobalHistoryLog(message: string): void {
    this.globalHistoryLogs.push(message);
  }

  pushGeneralBattleLog(...messages: string[]): void {
    this.generalBattleLogs.push(messages);
  }

  getGeneralActionLogs(): string[] {
    return this.generalActionLogs;
  }

  getGeneralHistoryLogs(): string[] {
    return this.generalHistoryLogs;
  }

  getNationalHistoryLogs(): string[] {
    return this.nationalHistoryLogs;
  }

  getGlobalActionLogs(): string[] {
    return this.globalActionLogs;
  }

  getGlobalHistoryLogs(): string[] {
    return this.globalHistoryLogs;
  }

  getGeneralBattleLogs(): string[][] {
    return this.generalBattleLogs;
  }

  async flush(): Promise<void> {
    try {
      // 장수 액션 로그 저장 (GeneralLog 모델 사용)
      for (const log of this.generalActionLogs) {
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: this.generalNo,
          log_type: 'action',
          message: log,
          data: { year: this.year, month: this.month },
          created_at: new Date()
        });
      }

      // 장수 히스토리 로그 저장
      for (const log of this.generalHistoryLogs) {
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: this.generalNo,
          log_type: 'history',
          message: log,
          data: { year: this.year, month: this.month },
          created_at: new Date()
        });
      }

      // 국가 히스토리 로그 저장
      for (const log of this.nationalHistoryLogs) {
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: 0,
          log_type: 'national_history',
          message: log,
          data: { year: this.year, month: this.month, nation_id: this.nationID },
          created_at: new Date()
        });
      }

      // 전역 액션 로그 저장 (general_id = 0)
      for (const log of this.globalActionLogs) {
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: 0,
          log_type: 'global_action',
          message: log,
          data: { year: this.year, month: this.month },
          created_at: new Date()
        });
      }

      // 전역 히스토리 로그 저장
      for (const log of this.globalHistoryLogs) {
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: 0,
          log_type: 'global_history',
          message: log,
          data: { year: this.year, month: this.month },
          created_at: new Date()
        });
      }

      // 전투 로그 저장
      for (const logs of this.generalBattleLogs) {
        const message = logs.join('\n');
        await GeneralLog.create({
          id: this.generateId(),
          session_id: this.sessionId,
          general_id: this.generalNo,
          log_type: 'battle',
          message: message,
          data: { year: this.year, month: this.month },
          created_at: new Date()
        });
      }
    } catch (error) {
      console.error('[ActionLogger] flush error:', error);
    }

    this.clear();
  }

  clear(): void {
    this.generalActionLogs = [];
    this.generalHistoryLogs = [];
    this.nationalHistoryLogs = [];
    this.globalActionLogs = [];
    this.globalHistoryLogs = [];
    this.generalBattleLogs = [];
  }

  hasLogs(): boolean {
    return (
      this.generalActionLogs.length > 0 ||
      this.generalHistoryLogs.length > 0 ||
      this.nationalHistoryLogs.length > 0 ||
      this.globalActionLogs.length > 0 ||
      this.globalHistoryLogs.length > 0 ||
      this.generalBattleLogs.length > 0
    );
  }

  getLogCount(): number {
    return (
      this.generalActionLogs.length +
      this.generalHistoryLogs.length +
      this.nationalHistoryLogs.length +
      this.globalActionLogs.length +
      this.globalHistoryLogs.length +
      this.generalBattleLogs.length
    );
  }
}
