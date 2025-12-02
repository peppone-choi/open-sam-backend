/**
 * TriggerManager - 전투 트리거 관리자
 * 
 * PHP BaseWarUnitTrigger, ObjectTrigger 시스템을 TypeScript로 변환
 * 전투 중 발생하는 모든 특수 효과(필살, 회피, 계략 등)를 관리
 * 
 * @module core/battle/triggers/TriggerManager
 */

import { BattleUnit3D, BattleState } from '../types';
import { DamageResult, DamageCalculator } from '../DamageCalculator';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 트리거 발동 타이밍
 * PHP ObjectTrigger::PRIORITY_* 참조
 */
export type TriggerTiming =
  | 'before_battle'        // 전투 시작 전
  | 'before_attack'        // 공격 전 (필살시도, 계략시도 등)
  | 'after_attack'         // 공격 후 (필살발동, 계략발동 등)
  | 'before_defense'       // 방어 전 (회피시도 등)
  | 'after_defense'        // 방어 후 (회피발동 등)
  | 'on_damage'            // 데미지 적용 시
  | 'on_critical'          // 크리티컬 발생 시 (격노 등)
  | 'on_evade'             // 회피 성공 시 (격노 등)
  | 'on_retreat'           // 퇴각 시
  | 'on_death'             // 사망 시
  | 'on_tactics'           // 계략 단계
  | 'on_phase_start'       // 페이즈 시작 시
  | 'on_phase_end';        // 페이즈 종료 시

/**
 * 트리거 우선순위 (PHP PRIORITY_* 참조)
 */
export const TriggerPriority = {
  BEGIN: 0,                // 최우선 (스킬 활성화 등)
  PRE: 100,                // 시도 단계 (필살시도, 회피시도)
  NORMAL: 200,             // 일반
  POST: 300,               // 발동 단계 (필살발동, 회피발동)
  END: 500,                // 최후순위
} as const;

/**
 * 전투 환경 변수 (PHP $selfEnv, $opposeEnv 참조)
 */
export interface BattleEnvironment {
  // 활성화된 스킬들
  activatedSkills: Set<string>;
  
  // 트리거 발동 여부 추적
  triggeredFlags: Map<string, boolean>;
  
  // 계략 정보
  magic?: {
    name: string;
    damage: number;
  };
  
  // 저격 정보
  sniperInfo?: {
    addAtmos: number;
    woundMin: number;
    woundMax: number;
    raiseType: number;
  };
  
  // 약탈 정보
  theftRatio?: number;
  
  // 전투력 배율
  warPowerMultiplier: number;
  
  // 추가 데미지/방어
  bonusDamage: number;
  bonusDefense: number;
  
  // 페이즈 조정
  phaseAdjustment: number;
  bonusPhase: number;
  
  // 부상
  injury: number;
  
  // 기타 커스텀 데이터
  custom: Record<string, any>;
}

/**
 * 전투 컨텍스트 (트리거 실행용)
 */
export interface TriggerContext {
  battleId: string;
  turn: number;
  phase: number;
  maxPhase: number;
  
  self: BattleUnit3D;
  oppose: BattleUnit3D;
  
  selfEnv: BattleEnvironment;
  opposeEnv: BattleEnvironment;
  
  isAttacker: boolean;
  
  // 데미지 계산기 참조
  damageCalculator: DamageCalculator;
  
  // 전투 상태
  battleState: BattleState;
  
  // RNG (시드 기반 랜덤)
  rng: RandomGenerator;
  
  // 로그
  logs: BattleLog[];
}

/**
 * 전투 로그
 */
export interface BattleLog {
  unitId: string;
  type: 'action' | 'detail' | 'system';
  message: string;
  timestamp: number;
}

/**
 * 트리거 결과
 */
export interface TriggerResult {
  triggered: boolean;
  continueChain: boolean;  // 다음 트리거 실행 여부 (false면 체인 중단)
  
  // 데미지 관련
  damageMultiplier?: number;
  bonusDamage?: number;
  
  // 방어 관련
  defenseMultiplier?: number;
  bonusDefense?: number;
  
  // 회복
  heal?: number;
  injuryHeal?: number;
  
  // 상태 효과
  activateSkills?: string[];
  deactivateSkills?: string[];
  
  // 페이즈 조정
  phaseAdjust?: number;
  bonusPhaseAdjust?: number;
  
  // 리소스 변경
  goldChange?: number;
  riceChange?: number;
  atmosChange?: number;
  
  // 로그 메시지
  selfMessage?: string;
  opposeMessage?: string;
  
  // 추가 효과
  effects?: string[];
}

/**
 * 트리거 인터페이스
 */
export interface ITrigger {
  id: string;
  name: string;
  timing: TriggerTiming;
  priority: number;
  
  // 조건 체크
  condition(ctx: TriggerContext): boolean;
  
  // 효과 실행
  execute(ctx: TriggerContext): TriggerResult;
}

/**
 * 랜덤 생성기 인터페이스
 */
export interface RandomGenerator {
  next(): number;  // 0~1 사이 랜덤
  nextBool(probability: number): boolean;  // 확률 판정
  nextRange(min: number, max: number): number;  // 범위 내 랜덤
  nextRangeInt(min: number, max: number): number;  // 정수 범위 내 랜덤
  choice<T>(arr: T[]): T;  // 배열에서 랜덤 선택
}

// ============================================================================
// 기본 구현체
// ============================================================================

/**
 * 기본 랜덤 생성기 (Math.random 기반)
 */
export class DefaultRandomGenerator implements RandomGenerator {
  next(): number {
    return Math.random();
  }
  
  nextBool(probability: number): boolean {
    return this.next() < probability;
  }
  
  nextRange(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
  
  nextRangeInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/**
 * 시드 기반 랜덤 생성기 (재현 가능)
 */
export class SeededRandomGenerator implements RandomGenerator {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    // Mulberry32 알고리즘
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  nextBool(probability: number): boolean {
    return this.next() < probability;
  }
  
  nextRange(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
  
  nextRangeInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/**
 * 기본 전투 환경 생성
 */
export function createBattleEnvironment(): BattleEnvironment {
  return {
    activatedSkills: new Set(),
    triggeredFlags: new Map(),
    warPowerMultiplier: 1.0,
    bonusDamage: 0,
    bonusDefense: 0,
    phaseAdjustment: 0,
    bonusPhase: 0,
    injury: 0,
    custom: {},
  };
}

// ============================================================================
// TriggerManager 클래스
// ============================================================================

/**
 * 트리거 관리자
 * 
 * PHP BaseWarUnitTrigger 시스템을 TypeScript로 구현
 * 모든 전투 트리거를 등록하고 타이밍에 맞게 실행
 */
export class TriggerManager {
  private triggers: Map<string, ITrigger> = new Map();
  private triggersByTiming: Map<TriggerTiming, ITrigger[]> = new Map();
  
  constructor() {
    // 타이밍별 트리거 배열 초기화
    const timings: TriggerTiming[] = [
      'before_battle', 'before_attack', 'after_attack',
      'before_defense', 'after_defense', 'on_damage',
      'on_critical', 'on_evade', 'on_retreat', 'on_death',
      'on_tactics', 'on_phase_start', 'on_phase_end'
    ];
    
    for (const timing of timings) {
      this.triggersByTiming.set(timing, []);
    }
  }
  
  /**
   * 트리거 등록
   */
  register(trigger: ITrigger): void {
    if (this.triggers.has(trigger.id)) {
      console.warn(`Trigger ${trigger.id} already registered, overwriting`);
    }
    
    this.triggers.set(trigger.id, trigger);
    
    // 타이밍별 배열에 추가
    const list = this.triggersByTiming.get(trigger.timing);
    if (list) {
      list.push(trigger);
      // 우선순위로 정렬
      list.sort((a, b) => a.priority - b.priority);
    }
  }
  
  /**
   * 트리거 제거
   */
  unregister(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return;
    
    this.triggers.delete(triggerId);
    
    const list = this.triggersByTiming.get(trigger.timing);
    if (list) {
      const idx = list.findIndex(t => t.id === triggerId);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
  }
  
  /**
   * 특정 타이밍의 모든 트리거 실행
   * 
   * @param timing 실행할 타이밍
   * @param ctx 전투 컨텍스트
   * @returns 모든 트리거 결과 배열
   */
  executeTriggers(timing: TriggerTiming, ctx: TriggerContext): TriggerResult[] {
    const triggers = this.triggersByTiming.get(timing) || [];
    const results: TriggerResult[] = [];
    
    for (const trigger of triggers) {
      try {
        // 조건 체크
        if (!trigger.condition(ctx)) {
          continue;
        }
        
        // 트리거 실행
        const result = trigger.execute(ctx);
        results.push(result);
        
        // 결과 적용
        this.applyTriggerResult(ctx, result);
        
        // 체인 중단 체크
        if (!result.continueChain) {
          break;
        }
      } catch (error) {
        console.error(`Trigger ${trigger.id} execution failed:`, error);
        // 에러가 발생해도 다음 트리거 실행 계속
      }
    }
    
    return results;
  }
  
  /**
   * 트리거 결과를 컨텍스트에 적용
   */
  private applyTriggerResult(ctx: TriggerContext, result: TriggerResult): void {
    if (!result.triggered) return;
    
    const { selfEnv, opposeEnv, self, oppose } = ctx;
    
    // 데미지 배율 적용
    if (result.damageMultiplier !== undefined) {
      selfEnv.warPowerMultiplier *= result.damageMultiplier;
    }
    
    // 보너스 데미지
    if (result.bonusDamage !== undefined) {
      selfEnv.bonusDamage += result.bonusDamage;
    }
    
    // 방어 배율
    if (result.defenseMultiplier !== undefined) {
      selfEnv.bonusDefense *= result.defenseMultiplier;
    }
    
    // 페이즈 조정
    if (result.phaseAdjust !== undefined) {
      selfEnv.phaseAdjustment += result.phaseAdjust;
      opposeEnv.phaseAdjustment += result.phaseAdjust;
    }
    
    // 보너스 페이즈
    if (result.bonusPhaseAdjust !== undefined) {
      selfEnv.bonusPhase += result.bonusPhaseAdjust;
    }
    
    // 스킬 활성화
    if (result.activateSkills) {
      for (const skill of result.activateSkills) {
        selfEnv.activatedSkills.add(skill);
      }
    }
    
    // 스킬 비활성화
    if (result.deactivateSkills) {
      for (const skill of result.deactivateSkills) {
        selfEnv.activatedSkills.delete(skill);
      }
    }
    
    // 로그 추가
    if (result.selfMessage) {
      ctx.logs.push({
        unitId: self.id,
        type: 'detail',
        message: result.selfMessage,
        timestamp: Date.now(),
      });
    }
    
    if (result.opposeMessage) {
      ctx.logs.push({
        unitId: oppose.id,
        type: 'detail',
        message: result.opposeMessage,
        timestamp: Date.now(),
      });
    }
  }
  
  /**
   * 유닛의 특정 스킬 활성화 여부 확인
   */
  hasActivatedSkill(env: BattleEnvironment, skill: string): boolean {
    return env.activatedSkills.has(skill);
  }
  
  /**
   * 스킬 활성화
   */
  activateSkill(env: BattleEnvironment, ...skills: string[]): void {
    for (const skill of skills) {
      env.activatedSkills.add(skill);
    }
  }
  
  /**
   * 스킬 비활성화
   */
  deactivateSkill(env: BattleEnvironment, ...skills: string[]): void {
    for (const skill of skills) {
      env.activatedSkills.delete(skill);
    }
  }
  
  /**
   * 트리거 발동 여부 체크/설정
   */
  hasTriggered(env: BattleEnvironment, triggerId: string): boolean {
    return env.triggeredFlags.get(triggerId) ?? false;
  }
  
  setTriggered(env: BattleEnvironment, triggerId: string, value: boolean = true): void {
    env.triggeredFlags.set(triggerId, value);
  }
  
  /**
   * 전투력 배율 설정
   */
  setWarPowerMultiplier(env: BattleEnvironment, multiplier: number): void {
    env.warPowerMultiplier = multiplier;
  }
  
  /**
   * 전투력 배율 곱하기
   */
  multiplyWarPowerMultiplier(env: BattleEnvironment, multiplier: number): void {
    env.warPowerMultiplier *= multiplier;
  }
  
  /**
   * 등록된 모든 트리거 목록 반환
   */
  getAllTriggers(): ITrigger[] {
    return Array.from(this.triggers.values());
  }
  
  /**
   * 특정 타이밍의 트리거 목록 반환
   */
  getTriggersForTiming(timing: TriggerTiming): ITrigger[] {
    return this.triggersByTiming.get(timing) || [];
  }
  
  /**
   * 트리거 조회
   */
  getTrigger(triggerId: string): ITrigger | undefined {
    return this.triggers.get(triggerId);
  }
  
  /**
   * 모든 트리거 초기화
   */
  clear(): void {
    this.triggers.clear();
    for (const list of this.triggersByTiming.values()) {
      list.length = 0;
    }
  }
}

// ============================================================================
// 기본 트리거 클래스
// ============================================================================

/**
 * 기본 트리거 추상 클래스
 * PHP BaseWarUnitTrigger 참조
 */
export abstract class BaseTrigger implements ITrigger {
  abstract id: string;
  abstract name: string;
  abstract timing: TriggerTiming;
  abstract priority: number;
  
  /**
   * 기본 조건 (항상 true)
   * 서브클래스에서 override
   */
  condition(ctx: TriggerContext): boolean {
    return true;
  }
  
  /**
   * 트리거 효과 실행
   * 서브클래스에서 구현 필수
   */
  abstract execute(ctx: TriggerContext): TriggerResult;
  
  /**
   * 트리거 발동 안함 결과 반환
   */
  protected notTriggered(): TriggerResult {
    return {
      triggered: false,
      continueChain: true,
    };
  }
  
  /**
   * 트리거 발동 결과 반환
   */
  protected triggered(options: Partial<TriggerResult> = {}): TriggerResult {
    return {
      triggered: true,
      continueChain: true,
      ...options,
    };
  }
  
  /**
   * 체인 중단 결과 반환
   */
  protected stopChain(options: Partial<TriggerResult> = {}): TriggerResult {
    return {
      triggered: true,
      continueChain: false,
      ...options,
    };
  }
  
  /**
   * 크리티컬 데미지 배율 계산
   * PHP criticalDamage() 참조
   */
  protected calculateCriticalDamage(ctx: TriggerContext): number {
    const { strength } = ctx.self;
    // 무력에 따른 크리티컬 데미지 (1.3 ~ 2.0)
    const baseCrit = 1.3;
    const maxCrit = 2.0;
    const critBonus = Math.min((strength - 65) / 100, 0.7);
    return Math.min(baseCrit + critBonus, maxCrit);
  }
  
  /**
   * 지능 기반 크리티컬 데미지
   */
  protected calculateIntelCriticalDamage(ctx: TriggerContext): number {
    const { intelligence } = ctx.self;
    const baseCrit = 1.3;
    const maxCrit = 2.0;
    const critBonus = Math.min((intelligence - 65) / 100, 0.7);
    return Math.min(baseCrit + critBonus, maxCrit);
  }
}

// ============================================================================
// 싱글톤 인스턴스
// ============================================================================

/**
 * 전역 트리거 관리자 인스턴스
 */
export const triggerManager = new TriggerManager();


