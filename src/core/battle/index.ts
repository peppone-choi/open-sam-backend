/**
 * Battle System Exports
 * 
 * Agent C: 전투 엔진 코어
 * - BattleEngine: 기본 전투 엔진
 * - DamageCalculator: 데미지 계산 시스템
 * - BattlePhaseManager: 전투 페이즈 관리
 * - SiegeEngine: 공성전 시스템
 * 
 * Agent D: 전투 트리거/효과
 * - TriggerManager: 트리거 관리자
 * - AttackTriggers: 공격 트리거 (필살, 저격, 선제사격 등)
 * - DefenseTriggers: 방어 트리거 (회피, 저지, 부상무효 등)
 * - TacticsTriggers: 계략 트리거 (계략, 반계, 위압)
 * - SpecialTriggers: 특수 트리거 (격노, 치료, 스킬활성화 등)
 */

export * from './types';
export * from './BattleEngine';
export * from './BattleValidator';
export * from './BattleResolver';
export * from './BattleAI';
export * from './TurnBasedBattleEngine';
export * from './interfaces/Formation';

// Agent C 신규 구현 모듈
export * from './DamageCalculator';
export * from './BattlePhaseManager';
export * from './SiegeEngine';

// Agent D: 전투 트리거/효과 시스템
export * from './triggers';
