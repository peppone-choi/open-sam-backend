/**
 * Battle Triggers System
 * 
 * PHP WarUnitTrigger 시스템을 TypeScript로 완전 변환
 * 
 * 전투 중 발동하는 모든 특수 효과(필살, 회피, 계략 등)를 관리
 * 
 * @module core/battle/triggers
 * 
 * ## 구조
 * - TriggerManager: 트리거 등록/실행 관리자
 * - AttackTriggers: 공격 관련 트리거 (11개)
 * - DefenseTriggers: 방어 관련 트리거 (9개)
 * - TacticsTriggers: 계략 관련 트리거 (7개)
 * - SpecialTriggers: 특수/이벤트 트리거 (다수)
 * 
 * ## 사용법
 * ```typescript
 * import { TriggerManager, initializeAllTriggers, createTriggerContext } from './triggers';
 * 
 * // 트리거 매니저 초기화
 * const manager = new TriggerManager();
 * initializeAllTriggers(manager);
 * 
 * // 전투 컨텍스트 생성
 * const ctx = createTriggerContext(battleState, attacker, defender);
 * 
 * // 트리거 실행
 * const results = manager.executeTriggers('before_attack', ctx);
 * ```
 */

// ============================================================================
// 핵심 모듈 Export
// ============================================================================

export * from './TriggerManager';
export * from './AttackTriggers';
export * from './DefenseTriggers';
export * from './TacticsTriggers';
export * from './SpecialTriggers';

// ============================================================================
// Import
// ============================================================================

import {
  TriggerManager,
  TriggerContext,
  BattleEnvironment,
  createBattleEnvironment,
  DefaultRandomGenerator,
  SeededRandomGenerator,
  triggerManager,
  ITrigger,
} from './TriggerManager';

import { allAttackTriggers } from './AttackTriggers';
import { allDefenseTriggers } from './DefenseTriggers';
import { allTacticsTriggers } from './TacticsTriggers';
import { allSpecialTriggers } from './SpecialTriggers';

import { BattleState, BattleUnit3D } from '../types';
import { DamageCalculator, damageCalculator } from '../DamageCalculator';

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 모든 트리거 반환
 */
export function getAllTriggers(): ITrigger[] {
  return [
    ...allAttackTriggers,
    ...allDefenseTriggers,
    ...allTacticsTriggers,
    ...allSpecialTriggers,
  ];
}

/**
 * TriggerManager에 모든 기본 트리거 등록
 */
export function initializeAllTriggers(manager: TriggerManager): void {
  const triggers = getAllTriggers();
  
  for (const trigger of triggers) {
    manager.register(trigger);
  }
  
  console.log(`Initialized ${triggers.length} battle triggers`);
}

/**
 * 전역 트리거 매니저 초기화
 */
export function initializeGlobalTriggerManager(): TriggerManager {
  initializeAllTriggers(triggerManager);
  return triggerManager;
}

/**
 * 전투 컨텍스트 생성 헬퍼
 */
export function createTriggerContext(
  battleState: BattleState,
  self: BattleUnit3D,
  oppose: BattleUnit3D,
  options: {
    isAttacker?: boolean;
    phase?: number;
    maxPhase?: number;
    turn?: number;
    seed?: number;
  } = {}
): TriggerContext {
  const {
    isAttacker = true,
    phase = 0,
    maxPhase = 3,
    turn = battleState.currentTurn,
    seed,
  } = options;
  
  return {
    battleId: battleState.battleId,
    turn,
    phase,
    maxPhase,
    self,
    oppose,
    selfEnv: createBattleEnvironment(),
    opposeEnv: createBattleEnvironment(),
    isAttacker,
    damageCalculator,
    battleState,
    rng: seed !== undefined ? new SeededRandomGenerator(seed) : new DefaultRandomGenerator(),
    logs: [],
  };
}

/**
 * 트리거 통계 정보
 */
export function getTriggerStats(): {
  total: number;
  byCategory: Record<string, number>;
  byTiming: Record<string, number>;
} {
  const all = getAllTriggers();
  
  const byCategory = {
    attack: allAttackTriggers.length,
    defense: allDefenseTriggers.length,
    tactics: allTacticsTriggers.length,
    special: allSpecialTriggers.length,
  };
  
  const byTiming: Record<string, number> = {};
  for (const trigger of all) {
    byTiming[trigger.timing] = (byTiming[trigger.timing] || 0) + 1;
  }
  
  return {
    total: all.length,
    byCategory,
    byTiming,
  };
}

// ============================================================================
// 트리거 실행 헬퍼
// ============================================================================

/**
 * 전투 시작 트리거 실행
 */
export function executeBattleStartTriggers(
  manager: TriggerManager,
  ctx: TriggerContext
): void {
  manager.executeTriggers('before_battle', ctx);
}

/**
 * 공격 페이즈 트리거 실행
 */
export function executeAttackPhaseTriggers(
  manager: TriggerManager,
  ctx: TriggerContext
): void {
  manager.executeTriggers('before_attack', ctx);
  manager.executeTriggers('after_attack', ctx);
}

/**
 * 방어 페이즈 트리거 실행
 */
export function executeDefensePhaseTriggers(
  manager: TriggerManager,
  ctx: TriggerContext
): void {
  manager.executeTriggers('before_defense', ctx);
  manager.executeTriggers('after_defense', ctx);
}

/**
 * 계략 페이즈 트리거 실행
 */
export function executeTacticsPhaseTriggers(
  manager: TriggerManager,
  ctx: TriggerContext
): void {
  manager.executeTriggers('on_tactics', ctx);
}

/**
 * 페이즈 시작/종료 트리거 실행
 */
export function executePhaseTransitionTriggers(
  manager: TriggerManager,
  ctx: TriggerContext,
  isStart: boolean
): void {
  manager.executeTriggers(isStart ? 'on_phase_start' : 'on_phase_end', ctx);
}

// ============================================================================
// Re-export 싱글톤
// ============================================================================

export { triggerManager, damageCalculator };


