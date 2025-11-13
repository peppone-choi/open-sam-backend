/**
 * 세션 데이터 동기화 유틸리티
 * 
 * MongoDB Session 문서의 여러 위치에 중복 저장된 데이터를 동기화합니다.
 * - session.field (최상위 레벨)
 * - session.data.field (data 레벨)
 * - session.data.game_env.field (game_env 레벨)
 */

export class SessionSync {
  /**
   * turnterm을 세션의 모든 위치에 동기화
   */
  static syncTurnterm(session: any, turnterm: number): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.turnterm = turnterm;
    session.data.turnterm = turnterm;
    session.data.game_env.turnterm = turnterm;
  }
  
  /**
   * year를 세션의 모든 위치에 동기화
   */
  static syncYear(session: any, year: number): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.year = year;
    session.data.year = year;
    session.data.game_env.year = year;
  }
  
  /**
   * month를 세션의 모든 위치에 동기화
   */
  static syncMonth(session: any, month: number): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.month = month;
    session.data.month = month;
    session.data.game_env.month = month;
  }
  
  /**
   * startyear를 세션의 모든 위치에 동기화
   */
  static syncStartyear(session: any, startyear: number): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.startyear = startyear;
    session.data.startyear = startyear;
    session.data.game_env.startyear = startyear;
    session.data.game_env.startYear = startyear; // 호환성
  }
  
  /**
   * starttime을 세션의 모든 위치에 동기화
   */
  static syncStarttime(session: any, starttime: Date | string): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    const starttimeISO = starttime instanceof Date ? starttime.toISOString() : starttime;
    const starttimeDate = starttime instanceof Date ? starttime : new Date(starttime);
    
    session.starttime = starttimeDate;
    session.data.starttime = starttimeISO;
    session.data.game_env.starttime = starttimeISO;
  }
  
  /**
   * turntime을 세션의 모든 위치에 동기화
   */
  static syncTurntime(session: any, turntime: Date | string): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    const turntimeISO = turntime instanceof Date ? turntime.toISOString() : turntime;
    const turntimeDate = turntime instanceof Date ? turntime : new Date(turntime);
    
    session.turntime = turntimeDate;
    session.data.turntime = turntimeISO;
    session.data.game_env.turntime = turntimeISO;
  }
  
  /**
   * isunited를 세션의 모든 위치에 동기화
   */
  static syncIsunited(session: any, isunited: number): void {
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.isunited = isunited;
    session.data.isunited = isunited;
    session.data.game_env.isunited = isunited;
  }
  
  /**
   * 모든 게임 데이터를 동기화
   */
  static syncAll(session: any, data: {
    turnterm?: number;
    year?: number;
    month?: number;
    startyear?: number;
    starttime?: Date | string;
    turntime?: Date | string;
    isunited?: number;
  }): void {
    if (data.turnterm !== undefined) this.syncTurnterm(session, data.turnterm);
    if (data.year !== undefined) this.syncYear(session, data.year);
    if (data.month !== undefined) this.syncMonth(session, data.month);
    if (data.startyear !== undefined) this.syncStartyear(session, data.startyear);
    if (data.starttime !== undefined) this.syncStarttime(session, data.starttime);
    if (data.turntime !== undefined) this.syncTurntime(session, data.turntime);
    if (data.isunited !== undefined) this.syncIsunited(session, data.isunited);
  }
}
