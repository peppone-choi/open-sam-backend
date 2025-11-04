/**
 * DummyGeneral
 * 
 * 중립 경매 처리를 위한 더미 장수 객체
 * PHP DummyGeneral 클래스 이식
 */

import { IGeneral } from '../../models/general.model';
import { General } from '../../models/general.model';
// ActionLogger는 나중에 구현, 일단 any로 처리

export class DummyGeneral implements Partial<IGeneral> {
  // IGeneral 인터페이스의 필드들
  no: number = 0;
  session_id: string;
  owner: string = '';
  name: string = '중립 상인';
  picture?: string;
  custom_turn_hour?: number;
  custom_turn_minute?: number;
  aux?: Record<string, any> = {};
  rank?: Record<string, any> = {};
  special2?: string;
  turn_time?: number;
  turntime?: Date | string;
  npc?: number = 2;
  leadership?: number;
  strength?: number;
  intel?: number;
  nation?: number = 0;
  owner_name?: string;
  data: Record<string, any>;

  private logger: any | null = null;

  constructor(sessionId: string) {
    this.session_id = sessionId;
    this.data = {
      no: 0,
      name: '중립 상인',
      gold: 999999999,
      rice: 999999999,
      nation: 0,
      city: 0,
      npc: 2 // NPC 플래그
    };
  }

  getVar(key: string): any {
    return this.data[key];
  }

  setVar(key: string, value: any): void {
    this.data[key] = value;
  }

  increaseVar(key: string, amount: number): void {
    const current = this.data[key] || 0;
    this.data[key] = current + amount;
  }

  increaseVarWithLimit(key: string, amount: number, limit: number): void {
    const current = this.data[key] || 0;
    const newValue = current + amount;
    this.data[key] = Math.max(limit, newValue);
  }

  getID(): number {
    return 0;
  }

  getNationID(): number {
    return 0;
  }

  getCityID(): number {
    return 0;
  }

  getLogger(): any {
    // TODO: ActionLogger 구현
    if (!this.logger) {
      this.logger = {
        pushGlobalActionLog: () => {},
        formatText: (text: string) => text
      };
    }
    return this.logger;
  }

  getLastTurn(): any {
    return null;
  }

  getResultTurn(): any {
    return null;
  }

  _setResultTurn(turn: any): void {
    // 더미는 결과 턴이 필요 없음
  }

  getRawCity(): any {
    return null;
  }

  setRawCity(city: any): void {
    // 더미는 도시가 필요 없음
  }

  getStaticNation(): any {
    return {
      nation: 0,
      name: '중립',
      color: '#808080'
    };
  }

  addExperience(exp: number): void {
    // 더미는 경험치가 필요 없음
  }

  addDedication(ded: number): void {
    // 더미는 충성도가 필요 없음
  }

  async checkStatChange(): Promise<void> {
    // 더미는 스탯 변경이 필요 없음
  }

  async applyDB(db: any): Promise<void> {
    // 더미는 DB 저장이 필요 없음
  }

  markModified(path: string): void {
    // 더미는 수정 표시가 필요 없음
  }

  async save(): Promise<this> {
    return this;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }
}

