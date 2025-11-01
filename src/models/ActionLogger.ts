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

  constructor(generalID: number, nationID: number, year: number, month: number) {
    this.generalID = generalID;
    this.nationID = nationID;
    this.year = year;
    this.month = month;
  }

  pushGeneralActionLog(message: string, type?: number): void {}
  pushGeneralHistoryLog(message: string): void {}
  async flush(): Promise<void> {}

  static log(...args: any[]): void {}
}
