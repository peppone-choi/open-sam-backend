/**
 * WarUnitCity - 도시 수비 유닛
 * PHP sammo\WarUnitCity 직접 변환
 */

import { WarUnit } from './WarUnit';
import { RandUtil } from '../utils/RandUtil';
import { GameUnitConst, GameUnitDetail } from '../const/GameUnitConst';
import { Util } from '../utils/Util';
import { Json } from '../utils/Json';

/**
 * DummyGeneral - 도시 수비용 더미 장수
 */
class DummyGeneral {
  private data: any = {};
  private logger: any = null;
  private crewType: GameUnitDetail | null = null;
  
  constructor(private useLogger: boolean = false) {}
  
  setVar(key: string, value: any): void {
    this.data[key] = value;
  }
  
  getVar(key: string): any {
    return this.data[key];
  }
  
  initLogger(year: number, month: number): void {
    if (this.useLogger) {
      // ActionLogger 생성
      try {
        const { ActionLogger } = require('../services/logger/ActionLogger');
        this.logger = new ActionLogger(0, this.data.nation || 0, year, month, 'sangokushi_default', true);
      } catch (error) {
        console.error('DummyGeneral logger init failed:', error);
        this.logger = {
          pushGeneralActionLog: () => {},
          pushGlobalActionLog: () => {},
          pushGeneralHistoryLog: () => {},
          flush: async () => {}
        };
      }
    } else {
      this.logger = {
        pushGeneralActionLog: () => {},
        pushGlobalActionLog: () => {},
        pushGeneralHistoryLog: () => {},
        flush: async () => {}
      };
    }
  }
  
  getLogger(): any {
    return this.logger;
  }
  
  setCrewType(crewType: GameUnitDetail | null): void {
    this.crewType = crewType;
  }
  
  getRaw(): any {
    return this.data;
  }
}

export class WarUnitCity extends WarUnit {
  protected raw: any;
  protected hp: number;
  protected cityTrainAtmos: number;
  protected onSiege: boolean = false;
  
  // LazyVarUpdater 구현
  protected updatedValues: Record<string, any> = {};
  
  constructor(
    rng: RandUtil,
    raw: any,
    rawNation: any,
    year: number,
    month: number,
    startYear: number
  ) {
    const dummyGeneral = new DummyGeneral(false);
    dummyGeneral.setVar('city', raw.city);
    dummyGeneral.setVar('nation', raw.nation);
    dummyGeneral.initLogger(year, month);
    
    super(rng, dummyGeneral);
    
    this.raw = raw;
    this.rawNation = rawNation;
    this.isAttacker = false;
    
    // 도시 훈사: 181년 60, 201년 80, 221년 100, 231년 110(최대)
    this.cityTrainAtmos = Util.clamp(year - startYear + 59, 60, 110);
    
    this.logger = dummyGeneral.getLogger();
    
    // 성벽 병종
    this.crewType = GameUnitConst.byID(GameUnitConst.CREWTYPE_CASTLE || 1000);
    dummyGeneral.setCrewType(this.crewType);
    
    this.hp = (raw.def || 1000) * 10;
    
    // 수비자 보정
    const level = raw.level || 5;
    if (level === 1) {
      this.trainBonus += 5;
    } else if (level === 3) {
      this.trainBonus += 5;
    }
  }
  
  getCityTrainAtmos(): number {
    return this.cityTrainAtmos;
  }
  
  getName(): string {
    return this.getVar('name') || '도시';
  }
  
  getCityVar(key: string): any {
    return this.raw[key];
  }
  
  getComputedAttack(): number {
    const def = this.raw.def || 1000;
    const wall = this.raw.wall || 1000;
    return (def + wall * 9) / 500 + 200;
  }
  
  getComputedDefence(): number {
    const def = this.raw.def || 1000;
    const wall = this.raw.wall || 1000;
    return (def + wall * 9) / 500 + 200;
  }
  
  increaseKilled(damage: number): number {
    this.killed += damage;
    this.killedCurr += damage;
    return this.killed;
  }
  
  getComputedTrain(): number {
    return this.cityTrainAtmos + this.trainBonus;
  }
  
  getComputedAtmos(): number {
    return this.cityTrainAtmos + this.atmosBonus;
  }
  
  getHP(): number {
    return this.hp;
  }
  
  public override setSiege(): void {
    this.onSiege = true;
    this.currPhase = 0;
    this.prePhase = 0;
    this.bonusPhase = 0;
    this.isFinished = false;
    
    // 공성전에서는 병종 제거
    (this.general as DummyGeneral).setCrewType(null);
  }
  
  isSiege(): boolean {
    return this.onSiege;
  }
  
  getDex(crewType: GameUnitDetail): number {
    // 도시 숙련도: (도시훈사 - 60) * 7200
    return (this.cityTrainAtmos - 60) * 7200;
  }
  
  decreaseHP(damage: number): number {
    damage = Math.min(damage, this.hp);
    this.dead += damage;
    this.deadCurr += damage;
    this.hp -= damage;
    
    // 성벽 감소
    this.increaseVarWithLimit('wall', -damage / 20, 0);
    
    return this.hp;
  }
  
  continueWar(noRice: { value: boolean }): boolean {
    noRice.value = false;
    
    // 본 공성이 아닌 경우에는 한대만 맞아줌
    if (!this.onSiege) {
      return false;
    }
    
    // HP가 0이면 전투 불가
    if (this.getHP() <= 0) {
      return false;
    }
    
    // 도시 성벽은 쌀이 소모된다고 항복하지 않음
    return true;
  }
  
  heavyDecreaseWealth(): void {
    this.multiplyVar('agri', 0.5);
    this.multiplyVar('comm', 0.5);
    this.multiplyVar('secu', 0.5);
  }
  
  finishBattle(): void {
    this.clearActivatedSkill();
    this.isFinished = true;
    
    // HP를 방어도로 환산
    this.updateVar('def', Util.round(this.getHP() / 10));
    this.updateVar('wall', Util.round(this.getVar('wall')));
    
    if (this.isFinished || !this.onSiege) {
      return;
    }
    
    // 전투로 인한 도시 내구도 감소
    const decWealth = this.getKilled() / 20;
    this.increaseVarWithLimit('agri', -decWealth, 0);
    this.increaseVarWithLimit('comm', -decWealth, 0);
    this.increaseVarWithLimit('secu', -decWealth, 0);
  }
  
  addConflict(): boolean {
    let conflict = Json.decode(this.getVar('conflict') || '{}');
    const oppose = this.getOppose();
    
    if (!oppose) return false;
    
    const nationID = oppose.getNationVar('nation');
    let newConflict = false;
    
    let dead = Math.max(1, this.dead);
    
    // 선타, 막타 보너스
    if (!conflict || this.getHP() === 0) {
      dead *= 1.05;
    }
    
    if (!conflict || Object.keys(conflict).length === 0) {
      conflict = { [nationID]: dead };
    } else if (conflict[nationID] !== undefined) {
      conflict[nationID] += dead;
      // 내림차순 정렬
      conflict = Object.fromEntries(
        Object.entries(conflict).sort(([, a], [, b]) => (b as number) - (a as number))
      );
    } else {
      conflict[nationID] = dead;
      // 내림차순 정렬
      conflict = Object.fromEntries(
        Object.entries(conflict).sort(([, a], [, b]) => (b as number) - (a as number))
      );
      newConflict = true;
    }
    
    this.updateVar('conflict', Json.encode(conflict));
    
    return newConflict;
  }
  
  // LazyVarUpdater 구현
  public override updateVar(key: string, value: any): void {
    this.updatedValues[key] = value;
    this.raw[key] = value;
  }
  
  public override increaseVarWithLimit(key: string, value: number, min?: number, max?: number): void {
    const current = this.raw[key] || 0;
    let newVal = current + value;
    if (min !== undefined && newVal < min) newVal = min;
    if (max !== undefined && newVal > max) newVal = max;
    this.updateVar(key, newVal);
  }
  
  public override multiplyVar(key: string, value: number): void {
    const current = this.raw[key] || 0;
    this.updateVar(key, current * value);
  }
  
  getUpdatedValues(): Record<string, any> {
    return this.updatedValues;
  }
  
  flushUpdateValues(): void {
    this.updatedValues = {};
  }
  
  async applyDB(db: any): Promise<boolean> {
    const updateVals = this.getUpdatedValues();
    
    // 수비 도시의 로그는 기록하지 않음
    // this.getLogger()?.rollback?.();
    
    if (!updateVals || Object.keys(updateVals).length === 0) {
      return false;
    }
    
    try {
      const { cityRepository } = await import('../repositories/city.repository');
      const sessionId = this.raw.session_id || 'sangokushi_default';
      await cityRepository.updateByCityNum(sessionId, this.raw.city, updateVals);
      this.flushUpdateValues();
      return true;
    } catch (error) {
      console.error('WarUnitCity applyDB failed:', error);
      return false;
    }
  }
}
