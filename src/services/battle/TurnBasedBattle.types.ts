/**
 * TurnBasedBattle.types.ts
 * 삼국지 스타일 턴제 전투 시스템 타입 정의
 */

import { Position3D } from '../../core/battle/types';
import { Formation } from '../../core/battle/interfaces/Formation';

// ============================================================================
// 그리드 & 맵 관련
// ============================================================================

/** 그리드 크기 상수 */
export const GRID_SIZE = 40;
export const MAP_WIDTH = GRID_SIZE;
export const MAP_HEIGHT = GRID_SIZE;

/** 2D 그리드 좌표 */
export interface GridPosition {
  x: number;  // 0-39
  y: number;  // 0-39
}

/** 지형 타입 */
export type TerrainType = 
  | 'plain'      // 평지
  | 'forest'     // 숲
  | 'hill'       // 언덕
  | 'mountain'   // 산
  | 'water'      // 물
  | 'swamp'      // 늪
  | 'castle'     // 성
  | 'road';      // 도로

/** 지형 효과 */
export interface TerrainEffect {
  moveCost: number;        // 이동 비용 배수
  defenseBonus: number;    // 방어력 보정 (%)
  attackPenalty: number;   // 공격력 페널티 (%)
  passable: boolean;       // 통과 가능 여부
  cavalryPassable: boolean; // 기병 통과 가능
  description: string;
}

/** 전투 맵 타일 */
export interface BattleTile {
  position: GridPosition;
  terrain: TerrainType;
  elevation: number;       // 고도 (0-10)
  occupiedBy?: string;     // 유닛 ID
  effects?: string[];      // 특수 효과 (연기, 화염 등)
}

/** 40x40 전투 맵 */
export type BattleMap = BattleTile[][];

// ============================================================================
// 병종 시스템
// ============================================================================

/** 기본 병종 카테고리 */
export type UnitCategory = 
  | 'infantry'   // 보병 (1100~)
  | 'cavalry'    // 기병 (1300~)
  | 'archer'     // 궁병 (1200~)
  | 'wizard'     // 책사 (1400~)
  | 'siege'      // 공성 (1500~)
  | 'navy';      // 수군

/** 병종 ID 범위에 따른 카테고리 판별 */
export function getUnitCategory(crewTypeId: number): UnitCategory {
  if (crewTypeId >= 1000 && crewTypeId < 1100) return 'infantry'; // 성벽 등 특수
  if (crewTypeId >= 1100 && crewTypeId < 1200) return 'infantry';
  if (crewTypeId >= 1200 && crewTypeId < 1300) return 'archer';
  if (crewTypeId >= 1300 && crewTypeId < 1400) return 'cavalry';
  if (crewTypeId >= 1400 && crewTypeId < 1500) return 'wizard';
  if (crewTypeId >= 1500 && crewTypeId < 1600) return 'siege';
  return 'infantry'; // 기본값
}

/** 병종 데이터 */
export interface UnitTypeData {
  id: number;
  type: string;           // FOOTMAN, ARCHER, CAVALRY, etc.
  name: string;
  cost: { gold: number; rice: number };
  stats: {
    offense: number;
    defense: number;
    speed: number;
    attackRange?: number;
    defenseRange?: number;
  };
  description: string[];
}

// ============================================================================
// 전투 유닛
// ============================================================================

/** 턴제 전투 유닛 */
export interface TurnBasedUnit {
  id: string;
  name: string;
  
  // 장수 정보
  generalId: number;
  generalName: string;
  
  // 진영
  side: 'attacker' | 'defender';
  playerId: number;
  
  // 위치
  position: GridPosition;
  facing: number;          // 바라보는 방향 (0-360도)
  
  // 병종
  crewTypeId: number;      // units.json의 ID
  crewTypeName: string;
  category: UnitCategory;
  
  // 병력
  troops: number;          // 현재 병사 수
  maxTroops: number;       // 최대 병사 수
  
  // 스탯
  attack: number;          // 공격력 (장수 무력 + 병종 offense)
  defense: number;         // 방어력 (장수 통솔 + 병종 defense)
  speed: number;           // 속도 (병종 speed)
  attackRange: number;     // 공격 사거리 (1: 근접, 2+: 원거리)
  moveRange: number;       // 이동 범위
  
  // 상태
  morale: number;          // 사기 (0-100)
  training: number;        // 훈련도 (0-100)
  hp: number;              // 체력
  maxHp: number;
  
  // 진형
  formation: Formation;
  
  // 턴 상태
  hasActed: boolean;       // 이번 턴 행동 완료
  hasMoved: boolean;       // 이번 턴 이동 완료
  hasAttacked: boolean;    // 이번 턴 공격 완료
  
  // 특수 상태
  isRouting: boolean;      // 패주 중
  buffs: UnitBuff[];
  debuffs: UnitDebuff[];
}

/** 버프 효과 */
export interface UnitBuff {
  type: string;
  value: number;
  duration: number;        // 남은 턴
}

/** 디버프 효과 */
export interface UnitDebuff {
  type: string;
  value: number;
  duration: number;
}

// ============================================================================
// 턴제 전투 흐름
// ============================================================================

/** 턴 페이즈 */
export type TurnPhase = 
  | 'start'        // 턴 시작 (버프/디버프 처리)
  | 'action'       // 행동 (속도순)
  | 'counter'      // 반격
  | 'end';         // 턴 종료 (사기 체크)

/** 액션 타입 */
export type ActionType = 
  | 'move'         // 이동
  | 'attack'       // 공격
  | 'skill'        // 스킬 사용
  | 'defend'       // 방어
  | 'wait'         // 대기
  | 'retreat';     // 후퇴

/** 전투 액션 */
export interface BattleAction {
  unitId: string;
  type: ActionType;
  targetPosition?: GridPosition;
  targetUnitId?: string;
  skillId?: string;
  path?: GridPosition[];
}

/** 액션 결과 */
export interface ActionResult {
  action: BattleAction;
  success: boolean;
  damage?: number;
  counterDamage?: number;
  casualties?: number;
  counterCasualties?: number;
  moraleLoss?: number;
  effects: string[];
  critical?: boolean;
  evaded?: boolean;
}

/** 턴 결과 */
export interface TurnResult {
  turnNumber: number;
  actionOrder: string[];   // 행동 순서 (유닛 ID)
  actions: ActionResult[];
  eliminatedUnits: string[];
  routingUnits: string[];
  victoryCondition?: VictoryCondition;
}

// ============================================================================
// 데미지 계산
// ============================================================================

/** 데미지 계산 파라미터 */
export interface DamageCalculationParams {
  attacker: TurnBasedUnit;
  defender: TurnBasedUnit;
  terrain: TerrainType;
  isCounter: boolean;      // 반격인지
}

/** 데미지 계산 결과 */
export interface DamageResult {
  baseDamage: number;
  attackPower: number;
  troopModifier: number;
  compatibilityModifier: number;  // 상성 보정
  formationModifier: number;      // 진형 보정
  terrainModifier: number;        // 지형 보정
  defenseReduction: number;
  finalDamage: number;
  casualties: number;             // 사상자 수
  isCritical: boolean;
  isEvaded: boolean;
  description: string;
}

// ============================================================================
// 전투 상태
// ============================================================================

/** 전투 상태 */
export interface TurnBasedBattleState {
  battleId: string;
  sessionId: string;
  
  // 참가자
  attackerPlayerId: number;
  defenderPlayerId: number;
  attackerNationId: number;
  defenderNationId: number;
  
  // 맵
  map: BattleMap;
  
  // 유닛
  units: Map<string, TurnBasedUnit>;
  unitOrder: string[];     // 속도순 행동 순서
  
  // 턴 정보
  currentTurn: number;
  maxTurns: number;        // 최대 턴 제한
  currentPhase: TurnPhase;
  activeUnitIndex: number; // 현재 행동 중인 유닛
  
  // 전투 로그
  battleLog: BattleLogEntry[];
  turnHistory: TurnResult[];
  
  // 종료 조건
  winner?: 'attacker' | 'defender' | 'draw';
  victoryCondition?: VictoryCondition;
  isFinished: boolean;
  
  // 타임스탬프
  startedAt: Date;
  finishedAt?: Date;
}

/** 전투 로그 엔트리 */
export interface BattleLogEntry {
  turn: number;
  phase: TurnPhase;
  timestamp: Date;
  message: string;
  details?: Record<string, unknown>;
}

/** 승리 조건 */
export interface VictoryCondition {
  type: 'elimination' | 'rout' | 'objective' | 'time_limit' | 'surrender';
  winner: 'attacker' | 'defender' | 'draw';
  reason: string;
}

// ============================================================================
// 전투 설정
// ============================================================================

/** 전투 생성 파라미터 */
export interface CreateTurnBasedBattleParams {
  sessionId: string;
  attackerPlayerId: number;
  defenderPlayerId: number;
  attackerNationId: number;
  defenderNationId: number;
  attackerUnits: TurnBasedUnitInit[];
  defenderUnits: TurnBasedUnitInit[];
  mapTemplate?: string;
  maxTurns?: number;
}

/** 유닛 초기화 데이터 */
export interface TurnBasedUnitInit {
  generalId: number;
  generalName: string;
  crewTypeId: number;
  troops: number;
  attack: number;
  defense: number;
  morale: number;
  training: number;
  formation?: Formation;
}

/** 전투 설정 */
export interface TurnBasedBattleConfig {
  maxTurns: number;
  gridSize: number;
  criticalChance: number;       // 치명타 확률 (%)
  evasionChance: number;        // 회피 확률 (%)
  moraleThreshold: number;      // 패주 사기 임계값
  counterAttackEnabled: boolean;
  formationEnabled: boolean;
  terrainEnabled: boolean;
}

/** 기본 전투 설정 */
export const DEFAULT_BATTLE_CONFIG: TurnBasedBattleConfig = {
  maxTurns: 50,
  gridSize: 40,
  criticalChance: 10,
  evasionChance: 5,
  moraleThreshold: 0,
  counterAttackEnabled: true,
  formationEnabled: true,
  terrainEnabled: true,
};




