import mongoose, { Schema, Document, Model } from 'mongoose';
import { ActionLogger } from '../services/logger/ActionLogger';
import { LogFormatType } from '../types/log.types';
import type { GameAction } from '../game/actions/Action';
import { getSpecialWarAction } from '../game/specialWar/specialWarRegistry';
import { getSpecialDomesticAction } from '../game/specialDomestic/specialDomesticRegistry';
import { getPersonalityAction } from '../game/personality/personalityRegistry';
import { NationTypeAction } from '../game/actions/adapters/NationTypeAction';
import { buildNationTypeClass } from '../core/nation-type/NationTypeFactory';
import type { WarUnit } from '../battle/WarUnit';
import { WarUnitTriggerCaller } from '../game/triggers/WarUnitTriggerCaller';
import { InheritanceKey, InheritancePointUtil } from '../Enums/InheritanceKey';
import { PenaltyKey, tryPenaltyKeyFrom } from '../Enums/PenaltyKey';
import { RankColumn, tryRankColumnFrom } from '../Enums/RankColumn';
import { buildItemClass, ItemAction, ItemSlot } from '../utils/item-class';
import { createOfficerLevelTrigger } from '../game/triggers/TriggerOfficerLevel';
import { createCrewTypeTrigger } from '../game/triggers/TriggerCrewType';
import { createInheritBuffTrigger } from '../game/triggers/TriggerInheritBuff';
import { getScenarioEffectAction } from '../game/scenarioEffect/scenarioEffectRegistry';

// PHP GeneralBase의 턴타임 상수 (PHP 호환성)
export const TURNTIME_FULL_MS = -1;
export const TURNTIME_FULL = 0;
export const TURNTIME_HMS = 1;
export const TURNTIME_HM = 2;

// 문자열 형식 상수 (편의용)
export const TURNTIME = {
  FULL_MS: 'FULL_MS',
  FULL: 'FULL',
  HMS: 'HMS',
  HM: 'HM',
} as const;

// 장수 인터페이스
export interface IGeneral extends Document {
  // PHP 호환 상수
  TURNTIME_FULL_MS: number;
  TURNTIME_FULL: number;
  TURNTIME_HMS: number;
  TURNTIME_HM: string;

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
  penalty?: Record<string, number | string>;  // 페널티 저장 (PHP General.penaltyList 대응)
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
  
  /**
   * 완전 동적 데이터 (모든 것이 세션 설정에 따라 다름!)
   * PHP General::$raw와 대응
   * 
   * 주요 필드 설명:
   * 
   * === 자원 (resources) ===
   * - gold: 소지금
   * - rice: 군량
   * - crew: 병력 수
   * - crewtype: 병종 ID (1100=보병, 1200=궁병, 1300=기병, 1400=귀병, 1500=차병)
   * 
   * === 능력치 (attributes) ===
   * - leadership: 통솔 (PHP: 統)
   * - strength: 무력 (PHP: 武)
   * - intel: 지력 (PHP: 智)
   * - leadership_exp, strength_exp, intel_exp: 능력치 경험치
   * - experience: 총 경험치 (explevel 레벨 계산용)
   * - dedication: 공헌도 (dedlevel 계급 계산용)
   * - train: 훈련도 (0~100)
   * - atmos: 사기 (0~100)
   * - injury: 부상 (0~100, 능력치 감소율)
   * 
   * === 숙련도 (proficiency by arm type) ===
   * - dex1~dex5: 병종별 숙련도 (보병/궁병/기병/귀병/차병)
   * 
   * === 관직/소속 (officer/affiliation) - PHP officerLevelObj 대응 ===
   * - nation: 소속 국가 ID (0=재야)
   * - city: 현재 위치 도시 ID
   * - officer_level: 관직 레벨 (1=평민, 2~4=태수, 5~11=고위직, 12=군주)
   * - officer_city: 담당 도시 (태수용)
   * - troop: 부대장 장수 ID (0=부대 없음)
   * 
   * === 특성/성격 (special/personality) - PHP specialObj/personalityObj 대응 ===
   * - special: 내정 특기 코드 (예: 'farming', 'None')
   * - special2: 전투 특기 코드 (예: 'charge', 'None')
   * - personal: 성격 코드 (예: 'brave', 'None')
   * 
   * === 아이템 (items) - PHP itemObjs 대응 ===
   * - horse: 말 아이템 코드 (예: 'RedHare', 'None')
   * - weapon: 무기 아이템 코드
   * - book: 서적 아이템 코드
   * - item: 도구 아이템 코드
   * 
   * === 유산/시나리오 (inheritance/scenario) ===
   * - aux.inheritBuff: 유산 버프 객체 (PHP inheritBuffObj 대응)
   *   예: { warAvoidRatio: 5, warCriticalRatio: 3 }
   * - _scenarioEffect: 시나리오 효과 키 (PHP scenarioEffect 대응)
   * 
   * === 기타 ===
   * - recent_war: 최근 전쟁 시간 (Date)
   * - turntime: 다음 턴 시간 (Date)
   * - last_turn: 마지막 턴 정보 (JSON)
   * - npc: NPC 타입 (0=유저, 1=NPC, 2=시스템NPC)
   */
  data: Record<string, any>;
  
  // 헬퍼 메서드
  getVar(key: string): any;
  setVar(key: string, value: any): void;
  increaseVar(key: string, amount: number): void;
  increaseVarWithLimit(key: string, amount: number, min?: number | null, max?: number | null): void;
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
  addDex(crewType: any, exp: number, affectTrainAtmos?: boolean): void;
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
  
  // aux 관리 메서드 (PHP LazyVarAndAuxUpdater 대응)
  getAuxVar(key: string): any;
  setAuxVar(key: string, value: any): void;
  
  // 페널티 시스템 메서드 (PHP General.php 대응)
  hasPenalty(penaltyKey: PenaltyKey | string): boolean;
  getPenalty(penaltyKey: PenaltyKey | string): number | string | null;
  setPenalty(penaltyKey: PenaltyKey | string, value: number | string): void;
  removePenalty(penaltyKey: PenaltyKey | string): void;
  getPenaltyList(): Map<string, number | string>;
  
  // 랭크 시스템 메서드 (PHP General.php 대응)
  getRankVar(key: RankColumn | string, defaultValue?: number): number;
  setRankVar(key: RankColumn | string, value: number): void;
  increaseRankVar(key: RankColumn | string, value: number): void;
  
  // 변경 추적 메서드 (PHP LazyVarUpdater 대응)
  getUpdatedValues(): Record<string, any>;
  flushUpdateValues(): void;
  hasUpdatedVar(key: string): boolean;
  
  // 추가 유틸 메서드
  updateVar(key: string, value: any): void;
  updateVarWithLimit(key: string, value: any, min?: number | null, max?: number | null): void;
  multiplyVar(key: string, value: number): void;
  multiplyVarWithLimit(key: string, value: number, min?: number | null, max?: number | null): void;
  
  // 아이템 관리 메서드 (PHP General.php 대응)
  setItem(itemKey: ItemSlot, itemCode: string | null): void;
  deleteItem(itemKey: ItemSlot): void;
  getItem(itemKey: ItemSlot): ItemAction;
  getItems(): Record<ItemSlot, ItemAction>;
  
  // 특성/성격 접근자 메서드
  getPersonality(): GameAction;
  getSpecialDomestic(): GameAction;
  getSpecialWar(): GameAction;
  
  // 스킬 활성화 추적 메서드 (PHP General.php 대응)
  clearActivatedSkill(): void;
  getActivatedSkillLog(): Record<string, number>;
  hasActivatedSkill(skillName: string): boolean;
  activateSkill(...skillNames: string[]): void;
  deactivateSkill(...skillNames: string[]): void;
  
  // 기타 메서드
  getName(): string;
  getNPCType(): number;
  onCalcStrategic(turnType: string, varType: string, value: any, aux?: any): any;
  onCalcNationalIncome(type: string, amount: number): number;
  calcRecentWarTurn(turnTerm: number): number;
  
  // 사망/환생 메서드 (PHP General.php 대응)
  kill(options?: { sendDyingMessage?: boolean; dyingMessage?: string | null }): Promise<void>;
  rebirth(): Promise<void>;
  
  // 포로 시스템 메서드
  isPrisoner(): boolean;
  getPrisonerOf(): number;
  setPrisoner(capturerNationId: number): void;
  releasePrisoner(): void;
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
  penalty: { type: Schema.Types.Mixed, default: {} },  // 페널티 저장
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
GeneralSchema.index({ session_id: 1, nation: 1 });
GeneralSchema.index({ session_id: 1, 'data.nation': 1 });
GeneralSchema.index({ session_id: 1, city: 1 });
GeneralSchema.index({ session_id: 1, owner: 1 });

// ========================================
// 변경 추적 시스템 (PHP LazyVarUpdater 대응)
// ========================================

/**
 * 변경된 변수들을 추적하기 위한 내부 심볼
 * PHP의 $updatedVar와 대응
 */
const UPDATED_VAR_SYMBOL = Symbol('updatedVar');
const AUX_UPDATED_SYMBOL = Symbol('auxUpdated');

// 메서드 추가 (PHP의 General 클래스 메서드들)

/**
 * 변수 값 조회
 * PHP 대응: LazyVarUpdater::getVar()
 */
GeneralSchema.methods.getVar = function(key: string): any {
  return this.data?.[key];
};

/**
 * 변수 값 설정 (변경 추적 포함)
 * PHP 대응: LazyVarUpdater::setVar() -> updateVar()
 */
GeneralSchema.methods.setVar = function(key: string, value: any): void {
  this.updateVar(key, value);
};

/**
 * 변수 값 업데이트 (변경 추적 포함)
 * PHP 대응: LazyVarUpdater::updateVar()
 * 
 * 값이 동일하면 업데이트하지 않음
 */
GeneralSchema.methods.updateVar = function(key: string, value: any): void {
  // 값이 동일하면 업데이트하지 않음 (PHP 동작 일치)
  if (this.data?.[key] === value) {
    return;
  }
  
  // 변경 추적
  if (!(this as any)[UPDATED_VAR_SYMBOL]) {
    (this as any)[UPDATED_VAR_SYMBOL] = {};
  }
  (this as any)[UPDATED_VAR_SYMBOL][key] = true;
  
  // 값 설정
  if (!this.data) {
    this.data = {};
  }
  this.data[key] = value;
  this.markModified('data');
};

/**
 * 변수 값 업데이트 (제한 포함)
 * PHP 대응: LazyVarUpdater::updateVarWithLimit()
 */
GeneralSchema.methods.updateVarWithLimit = function(key: string, value: any, min: number | null = null, max: number | null = null): void {
  let targetValue = value;
  if (min !== null && targetValue < min) {
    targetValue = min;
  }
  if (max !== null && targetValue > max) {
    targetValue = max;
  }
  this.updateVar(key, targetValue);
};

/**
 * 변수 값 증가
 * PHP 대응: LazyVarUpdater::increaseVar()
 */
GeneralSchema.methods.increaseVar = function(key: string, amount: number): void {
  if (amount === 0) {
    return;
  }
  const currentValue = this.data?.[key] ?? 0;
  this.updateVar(key, currentValue + amount);
};

/**
 * 변수 값 증가 (제한 포함)
 * PHP 대응: LazyVarUpdater::increaseVarWithLimit()
 */
GeneralSchema.methods.increaseVarWithLimit = function(key: string, amount: number, min: number | null = null, max: number | null = null): void {
  const currentValue = this.data?.[key] ?? 0;
  let targetValue = currentValue + amount;
  if (min !== null && targetValue < min) {
    targetValue = min;
  }
  if (max !== null && targetValue > max) {
    targetValue = max;
  }
  this.updateVar(key, targetValue);
};

/**
 * 변수 값 곱셈
 * PHP 대응: LazyVarUpdater::multiplyVar()
 */
GeneralSchema.methods.multiplyVar = function(key: string, value: number): void {
  if (value === 1) {
    return;
  }
  const currentValue = this.data?.[key] ?? 0;
  this.updateVar(key, currentValue * value);
};

/**
 * 변수 값 곱셈 (제한 포함)
 * PHP 대응: LazyVarUpdater::multiplyVarWithLimit()
 */
GeneralSchema.methods.multiplyVarWithLimit = function(key: string, value: number, min: number | null = null, max: number | null = null): void {
  const currentValue = this.data?.[key] ?? 0;
  let targetValue = currentValue * value;
  if (min !== null && targetValue < min) {
    targetValue = min;
  }
  if (max !== null && targetValue > max) {
    targetValue = max;
  }
  this.updateVar(key, targetValue);
};

/**
 * 변경된 값들 조회
 * PHP 대응: LazyVarUpdater::getUpdatedValues()
 */
GeneralSchema.methods.getUpdatedValues = function(): Record<string, any> {
  const updatedVar = (this as any)[UPDATED_VAR_SYMBOL] || {};
  const auxUpdated = (this as any)[AUX_UPDATED_SYMBOL];
  
  // aux가 업데이트되었으면 aux 필드도 추가
  if (auxUpdated && this.aux) {
    updatedVar['aux'] = true;
  }
  
  const result: Record<string, any> = {};
  for (const key of Object.keys(updatedVar)) {
    result[key] = this.data?.[key];
  }
  return result;
};

/**
 * 변경 추적 초기화
 * PHP 대응: LazyVarUpdater::flushUpdateValues()
 */
GeneralSchema.methods.flushUpdateValues = function(): void {
  (this as any)[UPDATED_VAR_SYMBOL] = {};
  (this as any)[AUX_UPDATED_SYMBOL] = false;
};

/**
 * 특정 키가 변경되었는지 확인
 */
GeneralSchema.methods.hasUpdatedVar = function(key: string): boolean {
  const updatedVar = (this as any)[UPDATED_VAR_SYMBOL] || {};
  return !!updatedVar[key];
};

GeneralSchema.methods.getID = function(): number {
  return this.no;
};

// PHP 호환 상수 (인스턴스에서 general.TURNTIME_HM으로 접근)
GeneralSchema.virtual('TURNTIME_FULL_MS').get(function() { return TURNTIME_FULL_MS; });
GeneralSchema.virtual('TURNTIME_FULL').get(function() { return TURNTIME_FULL; });
GeneralSchema.virtual('TURNTIME_HMS').get(function() { return TURNTIME_HMS; });
GeneralSchema.virtual('TURNTIME_HM').get(function() { return 'HM'; }); // 문자열 'HM' 반환 (getTurnTime과 호환)

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
    color: '#CCCCCC',
    type: 0,
    level: 0,
    capital: 0
  };
};

/**
 * 턴타임을 포맷팅해서 반환
 * PHP GeneralBase::getTurnTime() 대응
 * 
 * @param format - 'HM' 또는 this.TURNTIME_HM: 시:분만 반환 (기본값)
 * @returns 포맷팅된 시간 문자열
 */
GeneralSchema.methods.getTurnTime = function(format?: string | number): string {
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
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // PHP 상수 매핑: TURNTIME_HM = 2, TURNTIME_HMS = 1, TURNTIME_FULL = 0, TURNTIME_FULL_MS = -1
  // 문자열 'HM', 'HMS', 'TURNTIME_HM' 등도 지원
  if (format === 'HM' || format === 'TURNTIME_HM' || format === TURNTIME_HM || format === undefined) {
    // PHP TURNTIME_HM: HH:MM만 반환 (기본값)
    return `${hours}:${minutes}`;
  } else if (format === 'HMS' || format === TURNTIME_HMS) {
    // PHP TURNTIME_HMS: HH:MM:SS
    return `${hours}:${minutes}:${seconds}`;
  } else if (format === 'FULL' || format === TURNTIME_FULL) {
    // PHP TURNTIME_FULL: YYYY-MM-DD HH:MM:SS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } else if (format === 'FULL_MS' || format === TURNTIME_FULL_MS) {
    // PHP TURNTIME_FULL_MS: YYYY-MM-DD HH:MM:SS.mmm
    return date.toISOString().replace('T', ' ').replace('Z', '');
  } else {
    // 기본: HH:MM (PHP 동작과 일치)
    return `${hours}:${minutes}`;
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

/**
 * 병종별 숙련도 증가
 * PHP General::addDex()와 동일
 * 
 * @param crewType - 병종 객체 또는 armType 숫자
 * @param exp - 기본 숙련도 경험치
 * @param affectTrainAtmos - 훈련도/사기 영향 여부 (기본: false)
 */
GeneralSchema.methods.addDex = function(crewTypeOrArmType: any, exp: number, affectTrainAtmos: boolean = false): void {
  const { calculateDexExp, getDexFieldNameFromArmType } = require('../utils/dex-calculator');

  // crewType 또는 armType에서 armType 추출
  let armType: number;
  if (typeof crewTypeOrArmType === 'number') {
    armType = crewTypeOrArmType;
  } else if (crewTypeOrArmType && typeof crewTypeOrArmType.armType === 'number') {
    armType = crewTypeOrArmType.armType;
  } else {
    // 기본값: 보병
    armType = 1;
  }

  const train = this.data?.train ?? 100;
  const atmos = this.data?.atmos ?? 100;

  // PHP General::addDex에 맞춘 EXP 계산
  let finalExp = calculateDexExp(exp, armType, train, atmos, affectTrainAtmos);

  // onCalcStat 트리거 적용 (아이템/특성 보정)
  if (typeof this.onCalcStat === 'function') {
    finalExp = this.onCalcStat(this, 'addDex', finalExp, { armType });
  }

  const dexField = getDexFieldNameFromArmType(armType);
  if (typeof this.data[dexField] !== 'number') {
    this.data[dexField] = 0;
  }
  this.data[dexField] += finalExp;

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

/**
 * ActionList 캐시 키 생성
 * PHP의 getActionList() 결과에 영향을 주는 모든 요소를 키에 포함
 */
function buildActionCacheKey(general: any): string {
  const specialWarKey = general.data?.special2 ?? general.special2 ?? 'None';
  const specialDomesticKey = general.data?.special ?? general.special ?? 'None';
  const personalityKey = general.data?.personal ?? general.personal ?? 'None';
  const nationTypeKey = resolveNationTypeKey(general) ?? 'none';
  const officerLevel = general.data?.officer_level ?? 0;
  const crewType = general.data?.crewtype ?? 1100;
  const horse = general.data?.horse ?? 'None';
  const weapon = general.data?.weapon ?? 'None';
  const book = general.data?.book ?? 'None';
  const item = general.data?.item ?? 'None';
  return `${specialWarKey}|${specialDomesticKey}|${personalityKey}|${nationTypeKey}|${officerLevel}|${crewType}|${horse}|${weapon}|${book}|${item}`;
}

/**
 * ActionList 생성
 * PHP 대응: General::getActionList()
 * 
 * 아래 모든 객체는 GameAction 인터페이스를 구현하며, 내정/전투 보정에 사용됨:
 * 
 * - nationType: 국가 타입 (NationTypeAction) - 국가 고유 특성
 * - officerLevelObj: 관직 레벨 (TriggerOfficerLevel) - 관직에 따른 통솔/내정 보너스
 * - specialDomesticObj: 내정 특기 (SpecialDomesticAction) - 농업/상업 등 내정 보정
 * - specialWarObj: 전투 특기 (SpecialWarAction) - 전투 시 공격/방어 보정
 * - personalityObj: 성격 (PersonalityAction) - 다양한 행동 보정
 * - crewType: 병종 (TriggerCrewType) - 병종별 상성/속도/회피
 * - inheritBuffObj: 유산 버프 (TriggerInheritBuff) - 유산 포인트로 구매한 버프
 * - scenarioEffect: 시나리오 효과 (ScenarioEffectAction) - 세션별 특수 효과
 * - itemObjs: 아이템들 (ItemAction[]) - 말/무기/서적/도구
 */
function createActionList(general: any): GameAction[] {
  const actions: GameAction[] = [];
  
  // 1. 국가 타입 (nationType)
  const nationTypeKey = resolveNationTypeKey(general);
  if (nationTypeKey) {
    actions.push(new NationTypeAction(buildNationTypeClass(nationTypeKey)));
  }
  
  // 2. 관직 레벨 (officerLevelObj) ✅ 구현
  const nationData = typeof general.getStaticNation === 'function' 
    ? general.getStaticNation() 
    : general.data?._cached_nation;
  const nationLevel = nationData?.level ?? 0;
  actions.push(createOfficerLevelTrigger(general, nationLevel));
  
  // 3. 내정 특기 (specialDomesticObj)
  const specialDomesticKey = general.data?.special ?? general.special ?? 'None';
  actions.push(getSpecialDomesticAction(specialDomesticKey));
  
  // 4. 전투 특기 (specialWarObj)
  const specialWarKey = general.data?.special2 ?? general.special2 ?? 'None';
  actions.push(getSpecialWarAction(specialWarKey));
  
  // 5. 성격 (personalityObj)
  const personalityKey = general.data?.personal ?? general.personal ?? 'None';
  actions.push(getPersonalityAction(personalityKey));
  
  // 6. 병종 (crewType) ✅ 구현
  const crewTypeId = general.data?.crewtype ?? 1100;  // 기본: 보병
  actions.push(createCrewTypeTrigger(crewTypeId));
  
  // 7. 유산 버프 (inheritBuffObj) ✅ 구현
  const inheritBuff = general.aux?.inheritBuff || general.data?.aux?.inheritBuff;
  if (inheritBuff && typeof inheritBuff === 'object') {
    const inheritBuffTrigger = createInheritBuffTrigger(inheritBuff);
    if (inheritBuffTrigger) {
      actions.push(inheritBuffTrigger);
    }
  }
  
  // 8. 시나리오 효과 (scenarioEffect) ✅ 구현
  const scenarioEffectKey = general.data?._scenarioEffect || general._scenarioEffect;
  if (scenarioEffectKey) {
    const scenarioEffect = getScenarioEffectAction(scenarioEffectKey);
    if (scenarioEffect) {
      actions.push(scenarioEffect);
    }
  }
  
  // 9. 아이템들 (itemObjs) ✅ 구현
  for (const itemSlot of ['horse', 'weapon', 'book', 'item'] as const) {
    const itemCode = general.data?.[itemSlot] ?? 'None';
    if (itemCode && itemCode !== 'None') {
      const itemAction = buildItemClass(itemCode, { slot: itemSlot });
      actions.push(itemAction);
    }
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
 * 
 * 통무지정매 (統武智政魅) 5대 능력치:
 * - leadership (통솔/統): 징병, 훈련, 병력 지휘
 * - strength (무력/武): 전투 공격력, 일기토
 * - intel (지력/智): 계략, 정보 수집
 * - politics (정치/政): 내정(농업/상업/치안), 외교
 * - charm (매력/魅): 등용, 징병 효율, 민심
 */
function getStatValue(general: any, statName: string, withInjury = true, withIActionObj = true, withStatAdjust = true, useFloor = true): number {
  let statValue = general.getVar(statName) || 0;
  
  // 부상 적용
  if (withInjury) {
    const injury = general.getVar('injury') || 0;
    statValue *= (100 - injury) / 100;
  }
  
  // 능력치 상호 보정 (통무지정매 시스템)
  if (withStatAdjust) {
    if (statName === 'strength') {
      // 무력 = 무력 + (지력 / 4)
      const intel = getStatValue(general, 'intel', withInjury, withIActionObj, false, false);
      statValue += Math.round(intel / 4);
    } else if (statName === 'intel') {
      // 지력 = 지력 + (무력 / 4)
      const strength = getStatValue(general, 'strength', withInjury, withIActionObj, false, false);
      statValue += Math.round(strength / 4);
    } else if (statName === 'politics') {
      // 정치 = 정치 + (지력 / 4)
      const intel = getStatValue(general, 'intel', withInjury, withIActionObj, false, false);
      statValue += Math.round(intel / 4);
    } else if (statName === 'charm') {
      // 매력 = 매력 + (정치 / 4)
      const politics = getStatValue(general, 'politics', withInjury, withIActionObj, false, false);
      statValue += Math.round(politics / 4);
    }
  }
  
  // 최대값 제한 (기본 150)
  const maxLevel = 150;
  statValue = Math.max(0, Math.min(statValue, maxLevel));
  
  // withIActionObj - 아이템/특성의 영향 적용
  if (withIActionObj) {
    const actionList = general.getActionList();
    for (const actionObj of actionList) {
      if (actionObj && typeof actionObj.onCalcStat === 'function') {
        statValue = actionObj.onCalcStat(general, statName, statValue);
      }
    }
  }
  
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

// ========================================
// aux 관리 메서드 (PHP LazyVarAndAuxUpdater 대응)
// ========================================

/**
 * aux 필드에서 값 조회
 * PHP 대응: LazyVarAndAuxUpdater::getAuxVar()
 * 
 * @param key - aux 내의 키
 * @returns 해당 키의 값 또는 null
 */
GeneralSchema.methods.getAuxVar = function(key: string): any {
  // aux 필드 초기화 및 파싱
  if (!this.aux) {
    this.aux = {};
  }
  
  // data.aux도 확인 (하위 호환성)
  if (this.data?.aux && typeof this.data.aux === 'object') {
    return this.data.aux[key] ?? this.aux[key] ?? null;
  }
  
  return this.aux[key] ?? null;
};

/**
 * aux 필드에 값 설정
 * PHP 대응: LazyVarAndAuxUpdater::setAuxVar()
 * 
 * @param key - aux 내의 키
 * @param value - 설정할 값 (null이면 삭제)
 */
GeneralSchema.methods.setAuxVar = function(key: string, value: any): void {
  const oldValue = this.getAuxVar(key);
  
  // 값이 동일하면 업데이트하지 않음
  if (oldValue === value) {
    return;
  }
  
  // aux 필드 초기화
  if (!this.aux) {
    this.aux = {};
  }
  
  // null이면 삭제
  if (value === null || value === undefined) {
    delete this.aux[key];
  } else {
    this.aux[key] = value;
  }
  
  // 변경 추적
  (this as any)[AUX_UPDATED_SYMBOL] = true;
  this.markModified('aux');
};

// ========================================
// 페널티 시스템 (PHP General.php 대응)
// ========================================

/**
 * 페널티 보유 여부 확인
 * PHP 대응: General::hasPenalty()
 */
GeneralSchema.methods.hasPenalty = function(penaltyKey: PenaltyKey | string): boolean {
  const key = typeof penaltyKey === 'string' ? penaltyKey : penaltyKey;
  
  // penalty 필드 또는 data.penalty에서 확인
  const penaltyData = this.penalty || this.data?.penalty || {};
  return key in penaltyData;
};

/**
 * 페널티 값 조회
 * PHP 대응: General의 penaltyList에서 값 조회
 */
GeneralSchema.methods.getPenalty = function(penaltyKey: PenaltyKey | string): number | string | null {
  const key = typeof penaltyKey === 'string' ? penaltyKey : penaltyKey;
  
  const penaltyData = this.penalty || this.data?.penalty || {};
  return penaltyData[key] ?? null;
};

/**
 * 페널티 설정
 */
GeneralSchema.methods.setPenalty = function(penaltyKey: PenaltyKey | string, value: number | string): void {
  const key = typeof penaltyKey === 'string' ? penaltyKey : penaltyKey;
  
  // penalty 필드 초기화
  if (!this.penalty) {
    this.penalty = {};
  }
  
  this.penalty[key] = value;
  this.markModified('penalty');
};

/**
 * 페널티 제거
 */
GeneralSchema.methods.removePenalty = function(penaltyKey: PenaltyKey | string): void {
  const key = typeof penaltyKey === 'string' ? penaltyKey : penaltyKey;
  
  if (!this.penalty) {
    return;
  }
  
  delete this.penalty[key];
  this.markModified('penalty');
};

/**
 * 전체 페널티 목록 조회
 * PHP 대응: General::getPenaltyList()
 */
GeneralSchema.methods.getPenaltyList = function(): Map<string, number | string> {
  const penaltyData = this.penalty || this.data?.penalty || {};
  return new Map(Object.entries(penaltyData));
};

// ========================================
// 랭크 시스템 (PHP General.php 대응)
// ========================================

/**
 * 랭크 변수 조회
 * PHP 대응: General::getRankVar()
 */
GeneralSchema.methods.getRankVar = function(key: RankColumn | string, defaultValue: number = 0): number {
  const keyStr = typeof key === 'string' ? key : key;
  
  // rank 필드 또는 data.rank에서 확인
  const rankData = this.rank || this.data?.rank || {};
  
  if (!(keyStr in rankData)) {
    return defaultValue;
  }
  
  return rankData[keyStr] ?? defaultValue;
};

/**
 * 랭크 변수 설정
 * PHP 대응: General::setRankVar()
 */
GeneralSchema.methods.setRankVar = function(key: RankColumn | string, value: number): void {
  const keyStr = typeof key === 'string' ? key : key;
  
  // rank 필드 초기화
  if (!this.rank) {
    this.rank = {};
  }
  
  this.rank[keyStr] = value;
  this.markModified('rank');
};

/**
 * 랭크 변수 증가
 * PHP 대응: General::increaseRankVar()
 */
GeneralSchema.methods.increaseRankVar = function(key: RankColumn | string, value: number): void {
  const keyStr = typeof key === 'string' ? key : key;
  
  // rank 필드 초기화
  if (!this.rank) {
    this.rank = {};
  }
  
  const currentValue = this.rank[keyStr] ?? 0;
  this.rank[keyStr] = currentValue + value;
  this.markModified('rank');
};

// ========================================
// 아이템 관리 메서드 (PHP General.php 대응)
// ========================================

const ITEM_SLOTS: ItemSlot[] = ['horse', 'weapon', 'book', 'item'];

/**
 * 아이템 설정
 * PHP 대응: General::setItem()
 */
GeneralSchema.methods.setItem = function(itemKey: ItemSlot, itemCode: string | null): void {
  if (itemCode === null) {
    this.deleteItem(itemKey);
    return;
  }
  
  this.setVar(itemKey, itemCode);
  
  // 아이템 캐시 무효화 (ActionList 재생성 필요)
  (this as any).__actionListCache = null;
  (this as any).__itemCache = null;
};

/**
 * 아이템 삭제
 * PHP 대응: General::deleteItem()
 */
GeneralSchema.methods.deleteItem = function(itemKey: ItemSlot): void {
  this.setVar(itemKey, 'None');
  
  // 아이템 캐시 무효화
  (this as any).__actionListCache = null;
  (this as any).__itemCache = null;
};

/**
 * 아이템 객체 조회
 * PHP 대응: General::getItem()
 */
GeneralSchema.methods.getItem = function(itemKey: ItemSlot): ItemAction {
  const itemCode = this.data?.[itemKey] ?? 'None';
  return buildItemClass(itemCode, { slot: itemKey });
};

/**
 * 모든 아이템 객체 조회
 * PHP 대응: General::getItems()
 */
GeneralSchema.methods.getItems = function(): Record<ItemSlot, ItemAction> {
  // 캐시 확인
  const cache = (this as any).__itemCache;
  if (cache) {
    return cache;
  }
  
  const items: Record<string, ItemAction> = {};
  for (const slot of ITEM_SLOTS) {
    items[slot] = this.getItem(slot);
  }
  
  (this as any).__itemCache = items;
  return items as Record<ItemSlot, ItemAction>;
};

// ========================================
// 특성/성격 접근자 메서드 (PHP General.php 대응)
// ========================================

/**
 * 성격 객체 조회
 * PHP 대응: General::getPersonality()
 */
GeneralSchema.methods.getPersonality = function(): GameAction {
  const personalityKey = this.data?.personal ?? this.personal ?? 'None';
  return getPersonalityAction(personalityKey);
};

/**
 * 내정 특기 객체 조회
 * PHP 대응: General::getSpecialDomestic()
 */
GeneralSchema.methods.getSpecialDomestic = function(): GameAction {
  const specialKey = this.data?.special ?? this.special ?? 'None';
  return getSpecialDomesticAction(specialKey);
};

/**
 * 전투 특기 객체 조회
 * PHP 대응: General::getSpecialWar()
 */
GeneralSchema.methods.getSpecialWar = function(): GameAction {
  const specialKey = this.data?.special2 ?? this.special2 ?? 'None';
  return getSpecialWarAction(specialKey);
};

// ========================================
// 스킬 활성화 추적 메서드 (PHP General.php 대응)
// ========================================

const ACTIVATED_SKILL_SYMBOL = Symbol('activatedSkill');
const SKILL_LOG_SYMBOL = Symbol('logActivatedSkill');

/**
 * 활성화된 스킬 초기화
 * PHP 대응: General::clearActivatedSkill()
 * 
 * 현재 활성화된 스킬들을 로그에 기록하고 초기화
 */
GeneralSchema.methods.clearActivatedSkill = function(): void {
  const activatedSkill = (this as any)[ACTIVATED_SKILL_SYMBOL] || {};
  const logActivatedSkill = (this as any)[SKILL_LOG_SYMBOL] || {};
  
  for (const [skillName, state] of Object.entries(activatedSkill)) {
    if (!state) {
      continue;
    }
    
    if (!(skillName in logActivatedSkill)) {
      logActivatedSkill[skillName] = 1;
    } else {
      logActivatedSkill[skillName] += 1;
    }
  }
  
  (this as any)[SKILL_LOG_SYMBOL] = logActivatedSkill;
  (this as any)[ACTIVATED_SKILL_SYMBOL] = {};
};

/**
 * 활성화 스킬 로그 조회
 * PHP 대응: General::getActivatedSkillLog()
 */
GeneralSchema.methods.getActivatedSkillLog = function(): Record<string, number> {
  return (this as any)[SKILL_LOG_SYMBOL] || {};
};

/**
 * 특정 스킬 활성화 여부 확인
 * PHP 대응: General::hasActivatedSkill()
 */
GeneralSchema.methods.hasActivatedSkill = function(skillName: string): boolean {
  const activatedSkill = (this as any)[ACTIVATED_SKILL_SYMBOL] || {};
  return !!activatedSkill[skillName];
};

/**
 * 스킬 활성화
 * PHP 대응: General::activateSkill()
 */
GeneralSchema.methods.activateSkill = function(...skillNames: string[]): void {
  if (!(this as any)[ACTIVATED_SKILL_SYMBOL]) {
    (this as any)[ACTIVATED_SKILL_SYMBOL] = {};
  }
  
  for (const skillName of skillNames) {
    (this as any)[ACTIVATED_SKILL_SYMBOL][skillName] = true;
  }
};

/**
 * 스킬 비활성화
 * PHP 대응: General::deactivateSkill()
 */
GeneralSchema.methods.deactivateSkill = function(...skillNames: string[]): void {
  if (!(this as any)[ACTIVATED_SKILL_SYMBOL]) {
    (this as any)[ACTIVATED_SKILL_SYMBOL] = {};
  }
  
  for (const skillName of skillNames) {
    (this as any)[ACTIVATED_SKILL_SYMBOL][skillName] = false;
  }
};

// ========================================
// 기타 유틸리티 메서드
// ========================================

/**
 * 장수 이름 조회
 * PHP 대응: GeneralBase::getName()
 */
GeneralSchema.methods.getName = function(): string {
  return this.name || this.data?.name || '';
};

/**
 * NPC 타입 조회
 * PHP 대응: GeneralBase::getNPCType()
 */
GeneralSchema.methods.getNPCType = function(): number {
  return this.npc ?? this.data?.npc ?? 0;
};

/**
 * 전략 계산 보정
 * PHP 대응: General::onCalcStrategic()
 */
GeneralSchema.methods.onCalcStrategic = function(turnType: string, varType: string, value: any, aux?: any): any {
  let result = value;
  for (const action of this.getActionList()) {
    if (typeof action.onCalcStrategic === 'function') {
      result = action.onCalcStrategic(turnType, varType, result, aux);
    }
  }
  return result;
};

/**
 * 국가 수입 계산 보정
 * PHP 대응: General::onCalcNationalIncome()
 */
GeneralSchema.methods.onCalcNationalIncome = function(type: string, amount: number): number {
  let result = amount;
  for (const action of this.getActionList()) {
    if (typeof action.onCalcNationalIncome === 'function') {
      result = action.onCalcNationalIncome(type, result);
    }
  }
  return result;
};

/**
 * 최근 전쟁으로부터 경과된 턴 수 계산
 * PHP 대응: General::calcRecentWarTurn()
 * 
 * @param turnTerm 턴 간격 (분)
 * @returns 경과된 턴 수 (전쟁 기록 없으면 12000)
 */
GeneralSchema.methods.calcRecentWarTurn = function(turnTerm: number): number {
  const recentWar = this.getVar('recent_war');
  
  // 최근 전쟁 기록이 없으면 매우 큰 값 반환
  if (!recentWar) {
    return 12 * 1000;
  }
  
  const turntime = this.getVar('turntime') || this.turntime;
  if (!turntime) {
    return 12 * 1000;
  }
  
  const recentWarDate = new Date(recentWar);
  const turntimeDate = turntime instanceof Date ? turntime : new Date(turntime);
  
  // 시간 차이 계산 (초)
  const secDiff = (turntimeDate.getTime() - recentWarDate.getTime()) / 1000;
  
  if (secDiff <= 0) {
    return 0;
  }
  
  // 턴 수로 변환
  return Math.floor(secDiff / (60 * turnTerm));
};

// ========================================
// 사망/환생 메서드 (PHP General.php 대응)
// ========================================

/**
 * 장수 사망 처리
 * PHP 대응: General::kill()
 * 
 * 주의: 이 메서드는 DB 삭제를 수행합니다. 서비스 레이어에서 호출해야 합니다.
 * 
 * @param options.sendDyingMessage - 사망 메시지 전송 여부 (기본: true)
 * @param options.dyingMessage - 커스텀 사망 메시지
 */
GeneralSchema.methods.kill = async function(options: { sendDyingMessage?: boolean; dyingMessage?: string | null } = {}): Promise<void> {
  const { sendDyingMessage = true, dyingMessage = null } = options;
  
  const generalID = this.getID();
  const generalName = this.getName();
  const logger = this.getLogger();
  
  // 군주였으면 다음 군주 처리 필요 (서비스 레이어에서 처리)
  const officerLevel = this.getVar('officer_level') ?? 0;
  if (officerLevel === 12) {
    // 군주 사망 시 처리는 서비스 레이어에서 nextRuler() 호출 필요
    this.setVar('officer_level', 1);
  }
  
  // 부대장이면 부대 해산 (서비스 레이어에서 처리 필요)
  const troopLeaderID = this.getVar('troop') ?? 0;
  if (troopLeaderID === generalID) {
    this.setVar('troop', 0);
  }
  
  // 사망 메시지 전송
  if (sendDyingMessage && logger) {
    const message = dyingMessage || `${generalName}(이)가 사망하였습니다.`;
    logger.pushGlobalActionLog(message);
  }
  
  // 장수 데이터 초기화 (실제 삭제는 서비스 레이어에서)
  this.setVar('nation', 0);
  this.setVar('city', 0);
  this.setVar('crew', 0);
  this.setVar('gold', 0);
  this.setVar('rice', 0);
  
  // 변경사항 플러시
  this.flushUpdateValues();
  
  // 실제 DB 삭제는 서비스 레이어에서 수행
  // await this.deleteOne();
};

/**
 * 장수 환생 처리
 * PHP 대응: General::rebirth()
 * 
 * 나이가 들어 은퇴하고 자손에게 능력을 물려줌
 * 통무지정매 5대 능력치 모두 적용
 */
GeneralSchema.methods.rebirth = async function(): Promise<void> {
  const logger = this.getLogger();
  const generalName = this.getName();
  
  // 능력치 0.85배 (최소 10) - 통무지정매 5대 능력치
  const leadership = this.getVar('leadership') ?? 50;
  const strength = this.getVar('strength') ?? 50;
  const intel = this.getVar('intel') ?? 50;
  const politics = this.getVar('politics') ?? 50;
  const charm = this.getVar('charm') ?? 50;
  
  this.updateVarWithLimit('leadership', Math.floor(leadership * 0.85), 10, null);
  this.updateVarWithLimit('strength', Math.floor(strength * 0.85), 10, null);
  this.updateVarWithLimit('intel', Math.floor(intel * 0.85), 10, null);
  this.updateVarWithLimit('politics', Math.floor(politics * 0.85), 10, null);
  this.updateVarWithLimit('charm', Math.floor(charm * 0.85), 10, null);
  
  // 부상 초기화
  this.setVar('injury', 0);
  
  // 경험치/공헌도 0.5배
  const experience = this.getVar('experience') ?? 0;
  const dedication = this.getVar('dedication') ?? 0;
  this.multiplyVar('experience', 0.5);
  this.multiplyVar('dedication', 0.5);
  
  // 나이 초기화
  this.setVar('age', 20);
  this.setVar('specage', 0);
  this.setVar('specage2', 0);
  
  // 숙련도 0.5배
  this.multiplyVar('dex1', 0.5);
  this.multiplyVar('dex2', 0.5);
  this.multiplyVar('dex3', 0.5);
  this.multiplyVar('dex4', 0.5);
  this.multiplyVar('dex5', 0.5);
  
  // 능력치 경험치 0.5배 (통무지정매)
  this.multiplyVar('leadership_exp', 0.5);
  this.multiplyVar('strength_exp', 0.5);
  this.multiplyVar('intel_exp', 0.5);
  this.multiplyVar('politics_exp', 0.5);
  this.multiplyVar('charm_exp', 0.5);
  
  // 랭크 초기화
  if (this.rank) {
    for (const key of Object.keys(this.rank)) {
      this.setRankVar(key, 0);
    }
  }
  
  // 로그 기록
  if (logger) {
    logger.pushGlobalActionLog(`${generalName}(이)가 은퇴하고 그 자손이 유지를 이어받았습니다.`);
    logger.pushGeneralActionLog('나이가 들어 은퇴하고 자손에게 자리를 물려줍니다.');
  }
};

// ========================================
// 포로 시스템 메서드
// ========================================

/**
 * 포로 여부 확인
 * PHP 대응: ConquerCity에서 포로 처리
 * 
 * @returns 포로 여부
 */
GeneralSchema.methods.isPrisoner = function(): boolean {
  const prisonerOf = this.data?.prisoner_of ?? 0;
  return prisonerOf > 0;
};

/**
 * 포로로 잡힌 국가 ID 조회
 * 
 * @returns 포로로 잡힌 국가 ID (0이면 포로 아님)
 */
GeneralSchema.methods.getPrisonerOf = function(): number {
  return this.data?.prisoner_of ?? 0;
};

/**
 * 포로로 설정
 * 
 * @param capturerNationId - 포로로 잡은 국가 ID
 */
GeneralSchema.methods.setPrisoner = function(capturerNationId: number): void {
  this.setVar('prisoner_of', capturerNationId);
  // 포로가 되면 병력 0
  this.setVar('crew', 0);
  // 부대에서 제외
  this.setVar('troop', 0);
};

/**
 * 포로 해방 (재야로 전환)
 */
GeneralSchema.methods.releasePrisoner = function(): void {
  this.setVar('prisoner_of', 0);
  this.setVar('nation', 0);
  this.setVar('officer_level', 1);
  this.setVar('officer_city', 0);
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
