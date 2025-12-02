/**
 * 통합 Battle 시스템
 * 삼국지(턴제) + 은하영웅전설(실시간) 전투 통합
 */

import {
  IGridPosition,
  IGridPosition3D,
  IContinuousPosition,
  IMapSize,
} from './Position';
import {
  BattleUnit,
  ISamgukjiUnit,
  ILoghUnit,
} from './Unit';
import { Formation, LoghFormation } from './Formation';
import { IBattleEventEmitter, BattleLog } from './Event';

// ============================================================================
// 공통 타입
// ============================================================================

/**
 * 전투 타입 식별자
 */
export type BattleType = 'turn-based' | 'realtime';

/**
 * 전투 상태
 */
export type BattleStatus =
  | 'preparing'     // 준비 중
  | 'deployment'    // 배치 단계
  | 'ongoing'       // 진행 중
  | 'paused'        // 일시 정지
  | 'finished';     // 종료

/**
 * 전투 결과
 */
export type BattleResult =
  | 'attacker_win'  // 공격측 승리
  | 'defender_win'  // 방어측 승리
  | 'draw'          // 무승부
  | 'ongoing';      // 진행 중

/**
 * 승리 조건 타입
 */
export type VictoryConditionType =
  | 'elimination'       // 전멸
  | 'throne_captured'   // 본진 점령
  | 'time_limit'        // 시간 제한
  | 'surrender'         // 항복
  | 'retreat'           // 퇴각
  | 'morale_collapse'   // 사기 붕괴
  | 'objective_complete'; // 목표 달성

/**
 * 승리 조건
 */
export interface IVictoryCondition {
  type: VictoryConditionType;
  winner: 'attacker' | 'defender';
  reason: string;
}

// ============================================================================
// 지형 시스템
// ============================================================================

/**
 * 지형 타입 (삼국지)
 */
export enum TerrainType {
  PLAIN = 'PLAIN',           // 평지
  FOREST = 'FOREST',         // 숲
  MOUNTAIN = 'MOUNTAIN',     // 산
  SHALLOW_WATER = 'SHALLOW_WATER', // 얕은 물
  DEEP_WATER = 'DEEP_WATER', // 깊은 물
  HILL_LOW = 'HILL_LOW',     // 낮은 언덕
  HILL_MID = 'HILL_MID',     // 중간 언덕
  HILL_HIGH = 'HILL_HIGH',   // 높은 언덕
  CLIFF = 'CLIFF',           // 절벽
  WALL = 'WALL',             // 성벽
  GATE = 'GATE',             // 성문
  TOWER = 'TOWER',           // 망루
  SKY = 'SKY',               // 하늘
  ROAD = 'ROAD',             // 도로
  BRIDGE = 'BRIDGE',         // 다리
}

/**
 * 높이 레벨 (삼국지 3D)
 */
export enum HeightLevel {
  DEEP_WATER = -2,
  SHALLOW_WATER = -1,
  GROUND = 0,
  HILL_LOW = 2,
  HILL_MID = 5,
  HILL_HIGH = 8,
  WALL_1F = 10,
  WALL_2F = 12,
  WALL_3F = 14,
  FLYING_LOW = 15,
  FLYING_HIGH = 18,
  MAX_HEIGHT = 19,
}

/**
 * 전투 맵 타일 (삼국지)
 */
export interface IBattleTile {
  x: number;
  y: number;
  z: number;
  type: TerrainType;
  walkable: boolean;
  flyable: boolean;
  movementCost: number;    // 이동 비용 (1 = 기본)
  defenseBonus: number;    // 방어 보너스 (%)
  occupied?: string;       // 점령 유닛 ID
  building?: IBuilding;    // 건물 정보
}

/**
 * 건물 정보
 */
export interface IBuilding {
  type: 'wall' | 'gate' | 'tower' | 'throne' | 'camp';
  hp: number;
  maxHp: number;
  z: number;
  owner?: 'attacker' | 'defender';
}

// ============================================================================
// 액션 시스템
// ============================================================================

/**
 * 기본 액션 타입
 */
export type ActionType =
  | 'move'
  | 'attack'
  | 'defend'
  | 'skill'
  | 'wait'
  | 'retreat'
  | 'formation'
  | 'stance';

/**
 * 기본 액션 인터페이스
 */
export interface IAction {
  type: ActionType;
  unitId: string;
  timestamp?: number;
}

/**
 * 이동 액션
 */
export interface IMoveAction extends IAction {
  type: 'move';
  path: IGridPosition[] | IContinuousPosition[];
  destination: IGridPosition | IContinuousPosition;
}

/**
 * 공격 액션
 */
export interface IAttackAction extends IAction {
  type: 'attack';
  targetId: string;
  skillId?: string;  // 특수 공격 스킬
}

/**
 * 방어 액션
 */
export interface IDefendAction extends IAction {
  type: 'defend';
}

/**
 * 스킬 사용 액션
 */
export interface ISkillAction extends IAction {
  type: 'skill';
  skillId: string;
  target: IGridPosition | IContinuousPosition | string;  // 위치 또는 유닛 ID
}

/**
 * 대기 액션
 */
export interface IWaitAction extends IAction {
  type: 'wait';
}

/**
 * 퇴각 액션
 */
export interface IRetreatAction extends IAction {
  type: 'retreat';
  destination?: IGridPosition | IContinuousPosition;
}

/**
 * 진형 변경 액션
 */
export interface IFormationAction extends IAction {
  type: 'formation';
  formation: Formation | LoghFormation;
}

/**
 * 통합 액션 타입
 */
export type Action =
  | IMoveAction
  | IAttackAction
  | IDefendAction
  | ISkillAction
  | IWaitAction
  | IRetreatAction
  | IFormationAction;

// ============================================================================
// 공격 결과
// ============================================================================

/**
 * 공격 결과
 */
export interface IAttackResult {
  success: boolean;
  damage: number;
  actualDamage: number;     // 실제 적용된 피해
  isCritical: boolean;
  isEvaded: boolean;
  isBlocked: boolean;
  killedTroops?: number;    // 삼국지: 병사 사망
  killedShips?: number;     // 은영전: 함선 파괴
  moraleLoss?: number;
  counterAttack?: IAttackResult; // 반격
}

// ============================================================================
// 기본 전투 인터페이스 (공통)
// ============================================================================

/**
 * 전투 설정
 */
export interface IBattleConfig {
  // 맵 크기
  mapSize: IMapSize;

  // 턴/시간 설정
  maxTurns?: number;        // 최대 턴 수 (턴제)
  maxTime?: number;         // 최대 시간 (실시간, 초)
  turnTimeout?: number;     // 턴 제한 시간 (초)

  // 게임 규칙
  allowRetreat: boolean;
  allowSurrender: boolean;
  autoResolve: boolean;     // 자동 전투 가능 여부

  // 승리 조건
  victoryConditions: VictoryConditionType[];
}

/**
 * 기본 전투 인터페이스 (공통)
 */
export interface IBattle {
  // 식별자
  id: string;
  readonly battleType: BattleType;

  // 상태
  status: BattleStatus;
  result: BattleResult;

  // 참여 유닛
  units: Map<string, BattleUnit>;
  attackerUnits: string[];  // 공격측 유닛 ID 목록
  defenderUnits: string[];  // 방어측 유닛 ID 목록

  // 플레이어
  attackerPlayerId: number | string;
  defenderPlayerId: number | string;

  // 시간
  startTime: Date;
  endTime?: Date;

  // 설정
  config: IBattleConfig;

  // 로그
  logs: BattleLog[];

  // 이벤트 시스템
  eventEmitter: IBattleEventEmitter;

  // 공통 메서드
  getUnit(unitId: string): BattleUnit | undefined;
  getAliveUnits(side: 'attacker' | 'defender'): BattleUnit[];
  isUnitTurn?(unitId: string): boolean;
  checkVictoryConditions(): IVictoryCondition | null;
}

// ============================================================================
// 턴제 전투 (삼국지)
// ============================================================================

/**
 * 턴제 전투 페이즈
 */
export type TurnPhase =
  | 'deployment'    // 배치
  | 'planning'      // 계획 (동시 턴제)
  | 'movement'      // 이동
  | 'action'        // 행동
  | 'resolution'    // 해결
  | 'end';          // 종료

/**
 * 턴제 전투 인터페이스 (삼국지)
 */
export interface ITurnBasedBattle extends IBattle {
  readonly battleType: 'turn-based';

  // 턴 정보
  currentTurn: number;
  maxTurns: number;
  phase: TurnPhase;

  // 턴 순서 (유닛 ID 배열)
  turnOrder: string[];
  currentTurnIndex: number;
  activeUnitId: string;

  // 맵 정보
  map: IBattleTile[][];
  buildings: IBuilding[];

  // 계획된 액션 (동시 턴제용)
  plannedActions: Map<string, Action>;
  readyPlayers: Set<number | string>;
  planningDeadline?: Date;

  // AI 제어 유닛
  aiControlled: Set<string>;

  // 턴제 전용 메서드
  startTurn(): void;
  endTurn(): void;
  nextPhase(): void;

  // 이동 관련
  getMovablePositions(unitId: string): IGridPosition[];
  getMoveRange(unitId: string): number;
  moveUnit(unitId: string, path: IGridPosition[]): boolean;

  // 공격 관련
  getAttackableTargets(unitId: string): string[];
  getAttackRange(unitId: string): number;
  attackUnit(attackerId: string, targetId: string): IAttackResult;

  // 스킬 관련
  getUsableSkills(unitId: string): string[];
  useSkill(unitId: string, skillId: string, target: IGridPosition | string): boolean;

  // 유틸리티
  getTileAt(x: number, y: number): IBattleTile | undefined;
  getUnitAt(position: IGridPosition): BattleUnit | undefined;
  calculatePath(from: IGridPosition, to: IGridPosition, unitId: string): IGridPosition[];
}

/**
 * 해결 결과 (동시 턴제)
 */
export interface IResolutionResult {
  casualties: Map<string, number>;      // 유닛별 피해
  moraleLosses: Map<string, number>;    // 유닛별 사기 손실
  buildingDamage: Map<string, number>;  // 건물별 피해
  positions: Map<string, IGridPosition | IGridPosition3D>; // 최종 위치
  effects: string[];                    // 적용된 효과
}

// ============================================================================
// 실시간 전투 (은하영웅전설)
// ============================================================================

/**
 * 실시간 전투 인터페이스 (은하영웅전설)
 */
export interface IRealtimeBattle extends IBattle {
  readonly battleType: 'realtime';

  // 시간 정보
  tickRate: number;         // 틱 속도 (ms), 기본 50ms = 20 ticks/sec
  elapsedTime: number;      // 경과 시간 (초)
  maxTime: number;          // 최대 전투 시간 (초)

  // 맵 정보 (전술 맵)
  tacticalMapId: string;
  mapSize: IMapSize;        // 10000 x 10000

  // 전략 그리드 위치
  strategicPosition: { x: number; y: number };

  // 진영별 함대 ID
  factions: {
    empire: string[];
    alliance: string[];
    neutral?: string[];
  };

  // 일시 정지/배속
  isPaused: boolean;
  timeScale: number;        // 배속 (1.0 = 보통, 2.0 = 2배속)

  // 실시간 전용 메서드
  tick(deltaTime: number): void;
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;

  // 이동 명령
  setDestination(unitId: string, position: IContinuousPosition): boolean;
  setVelocity(unitId: string, velocity: { x: number; y: number }): boolean;
  stopMovement(unitId: string): void;

  // 전투 명령
  setTarget(unitId: string, targetId: string | null): boolean;
  setFormation(unitId: string, formation: LoghFormation): boolean;
  setStance(unitId: string, stance: 'aggressive' | 'defensive' | 'balanced' | 'hold_fire' | 'evasive'): boolean;

  // 유틸리티
  getUnitsInRange(position: IContinuousPosition, range: number): BattleUnit[];
  getEnemiesInRange(unitId: string): BattleUnit[];
  getDistanceBetween(unitId1: string, unitId2: string): number;
}

/**
 * 전투 업데이트 결과 (실시간)
 */
export interface ICombatUpdateResult {
  fleetPositions: Array<{
    fleetId: string;
    x: number;
    y: number;
    heading: number;
  }>;
  combatEvents: Array<{
    type: 'shot' | 'hit' | 'destroy' | 'air_attack' | 'air_intercept';
    sourceFleetId?: string;
    targetFleetId?: string;
    damage?: number;
  }>;
}

// ============================================================================
// 통합 전투 타입
// ============================================================================

/**
 * 모든 전투 타입의 유니온
 */
export type Battle = ITurnBasedBattle | IRealtimeBattle;

// ============================================================================
// 타입 가드
// ============================================================================

/**
 * 턴제 전투인지 확인
 */
export function isTurnBasedBattle(battle: Battle): battle is ITurnBasedBattle {
  return battle.battleType === 'turn-based';
}

/**
 * 실시간 전투인지 확인
 */
export function isRealtimeBattle(battle: Battle): battle is IRealtimeBattle {
  return battle.battleType === 'realtime';
}

// ============================================================================
// 전투 엔진 인터페이스
// ============================================================================

/**
 * 전투 엔진 인터페이스 (공통)
 */
export interface IBattleEngine<T extends Battle = Battle> {
  battle: T;

  // 라이프사이클
  initialize(): Promise<void>;
  start(): void;
  end(result: BattleResult): void;
  cleanup(): void;

  // 액션 처리
  validateAction(action: Action): boolean;
  executeAction(action: Action): Promise<IAttackResult | boolean>;

  // 이벤트
  onBattleStart?: () => void;
  onBattleEnd?: (result: BattleResult) => void;
  onUnitDeath?: (unitId: string) => void;
}

/**
 * 턴제 전투 엔진 인터페이스
 */
export interface ITurnBasedBattleEngine extends IBattleEngine<ITurnBasedBattle> {
  processTurn(): Promise<void>;
  processPhase(): Promise<void>;
  resolveActions(): Promise<IResolutionResult>;

  onTurnStart?: (turn: number) => void;
  onTurnEnd?: (turn: number) => void;
  onPhaseChange?: (phase: TurnPhase) => void;
}

/**
 * 실시간 전투 엔진 인터페이스
 */
export interface IRealtimeBattleEngine extends IBattleEngine<IRealtimeBattle> {
  gameLoop(): void;
  processTick(deltaTime: number): Promise<ICombatUpdateResult>;

  onTick?: (deltaTime: number) => void;
  onCombatEvent?: (event: ICombatUpdateResult['combatEvents'][0]) => void;
}

// ============================================================================
// 전투 팩토리 인터페이스
// ============================================================================

/**
 * 턴제 전투 생성 옵션
 */
export interface ITurnBasedBattleCreateOptions {
  attackerUnits: ISamgukjiUnit[];
  defenderUnits: ISamgukjiUnit[];
  attackerPlayerId: number;
  defenderPlayerId: number;
  mapSize?: IMapSize;
  terrain?: IBattleTile[][];
  maxTurns?: number;
  turnTimeout?: number;
}

/**
 * 실시간 전투 생성 옵션
 */
export interface IRealtimeBattleCreateOptions {
  attackerUnits: ILoghUnit[];
  defenderUnits: ILoghUnit[];
  strategicPosition: { x: number; y: number };
  mapSize?: IMapSize;
  maxTime?: number;
  tickRate?: number;
}

/**
 * 전투 팩토리 인터페이스
 */
export interface IBattleFactory {
  createTurnBasedBattle(options: ITurnBasedBattleCreateOptions): ITurnBasedBattle;
  createRealtimeBattle(options: IRealtimeBattleCreateOptions): IRealtimeBattle;
}




