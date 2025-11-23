/**
 * GeneralAdapter
 * 
 * Plain Object를 IGeneral 인터페이스처럼 사용할 수 있게 해주는 어댑터
 * Mongoose Document와 Plain Object 모두 지원
 */

import { buildItemClass, ItemSlot } from '../utils/item-class';

export class GeneralAdapter {
  private raw: any;

  constructor(data: any) {
    // Mongoose Document이거나 Plain Object 모두 받을 수 있음
    this.raw = data;
  }

  // IGeneral 인터페이스 메서드 구현
  getVar(key: string): any {
    // Mongoose Document 메서드가 있으면 사용
    if (typeof this.raw.getVar === 'function') {
      return this.raw.getVar(key);
    }
    // Plain Object면 직접 접근
    return this.raw.data?.[key];
  }

  setVar(key: string, value: any): void {
    if (typeof this.raw.setVar === 'function') {
      this.raw.setVar(key, value);
    } else {
      if (!this.raw.data) this.raw.data = {};
      this.raw.data[key] = value;
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  increaseVar(key: string, amount: number): void {
    if (typeof this.raw.increaseVar === 'function') {
      this.raw.increaseVar(key, amount);
    } else {
      if (!this.raw.data) this.raw.data = {};
      if (!this.raw.data[key]) this.raw.data[key] = 0;
      this.raw.data[key] += amount;
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  increaseVarWithLimit(key: string, amount: number, limit: number): void {
    if (typeof this.raw.increaseVarWithLimit === 'function') {
      this.raw.increaseVarWithLimit(key, amount, limit);
    } else {
      if (!this.raw.data) this.raw.data = {};
      if (!this.raw.data[key]) this.raw.data[key] = 0;
      this.raw.data[key] += amount;
      if (amount > 0) {
        this.raw.data[key] = Math.min(this.raw.data[key], limit);
      } else {
        this.raw.data[key] = Math.max(this.raw.data[key], limit);
      }
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  getItem(slot: ItemSlot = 'item'): any {
    if (typeof this.raw.getItem === 'function') {
      return this.raw.getItem(slot);
    }
    const code = this.raw.data?.[slot] || 'None';
    return buildItemClass(code, { slot });
  }

  getItems(): Record<ItemSlot, any> {
    const result: Record<ItemSlot, any> = {} as Record<ItemSlot, any>;
    for (const slot of ['item', 'weapon', 'book', 'horse'] as ItemSlot[]) {
      result[slot] = this.getItem(slot);
    }
    return result;
  }

  setItem(slot: ItemSlot, itemCode: string | null): void {
    if (typeof this.raw.setItem === 'function') {
      this.raw.setItem(slot, itemCode);
      return;
    }
    if (!this.raw.data) {
      this.raw.data = {};
    }
    this.raw.data[slot] = itemCode ?? 'None';
    if (typeof this.raw.markModified === 'function') {
      this.raw.markModified('data');
    }
  }

  deleteItem(slot: ItemSlot = 'item'): void {
    if (typeof this.raw.deleteItem === 'function') {
      this.raw.deleteItem(slot);
      return;
    }
    this.setItem(slot, 'None');
  }

  getID(): number {
    if (typeof this.raw.getID === 'function') {
      return this.raw.getID();
    }
    return this.raw.no || this.raw.data?.no;
  }

  getNationID(): number {
    if (typeof this.raw.getNationID === 'function') {
      return this.raw.getNationID();
    }
    return this.raw.data?.nation || this.raw.nation || 0;
  }

  getCityID(): number {
    if (typeof this.raw.getCityID === 'function') {
      return this.raw.getCityID();
    }
    return this.raw.data?.city || this.raw.city || 0;
  }

  getSessionID(): string {
    if (typeof this.raw.getSessionID === 'function') {
      return this.raw.getSessionID();
    }
    return this.raw.session_id;
  }

  getLogger(): any {
    // 1) BaseCommand에서 주입한 logger가 있으면 우선 사용
    if ((this as any).__currentLogger) {
      return (this as any).__currentLogger;
    }
    if (this.raw && this.raw.__currentLogger) {
      return this.raw.__currentLogger;
    }

    // 2) General 모델이 자체 getLogger를 제공하면 그대로 사용
    if (typeof this.raw.getLogger === 'function') {
      const rawLogger = this.raw.getLogger();
      // BaseCommand가 아닌 경로에서도 재사용할 수 있도록 캐싱
      (this as any).__currentLogger = rawLogger;
      return rawLogger;
    }
    
    // 3) 최후 fallback: 간단한 logger 구현 (디버그용)
    const generalID = this.getID();
    const logs: string[] = [];
    
    return {
      pushGeneralActionLog: (message: string) => {
        console.log(`[General ${generalID}] ${message}`);
        logs.push(message);
      },
      
      flush: async () => {
        if (logs.length === 0) return;
        
        try {
          const { GeneralRecord } = await import('../models/general_record.model');
          const { sessionRepository } = await import('../repositories/session.repository');
          
          // session_id와 year, month 가져오기
          const sessionId = this.raw.session_id;
          const session = await sessionRepository.findBySessionId(sessionId);
          const year = session?.data?.year || session?.data?.game_env?.year || 184;
          const month = session?.data?.month || session?.data?.game_env?.month || 1;
          
          // MongoDB GeneralRecord에 삽입
          const records = logs.map(text => ({
            session_id: sessionId,
            general_id: generalID,
            log_type: 'action',
            year: year,
            month: month,
            text: text,
            created_at: new Date()
          }));
          
          await GeneralRecord.insertMany(records as any);
          logs.length = 0; // 로그 초기화
          
          console.log(`[Logger] Saved ${records.length} action logs for general ${generalID} (session: ${sessionId})`);
        } catch (error: any) {
          console.error('Failed to save action logs:', error);
        }
      }
    };
  }

  getLastTurn(): any {
    if (typeof this.raw.getLastTurn === 'function') {
      return this.raw.getLastTurn();
    }
    return this.raw.data?.last_turn || { command: '휴식', arg: null, term: 0 };
  }

  getResultTurn(): any {
    if (typeof this.raw.getResultTurn === 'function') {
      return this.raw.getResultTurn();
    }
    return this.raw.data?.result_turn || { command: '휴식', arg: null, term: 0 };
  }

  _setResultTurn(turn: any): void {
    if (typeof this.raw._setResultTurn === 'function') {
      this.raw._setResultTurn(turn);
    } else {
      if (!this.raw.data) this.raw.data = {};
      this.raw.data.result_turn = turn;
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  getRawCity(): any {
    if (typeof this.raw.getRawCity === 'function') {
      return this.raw.getRawCity();
    }
    return this.raw.data?._cached_city || this.raw._cached_city || null;
  }

  setRawCity(city: any): void {
    if (typeof this.raw.setRawCity === 'function') {
      this.raw.setRawCity(city);
    } else {
      if (!this.raw.data) this.raw.data = {};
      this.raw.data._cached_city = city;
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  getStaticNation(): any {
    if (typeof this.raw.getStaticNation === 'function') {
      return this.raw.getStaticNation();
    }
    return this.raw.data?._cached_nation || this.raw._cached_nation || {
      nation: 0,
      name: '재야',
      color: '#000000',
      type: 0,
      level: 0,
      capital: 0
    };
  }

  getTurnTime(format?: string): string {
    if (typeof this.raw.getTurnTime === 'function') {
      return this.raw.getTurnTime(format);
    }
    
    // Plain Object인 경우 직접 구현
    const turntime = this.raw.data?.turntime || this.raw.turntime;
    
    if (!turntime) {
      return '';
    }
    
    const date = turntime instanceof Date ? turntime : new Date(turntime);
    
    // 유효하지 않은 날짜 체크
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // PHP GeneralBase::getTurnTime(TURNTIME_HM)은 HH:MM만 반환한다.
    if (format === 'HM' || format === 'TURNTIME_HM') {
      return `${hours}:${minutes}`;
    }
    
    // 기본은 YYYY-MM-DD HH:MM:SS 형태(로컬 기준)로 반환
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  addExperience(exp: number): void {
    if (typeof this.raw.addExperience === 'function') {
      this.raw.addExperience(exp);
    } else {
      if (!this.raw.data) this.raw.data = {};
      if (!this.raw.data.experience) this.raw.data.experience = 0;
      this.raw.data.experience += exp;
      this.raw.data.explevel = Math.floor(this.raw.data.experience / 1000);
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  addDedication(ded: number): void {
    if (typeof this.raw.addDedication === 'function') {
      this.raw.addDedication(ded);
    } else {
      if (!this.raw.data) this.raw.data = {};
      if (!this.raw.data.dedication) this.raw.data.dedication = 0;
      this.raw.data.dedication += ded;
      if (typeof this.raw.markModified === 'function') {
        this.raw.markModified('data');
      }
    }
  }

  async checkStatChange(): Promise<void> {
    if (typeof this.raw.checkStatChange === 'function') {
      await this.raw.checkStatChange();
    }
    // Plain Object인 경우 아무것도 안 함
  }

  async applyDB(db: any): Promise<void> {
    if (typeof this.raw.applyDB === 'function') {
      await this.raw.applyDB(db);
    } else if (typeof this.raw.save === 'function') {
      await this.raw.save();
    }
  }

  markModified(path: string): void {
    if (typeof this.raw.markModified === 'function') {
      this.raw.markModified(path);
    }
  }

  async save(): Promise<any> {
    if (typeof this.raw.save === 'function') {
      return await this.raw.save();
    }
    // Plain Object인 경우 repository를 통해 저장해야 함
    // 하지만 여기서는 일단 스킵
    return this.raw;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (typeof this.raw.onCalcDomestic === 'function') {
      return this.raw.onCalcDomestic(turnType, varType, value, aux);
    }
    return value;
  }

  // 능력치 조회 메서드들
  getLeadership(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    if (typeof this.raw.getLeadership === 'function') {
      return this.raw.getLeadership(withInjury, withIActionObj, withStatAdjust, useFloor);
    }
    return this.getStatValue('leadership', withInjury, withIActionObj, withStatAdjust, useFloor);
  }

  getStrength(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    if (typeof this.raw.getStrength === 'function') {
      return this.raw.getStrength(withInjury, withIActionObj, withStatAdjust, useFloor);
    }
    return this.getStatValue('strength', withInjury, withIActionObj, withStatAdjust, useFloor);
  }

  getIntel(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    if (typeof this.raw.getIntel === 'function') {
      return this.raw.getIntel(withInjury, withIActionObj, withStatAdjust, useFloor);
    }
    return this.getStatValue('intel', withInjury, withIActionObj, withStatAdjust, useFloor);
  }

  getPolitics(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    if (typeof this.raw.getPolitics === 'function') {
      return this.raw.getPolitics(withInjury, withIActionObj, withStatAdjust, useFloor);
    }
    return this.getStatValue('politics', withInjury, withIActionObj, withStatAdjust, useFloor);
  }

  getCharm(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    if (typeof this.raw.getCharm === 'function') {
      return this.raw.getCharm(withInjury, withIActionObj, withStatAdjust, useFloor);
    }
    return this.getStatValue('charm', withInjury, withIActionObj, withStatAdjust, useFloor);
  }

  // 능력치 계산 헬퍼 메서드 (PHP getStatValue 로직)
  private getStatValue(statName: string, withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
    let statValue = this.getVar(statName) || 0;
    
    // 부상 적용
    if (withInjury) {
      const injury = this.getVar('injury') || 0;
      statValue *= (100 - injury) / 100;
    }
    
    // 능력치 상호 보정 (통무지정 시스템)
    if (withStatAdjust) {
      if (statName === 'strength') {
        // 무력 = 무력 + (지력 / 4)
        const intel = this.getStatValue('intel', withInjury, withIActionObj, false, false);
        statValue += Math.round(intel / 4);
      } else if (statName === 'intel') {
        // 지력 = 지력 + (무력 / 4)
        const strength = this.getStatValue('strength', withInjury, withIActionObj, false, false);
        statValue += Math.round(strength / 4);
      }
    }
    
    // 최대값 제한 (기본 150)
    const maxLevel = 150;
    statValue = Math.max(0, Math.min(statValue, maxLevel));
    
    // 정수로 반올림
    if (useFloor) {
      return Math.floor(statValue);
    }
    
    return statValue;
  }

  // 원본 데이터 접근 (필요한 경우)
  get data(): any {
    return this.raw.data || {};
  }

  get session_id(): string {
    return this.raw.session_id;
  }

  get no(): number {
    return this.raw.no || this.raw.data?.no;
  }

  get name(): string {
    return this.raw.name || this.raw.data?.name;
  }

  get nation(): number {
    return this.raw.data?.nation || this.raw.nation || 0;
  }

  get city(): number {
    return this.raw.data?.city || this.raw.city || 0;
  }

  get officer_level(): number {
    return this.raw.data?.officer_level || this.raw.officer_level || 0;
  }

  // 병종 정보 반환
  getCrewTypeObj(): any {
    if (typeof this.raw.getCrewTypeObj === 'function') {
      return this.raw.getCrewTypeObj();
    }
    
    // Plain Object면 crewtype으로 병종 정보 생성
    const crewtype = this.raw.data?.crewtype || this.raw.crewtype || 0;
    
    // GameUnitConst에서 병종 정보 로드
    return {
      id: crewtype,
      armType: Math.floor(crewtype / 1000) || 0,
      name: `Type${crewtype}`
    };
  }

  // 숙련도 증가
  addDex(crewTypeObj: any, amount: number, checkLimit: boolean = true): void {
    if (!crewTypeObj || crewTypeObj.id === undefined || crewTypeObj.id === null) {
      return;
    }

    if (typeof this.raw.addDex === 'function') {
      this.raw.addDex(crewTypeObj, amount, checkLimit);
      return;
    }
    
    // Plain Object 처리
    const dexKey = `dex${crewTypeObj.id}`;
    if (!this.raw.data) this.raw.data = {};
    if (!this.raw.data[dexKey]) this.raw.data[dexKey] = 0;
    
    this.raw.data[dexKey] += amount;
    
    if (checkLimit) {
      this.raw.data[dexKey] = Math.max(0, Math.min(this.raw.data[dexKey], 200));
    }
    
    if (typeof this.raw.markModified === 'function') {
      this.raw.markModified('data');
    }
  }

  // 내부 raw 객체 접근 (필요시)
  getRaw(): any {
    return this.raw;
  }
}
