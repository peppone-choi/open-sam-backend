/**
 * Session - Express Request 기반 세션 관리
 * PHP Session 클래스를 Express.js 환경에 맞게 변환
 */

import { Request } from 'express';
import { Util } from './Util';

export interface SessionData {
  userID?: number;
  userName?: string;
  userGrade?: number;
  ip?: string;
  time?: number;
  reqOTP?: boolean;
  acl?: any[];
  tokenID?: number | null;
  tokenValidUntil?: string;
  generalID?: number | null;
  generalName?: string | null;
  [key: string]: any;
}

export class Session {
  static readonly PROTECTED_NAMES = new Set([
    'ip',
    'reqOTP',
    'time',
    'userID',
    'userName',
    'userGrade',
    'writeClosed',
    'generalID',
    'generalName',
    'tokenValidUntil',
    'acl',
  ]);

  static readonly GAME_KEY_DATE = '_g_loginDate';
  static readonly GAME_KEY_GENERAL_ID = '_g_no';
  static readonly GAME_KEY_GENERAL_NAME = '_g_name';
  static readonly GAME_KEY_EXPECTED_DEADTIME = '_g_deadtime';

  private req: Request;
  private writeClosed: boolean = false;

  private constructor(req: Request) {
    this.req = req;
    
    // 초기화
    if (!this.get('ip')) {
      this.set('ip', this.getClientIP(true));
      this.set('time', Math.floor(Date.now() / 1000));
    }
  }

  /**
   * Request에서 Session 인스턴스 가져오기
   */
  static getInstance(req: Request): Session {
    if (!req.session) {
      req.session = {} as any;
    }
    return new Session(req);
  }

  /**
   * 로그인 필요 검증
   */
  static requireLogin(req: Request): Session {
    const session = Session.getInstance(req);
    if (session.isLoggedIn()) {
      return session;
    }
    throw new Error('로그인이 필요합니다.');
  }

  /**
   * 게임 로그인 필요 검증
   */
  static requireGameLogin(req: Request): Session {
    const session = Session.requireLogin(req);
    session.loginGame();
    
    if (session.generalID) {
      return session;
    }
    throw new Error('게임 로그인이 필요합니다.');
  }

  /**
   * 클라이언트 IP 가져오기
   */
  private getClientIP(useXForwardedFor: boolean = false): string {
    if (useXForwardedFor) {
      const forwarded = this.req.headers['x-forwarded-for'];
      if (forwarded) {
        const ips = String(forwarded).split(',');
        return ips[0].trim();
      }
    }
    return this.req.ip || this.req.socket.remoteAddress || '127.0.0.1';
  }

  /**
   * 읽기 전용 모드 설정
   */
  setReadOnly(): this {
    this.writeClosed = true;
    return this;
  }

  /**
   * 값 가져오기
   */
  get(name: string): any {
    const session = this.req.session as SessionData;
    return session[name] ?? null;
  }

  /**
   * 값 설정
   */
  protected set(name: string, value: any): void {
    if (this.writeClosed) {
      return;
    }

    const session = this.req.session as SessionData;
    if (value === null) {
      delete session[name];
    } else {
      session[name] = value;
    }
  }

  /**
   * 로그인
   */
  login(
    userID: number,
    userName: string,
    grade: number,
    reqOTP: boolean,
    tokenValidUntil: string | null,
    tokenID: number | null,
    acl: any[]
  ): this {
    this.set('userID', userID);
    this.set('userName', userName);
    this.set('ip', this.getClientIP(true));
    this.set('time', Math.floor(Date.now() / 1000));
    this.set('userGrade', grade);
    this.set('acl', acl);
    this.set('reqOTP', reqOTP);
    this.set('tokenValidUntil', tokenValidUntil);
    this.set('tokenID', tokenID);
    return this;
  }

  /**
   * OTP 요구 설정
   */
  setReqOTP(reqOTP: boolean, tokenValidUntil: string): this {
    this.set('reqOTP', reqOTP);
    this.set('tokenValidUntil', tokenValidUntil);
    return this;
  }

  /**
   * 로그아웃
   */
  logout(): this {
    // 게임 로그아웃
    this.logoutGame();

    // TODO: 토큰 삭제 (데이터베이스에서)
    // if (this.tokenID) {
    //   RootDB::db()->delete('login_token', 'id = %i', this.tokenID);
    // }

    this.set('userID', null);
    this.set('userName', null);
    this.set('userGrade', null);
    this.set('acl', null);
    this.set('reqOTP', null);
    this.set('time', Math.floor(Date.now() / 1000));
    this.set('lastMsgGet', null);
    return this;
  }

  /**
   * 게임 로그인
   */
  loginGame(result?: { value: boolean }): this {
    const userID = this.userID;
    if (!userID) {
      if (result) {
        result.value = false;
      }
      return this;
    }

    // TODO: UniqueConst 구현 필요
    // const serverID = UniqueConst.$serverID;
    const serverID = 'default'; // 임시

    const globalLoginDate = this.get('time');
    const loginDate = this.get(serverID + Session.GAME_KEY_DATE);
    const generalID = this.get(serverID + Session.GAME_KEY_GENERAL_ID);
    const generalName = this.get(serverID + Session.GAME_KEY_GENERAL_NAME);
    const deadTime = this.get(serverID + Session.GAME_KEY_EXPECTED_DEADTIME);

    const now = Math.floor(Date.now() / 1000);

    if (
      globalLoginDate &&
      loginDate &&
      globalLoginDate < loginDate &&
      generalID &&
      generalName &&
      loginDate + 1800 > now &&
      deadTime &&
      deadTime > now
    ) {
      // 로그인 정보는 30분간 유지
      if (result) {
        result.value = true;
      }
      return this;
    }

    // 게임 로그인 정보 초기화
    if (generalID || generalName || loginDate || deadTime) {
      this.logoutGame();
    }

    // TODO: 실제 게임 로그인 로직 구현
    // const general = DB::db()->queryFirstRow(...);
    // if (!general) {
    //   if (result) result.value = false;
    //   return this;
    // }

    // 임시로 -1 설정
    this.set(serverID + Session.GAME_KEY_DATE, now);
    this.set(serverID + Session.GAME_KEY_GENERAL_ID, -1);
    this.set(serverID + Session.GAME_KEY_GENERAL_NAME, 'DummyGeneral');
    this.set(serverID + Session.GAME_KEY_EXPECTED_DEADTIME, now + 60 * 60 * 24);

    if (result) {
      result.value = true;
    }

    return this;
  }

  /**
   * 게임 로그아웃
   */
  logoutGame(): this {
    // TODO: UniqueConst 구현 필요
    const serverID = 'default'; // 임시

    this.set(serverID + Session.GAME_KEY_DATE, null);
    this.set(serverID + Session.GAME_KEY_GENERAL_ID, null);
    this.set(serverID + Session.GAME_KEY_GENERAL_NAME, null);
    this.set(serverID + Session.GAME_KEY_EXPECTED_DEADTIME, null);

    return this;
  }

  /**
   * 로그인 여부 확인
   */
  isLoggedIn(): boolean {
    return !!this.userID && this.userID > 0;
  }

  /**
   * 게임 로그인 여부 확인
   */
  isGameLoggedIn(): boolean {
    return !!this.generalID && this.generalID > 0;
  }

  // Getters
  get userID(): number | null {
    return this.get('userID') ?? null;
  }

  get userName(): string | null {
    return this.get('userName') ?? null;
  }

  get userGrade(): number | null {
    return this.get('userGrade') ?? null;
  }

  get ip(): string {
    return this.get('ip') || '127.0.0.1';
  }

  get reqOTP(): boolean {
    return this.get('reqOTP') || false;
  }

  get acl(): any[] {
    return this.get('acl') || [];
  }

  get tokenID(): number | null {
    return this.get('tokenID') ?? null;
  }

  get tokenValidUntil(): string | null {
    return this.get('tokenValidUntil') ?? null;
  }

  get generalID(): number | null {
    // TODO: UniqueConst 구현 필요
    const serverID = 'default'; // 임시
    return this.get(serverID + Session.GAME_KEY_GENERAL_ID) ?? null;
  }

  get generalName(): string | null {
    // TODO: UniqueConst 구현 필요
    const serverID = 'default'; // 임시
    return this.get(serverID + Session.GAME_KEY_GENERAL_NAME) ?? null;
  }

  // 동적 속성 접근 (보호된 이름은 제외)
  __set(name: string, value: any): void {
    if (Session.PROTECTED_NAMES.has(name)) {
      console.warn(`${name}은 외부에서 쓰기 금지된 Session 변수입니다.`);
      return;
    }
    this.set(name, value);
  }
}

// Express Request에 session 속성 추가
declare module 'express-serve-static-core' {
  interface Request {
    session?: SessionData;
  }
}



