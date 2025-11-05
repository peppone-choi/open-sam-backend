/**
 * DummySession - 더미 세션
 * NOTE: 실제 Session 구현 전까지 사용
 */

export class DummySession {
  private static instance: DummySession | null = null;
  private sessionInfo: Record<string, any> = {};

  private constructor() {
    this.sessionInfo = {
      userID: -1,
      userName: 'Dummy',
      ip: '127.0.0.1',
      time: Math.floor(Date.now() / 1000),
      userGrade: -1,
      acl: [],
      reqOTP: false,
      tokenValidUntil: '2999-12-31 23:59:59',
    };
  }

  static getInstance(): DummySession {
    if (DummySession.instance === null) {
      DummySession.instance = new DummySession();
    }
    return DummySession.instance;
  }

  restart(): this {
    this.sessionInfo = {};
    return this;
  }

  setReadOnly(): this {
    return this;
  }

  get(key: string): any {
    return this.sessionInfo[key] ?? null;
  }

  set(key: string, value: any): this {
    if (value === null) {
      delete this.sessionInfo[key];
    } else {
      this.sessionInfo[key] = value;
    }
    return this;
  }

  get userID(): number {
    return this.sessionInfo.userID ?? -1;
  }

  get userName(): string {
    return this.sessionInfo.userName ?? 'Dummy';
  }

  get generalID(): number | null {
    // TODO: UniqueConst 구현 필요
    return null;
  }

  get generalName(): string | null {
    // TODO: UniqueConst 구현 필요
    return null;
  }

  isLoggedIn(): boolean {
    return this.userID > 0;
  }

  isGameLoggedIn(): boolean {
    return this.generalID !== null && this.generalID > 0;
  }
}



