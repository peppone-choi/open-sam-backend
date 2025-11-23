import mongoose, { Schema, Document, Model } from 'mongoose';
import { ActionLogger } from '../services/logger/ActionLogger';
import { LogFormatType } from '../types/log.types';
import type { GameAction } from '../game/actions/Action';
import { getSpecialWarAction } from '../game/specialWar/specialWarRegistry';
import { NationTypeAction } from '../game/actions/adapters/NationTypeAction';
import { buildNationTypeClass } from '../core/nation-type/NationTypeFactory';
import type { WarUnit } from '../battle/WarUnit';
import { WarUnitTriggerCaller } from '../game/triggers/WarUnitTriggerCaller';
import { InheritanceKey, InheritancePointUtil } from '../Enums/InheritanceKey';

// 장수 인터페이스
export interface IGeneral extends Document {
  no: number;
  session_id: string;
  owner: string;
  
  // 기본 정보
  name: string;
  picture?: string;
  
  // 턴제 전용
  custom_turn_hour?: number;
  custom_turn_minute?: number;
  
  // 추가 필드
  aux?: Record<string, any>;
  rank?: Record<string, any>;
  special2?: string;
  turn_time?: number;
  turntime?: Date | string;
  npc?: number;
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
  charm?: number;
  nation?: number;
  city?: number;
  owner_name?: string;
  
  // 완전 동적 데이터 (모든 것이 세션 설정에 따라 다름!)
  data: Record<string, any>;
  // 예시:
  // {
  //   // 자원 (resources)
  //   gold: 10000,
  //   rice: 5000,
  //   crew: 0,
  //   crewtype: 0,
  //   
  //   // 능력치 (attributes)
  //   leadership: 80,
  //   strength: 75,
  //   intel: 85,
  //   leadership_exp: 0,
  //   strength_exp: 0,
  //   intel_exp: 0,
  //   experience: 0,
  //   dedication: 0,
  //   train: 0,
  //   atmos: 0,
  //   injury: 0,
  //   
  //   // 게임 로직 필드 (하드코딩 아님!)
  //   nation: 1,
  //   city: 10,
  //   officer_level: 12,
  //   troop: 0,
  //   weapon: 'None',
  //   book: 'None',
  //   horse: 'None',
  //   special: 'None',
  //   personal: 'None'
  // }
  
  // 헬퍼 메서드
  getVar(key: string): any;
  setVar(key: string, value: any): void;
  increaseVar(key: string, amount: number): void;
  increaseVarWithLimit(key: string, amount: number, limit: number): void;
  getID(): number;
  getNationID(): number;
  getCityID(): number;
  getLogger(): any;
  getLastTurn(): any;
  getResultTurn(): any;
  _setResultTurn(turn: any): void;
  getRawCity(): any;
  setRawCity(city: any): void;
  getStaticNation(): any;
  getTurnTime(format?: string): string;
  addExperience(exp: number): void;
  addDedication(ded: number): void;
  checkStatChange(): Promise<void>;
  applyDB(db: any): Promise<void>;
  markModified(path: string): void;
  save(): Promise<this>;
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number;
  getActionList(): GameAction[];
  getBattleActionList(): GameAction[];
  onCalcStat(general: any, statName: string, value: any, aux?: any): any;
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any;
  getWarPowerMultiplier(unit: WarUnit): [number, number];
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null;
  getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null;
  increaseInheritancePoint(key: InheritanceKey | string, amount?: number): Promise<void>;
  getInheritancePoint(key: InheritanceKey | string): number;
  getAllInheritancePoints(): Record<string, number>;
  resetInheritancePoints(): void;
  getTotalInheritancePoint(): number;
  
  // 능력치 조회 메서드 (통무지정매)

  getLeadership(withInjury?: boolean, withIActionObj?: boolean, withStatAdjust?: boolean, useFloor?: boolean): number;
  getStrength(withInjury?: boolean, withIActionObj?: boolean, withStatAdjust?: boolean, useFloor?: boolean): number;
  getIntel(withInjury?: boolean, withIActionObj?: boolean, withStatAdjust?: boolean, useFloor?: boolean): number;
  getPolitics(withInjury?: boolean, withIActionObj?: boolean, withStatAdjust?: boolean, useFloor?: boolean): number;
  getCharm(withInjury?: boolean, withIActionObj?: boolean, withStatAdjust?: boolean, useFloor?: boolean): number;
}

// Static 메서드 타입 정의
export interface IGeneralModel extends Model<IGeneral> {
  createObjFromDB(generalID: number, sessionId?: string): Promise<IGeneral>;
}

const GeneralSchema = new Schema<IGeneral>({
  no: { type: Number, required: true },
  session_id: { type: String, required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  picture: { type: String },
  
  custom_turn_hour: { type: Number },
  custom_turn_minute: { type: Number },
  
  aux: { type: Schema.Types.Mixed, default: {} },
  rank: { type: Schema.Types.Mixed, default: {} },
  special2: { type: String },
  turn_time: { type: Number },
  turntime: { type: Date },
  npc: { type: Number, default: 0 },
  leadership: { type: Number },
  strength: { type: Number },
  intel: { type: Number },
  politics: { type: Number },
  charm: { type: Number },
  nation: { type: Number },
  city: { type: Number },
  owner_name: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

GeneralSchema.index({ session_id: 1, no: 1 }, { unique: true });

// 메서드 추가 (PHP의 General 클래스 메서드들)
GeneralSchema.methods.getVar = function(key: string): any {
  return this.data?.[key];
};

GeneralSchema.methods.setVar = function(key: string, value: any): void {
  this.data[key] = value;
  this.markModified('data');
};

GeneralSchema.methods.increaseVar = function(key: string, amount: number): void {
  if (!this.data[key]) this.data[key] = 0;
  this.data[key] += amount;
  this.markModified('data');
};

GeneralSchema.methods.increaseVarWithLimit = function(key: string, amount: number, limit: number): void {
  if (!this.data[key]) this.data[key] = 0;
  this.data[key] += amount;
  if (amount > 0) {
    this.data[key] = Math.min(this.data[key], limit);
  } else {
    this.data[key] = Math.max(this.data[key], limit);
  }
  this.markModified('data');
};

GeneralSchema.methods.getID = function(): number {
  return this.no;
};

GeneralSchema.methods.getNationID = function(): number {
  return this.data.nation || 0;
};

GeneralSchema.methods.getCityID = function(): number {
  return this.data.city || 0;
};

GeneralSchema.methods.getSessionID = function(): string {
  return this.session_id;
};

GeneralSchema.methods.getLogger = function(): any {
  // BaseCommand에서 주입한 턴별 logger가 있으면 재사용 (중복 로그 방지)
  if (this.__currentLogger) {
    return this.__currentLogger;
  }
  
  // 폴백: BaseCommand 외부에서 호출된 경우 기본값으로 새 logger 생성
  const sessionId = this.session_id || 'sangokushi_default';
  const generalId = this.no || this.data?.no || 0;
  const nationId = this.data?.nation ?? this.nation ?? 0;
  
  // 기본 년/월 (실제 게임 턴 정보는 BaseCommand에서 주입됨)
  const year = 184;
  const month = 1;
  
  // 매번 새 인스턴스 반환 (캐싱 안 함)
  return new ActionLogger(generalId, nationId, year, month, sessionId, true);
};

GeneralSchema.methods.getLastTurn = function(): any {
  return this.data.last_turn || { command: '휴식', arg: null, term: 0 };
};

GeneralSchema.methods.getResultTurn = function(): any {
  return this.data.result_turn || { command: '휴식', arg: null, term: 0 };
};

GeneralSchema.methods._setResultTurn = function(turn: any): void {
  this.data.result_turn = turn;
  this.markModified('data');
};

GeneralSchema.methods.getRawCity = function(): any {
  return this.data._cached_city || null;
};

GeneralSchema.methods.setRawCity = function(city: any): void {
  this.data._cached_city = city;
  this.markModified('data');
};

GeneralSchema.methods.getStaticNation = function(): any {
  return this.data._cached_nation || {
    nation: 0,
    name: '재야',
    color: '#000000',
    type: 0,
    level: 0,
    capital: 0
  };
};

/**
 * 턴타임을 포맷팅해서 반환
 * @param format - 'HM': 시:분, 'TURNTIME_HM': 풀 타임스탬프 + 시:분, 없으면 기본
 * @returns 포맷팅된 시간 문자열
 */
GeneralSchema.methods.getTurnTime = function(format?: string): string {
  // turntime은 data.turntime 또는 top-level turntime에 있을 수 있음
  const turntime = this.data?.turntime || this.turntime;
  
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
  
  if (format === 'HM') {
    return `${hours}:${minutes}`;
  } else if (format === 'TURNTIME_HM') {
    // ISO 형식 + 시:분
    return `${date.toISOString()} (${hours}:${minutes})`;
  } else {
    // 기본: ISO 형식
    return date.toISOString();
  }
};

GeneralSchema.methods.addExperience = function(exp: number): void {
  if (!this.data.experience) this.data.experience = 0;
  this.data.experience += exp;
  
  // 경험치를 기반으로 레벨 계산 (1000 경험치당 1레벨)
  this.data.explevel = Math.floor(this.data.experience / 1000);
  
  this.markModified('data');
};

GeneralSchema.methods.addDedication = function(ded: number): void {
  if (!this.data.dedication) this.data.dedication = 0;
  this.data.dedication += ded;
  this.markModified('data');
};

GeneralSchema.methods.checkStatChange = async function(): Promise<void> {
  // FUTURE: Implement stat change logic
};

GeneralSchema.methods.applyDB = async function(db: any): Promise<void> {
  await this.save();
};

type ActionCacheState = { key: string; actions: GameAction[] };

function resolveNationTypeKey(general: any): string | null {
  const nation = typeof general.getStaticNation === 'function' ? general.getStaticNation() : general.data?._cached_nation;
  const rawType = nation?.type ?? general.data?.nation_type ?? general.nation_type;
  if (!rawType) {
    return null;
  }
  return String(rawType);
}

function buildActionCacheKey(general: any): string {
  const specialKey = general.data?.special2 ?? general.special2 ?? 'None';
  const nationTypeKey = resolveNationTypeKey(general) ?? 'none';
  return `${specialKey || 'None'}|${nationTypeKey}`;
}

function createActionList(general: any): GameAction[] {
  const actions: GameAction[] = [];
  const specialKey = general.data?.special2 ?? general.special2 ?? 'None';
  actions.push(getSpecialWarAction(specialKey));

  const nationTypeKey = resolveNationTypeKey(general);
  if (nationTypeKey) {
    actions.push(new NationTypeAction(buildNationTypeClass(nationTypeKey)));
  }

  return actions;
}

GeneralSchema.methods.getActionList = function(): GameAction[] {
  const cacheKey = buildActionCacheKey(this);
  const cache = (this as any).__actionListCache as ActionCacheState | undefined;
  if (cache && cache.key === cacheKey) {
    return cache.actions;
  }
  const actions = createActionList(this);
  (this as any).__actionListCache = { key: cacheKey, actions } as ActionCacheState;
  return actions;
};

GeneralSchema.methods.getBattleActionList = function(): GameAction[] {
  return this.getActionList();
};

GeneralSchema.methods.onCalcDomestic = function(turnType: string, varType: string, value: number, aux?: any): number {
  let result = value;
  for (const action of this.getActionList()) {
    if (typeof action.onCalcDomestic === 'function') {
      result = action.onCalcDomestic(turnType, varType, result, aux);
    }
  }
  return result;
};

GeneralSchema.methods.increaseInheritancePoint = function(key: InheritanceKey | string, amount: number = 1): Promise<void> {
  return InheritancePointUtil.increasePoint(this, key, amount);
};

GeneralSchema.methods.getInheritancePoint = function(key: InheritanceKey | string): number {
  return InheritancePointUtil.getPoint(this, key);
};

GeneralSchema.methods.getAllInheritancePoints = function(): Record<string, number> {
  return InheritancePointUtil.getAllPoints(this) || {};
};

GeneralSchema.methods.resetInheritancePoints = function(): void {
  InheritancePointUtil.resetPoints(this);
};

GeneralSchema.methods.getTotalInheritancePoint = function(): number {
  return InheritancePointUtil.getTotalPoints(this);
};

GeneralSchema.methods.onCalcStat = function(_general: any, statName: string, value: any, aux?: any): any {
  let result = value;
  for (const action of this.getActionList()) {
    if (typeof action.onCalcStat === 'function') {
      result = action.onCalcStat(this, statName, result, aux);
    }
  }
  return result;
};

GeneralSchema.methods.onCalcOpposeStat = function(_general: any, statName: string, value: any, aux?: any): any {
  let result = value;
  for (const action of this.getActionList()) {
    if (typeof action.onCalcOpposeStat === 'function') {
      result = action.onCalcOpposeStat(this, statName, result, aux);
    }
  }
  return result;
};

GeneralSchema.methods.getWarPowerMultiplier = function(unit: WarUnit): [number, number] {
  let myMultiply = 1;
  let opposeMultiply = 1;
  for (const action of this.getBattleActionList()) {
    if (typeof action.getWarPowerMultiplier === 'function') {
      try {
        const [selfMult, foeMult] = action.getWarPowerMultiplier(unit) || [1, 1];
        if (Number.isFinite(selfMult)) {
          myMultiply *= selfMult;
        }
        if (Number.isFinite(foeMult)) {
          opposeMultiply *= foeMult;
        }
      } catch (error) {
        console.warn('[General] getWarPowerMultiplier failed:', error);
      }
    }
  }
  return [myMultiply, opposeMultiply];
};

GeneralSchema.methods.getBattleInitSkillTriggerList = function(unit: WarUnit): WarUnitTriggerCaller | null {
  const callers = this.getBattleActionList().map((action: GameAction) =>
    typeof action.getBattleInitSkillTriggerList === 'function'
      ? action.getBattleInitSkillTriggerList(unit)
      : null
  );
  return WarUnitTriggerCaller.mergeCallers(callers);
};

GeneralSchema.methods.getBattlePhaseSkillTriggerList = function(unit: WarUnit): WarUnitTriggerCaller | null {
  const callers = this.getBattleActionList().map((action: GameAction) =>
    typeof action.getBattlePhaseSkillTriggerList === 'function'
      ? action.getBattlePhaseSkillTriggerList(unit)
      : null
  );
  return WarUnitTriggerCaller.mergeCallers(callers);
};

/**
 * 능력치를 계산해서 반환하는 공통 메서드
 * PHP의 getStatValue와 동일한 로직
 */
function getStatValue(general: any, statName: string, withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  let statValue = general.getVar(statName) || 0;
  
  // 부상 적용
  if (withInjury) {
    const injury = general.getVar('injury') || 0;
    statValue *= (100 - injury) / 100;
  }
  
  // 능력치 상호 보정 (통무지정 시스템)
  if (withStatAdjust) {
    if (statName === 'strength') {
      // 무력 = 무력 + (지력 / 4)
      const intel = getStatValue(general, 'intel', withInjury, withIActionObj, false, false);
      statValue += Math.round(intel / 4);
    } else if (statName === 'intel') {
      // 지력 = 지력 + (무력 / 4)
      const strength = getStatValue(general, 'strength', withInjury, withIActionObj, false, false);
      statValue += Math.round(strength / 4);
    }
  }
  
  // 최대값 제한 (기본 150)
  const maxLevel = 150;
  statValue = Math.max(0, Math.min(statValue, maxLevel));
  
  // FUTURE: withIActionObj - 아이템/특성의 영향 적용
  // if (withIActionObj) {
  //   const actionList = general.getActionList();
  //   for (const actionObj of actionList) {
  //     if (actionObj && actionObj.onCalcStat) {
  //       statValue = actionObj.onCalcStat(general, statName, statValue);
  //     }
  //   }
  // }
  
  // 정수로 반올림
  if (useFloor) {
    return Math.floor(statValue);
  }
  
  return statValue;
}

/**
 * 통솔 능력치 조회
 */
GeneralSchema.methods.getLeadership = function(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  return getStatValue(this, 'leadership', withInjury, withIActionObj, withStatAdjust, useFloor);
};

/**
 * 무력 능력치 조회
 */
GeneralSchema.methods.getStrength = function(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  return getStatValue(this, 'strength', withInjury, withIActionObj, withStatAdjust, useFloor);
};

/**
 * 지력 능력치 조회
 */
GeneralSchema.methods.getIntel = function(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  return getStatValue(this, 'intel', withInjury, withIActionObj, withStatAdjust, useFloor);
};

/**
 * 정치 능력치 조회
 */
GeneralSchema.methods.getPolitics = function(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  return getStatValue(this, 'politics', withInjury, withIActionObj, withStatAdjust, useFloor);
};

/**
 * 매력 능력치 조회
 */
GeneralSchema.methods.getCharm = function(withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  return getStatValue(this, 'charm', withInjury, withIActionObj, withStatAdjust, useFloor);
};

// Static 메서드: DB에서 장수 객체 생성
GeneralSchema.statics.createObjFromDB = async function(generalID: number, sessionId?: string): Promise<any> {
  const { generalRepository } = await import('../repositories/general.repository');
  
  // sessionId가 제공되지 않으면 기본값 사용
  const sid = sessionId || 'sangokushi_default';
  
  // generalRepository를 통해 장수 조회
  const generalDoc = await generalRepository.findOneByFilter({
    session_id: sid,
    'data.no': generalID
  });
  
  if (!generalDoc) {
    throw new Error(`장수 ${generalID}를 찾을 수 없습니다.`);
  }
  
  return generalDoc;
};

export const General = (mongoose.models.General as IGeneralModel) || mongoose.model<IGeneral, IGeneralModel>('General', GeneralSchema);
