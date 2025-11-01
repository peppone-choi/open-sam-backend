import { DB } from '../config/db';

export class ActionLogger {
  static readonly PLAIN = 1;

  private generalNo: number;
  private nationID: number;
  private year: number;
  private month: number;

  private generalActionLogs: string[] = [];
  private generalHistoryLogs: string[] = [];
  private nationalHistoryLogs: string[] = [];
  private globalActionLogs: string[] = [];
  private globalHistoryLogs: string[] = [];
  private generalBattleLogs: string[][] = [];

  constructor(generalNo: number, nationID: number, year: number, month: number) {
    this.generalNo = generalNo;
    this.nationID = nationID;
    this.year = year;
    this.month = month;
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
    const db = DB.db();
    
    for (const log of this.generalActionLogs) {
      await db.insert('general_action_log', {
        general_no: this.generalNo,
        year: this.year,
        month: this.month,
        message: log,
        created_at: new Date()
      });
    }

    for (const log of this.generalHistoryLogs) {
      await db.insert('general_history_log', {
        general_no: this.generalNo,
        year: this.year,
        month: this.month,
        message: log,
        created_at: new Date()
      });
    }

    for (const log of this.nationalHistoryLogs) {
      await db.insert('national_history_log', {
        nation_id: this.nationID,
        year: this.year,
        month: this.month,
        message: log,
        created_at: new Date()
      });
    }

    for (const log of this.globalActionLogs) {
      await db.insert('global_action_log', {
        year: this.year,
        month: this.month,
        message: log,
        created_at: new Date()
      });
    }

    for (const log of this.globalHistoryLogs) {
      await db.insert('global_history_log', {
        year: this.year,
        month: this.month,
        message: log,
        created_at: new Date()
      });
    }

    for (const logs of this.generalBattleLogs) {
      const message = logs.join('\n');
      await db.insert('general_battle_log', {
        general_no: this.generalNo,
        year: this.year,
        month: this.month,
        message: message,
        created_at: new Date()
      });
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
