/**
 * Battle System - 전투 시스템 통합 Export
 *
 * MUG 스타일 전투 시스템:
 * - engines: 전투 타입별 엔진 (야전, 공성, 수비)
 * - phases: 전투 페이즈 (접근, 교전, 추격/퇴각, 결과)
 * - crews: 병종별 전투 특성
 * - commands: 전투 명령 (공격, 이동, 화공 등)
 * - modifiers: 전투 보정 (지형, 날씨, 사기 등)
 */

// 기존 전투 유닛 및 프로세스
export { WarUnit } from './WarUnit';
export { WarUnitGeneral } from './WarUnitGeneral';
export { WarUnitCity } from './WarUnitCity';
export { processWar, processWar_NG, ConquerCity } from './ProcessWar';
export { extractBattleOrder, sortDefendersByBattleOrder } from './extractBattleOrder';

// MUG 전투 엔진
export * from './engines/BattleType';
export * from './engines/BaseBattleEngine';
export * from './engines/FieldBattleEngine';
export * from './engines/SiegeBattleEngine';
export * from './engines/DefenseBattleEngine';

// 전투 페이즈
export * from './phases';

// 병종 전투 특성
export * from './crews';

// 전투 명령
export * from './commands';

// 전투 보정
export * from './modifiers';

// 난수 생성
export { SeedRandom } from './random';
