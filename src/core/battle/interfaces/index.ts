/**
 * 통합 전투 시스템 인터페이스
 * 삼국지(턴제) + 은하영웅전설(실시간) 전투 시스템 통합
 *
 * @module core/battle/interfaces
 */

// ============================================================================
// Position 시스템
// ============================================================================
export {
  // 기본 위치 타입
  IPosition2D,
  IPosition3D,
  IVelocity2D,
  // 게임별 위치 타입
  IGridPosition,
  IGridPosition3D,
  IContinuousPosition,
  IMovingPosition,
  // 통합 위치 타입
  Position2D,
  Position,
  // 타입 가드
  isGridPosition,
  isGridPosition3D,
  isContinuousPosition,
  isMovingPosition,
  // 맵/변환 관련
  IMapSize,
  IConversionOptions,
  DEFAULT_SAMGUKJI_OPTIONS,
  DEFAULT_LOGH_OPTIONS,
  // 위치 변환 유틸리티
  PositionConverter,
  // 경로 탐색
  IPathNode,
  GridPath,
  ContinuousPath,
  Path,
} from './Position';

// ============================================================================
// Formation 시스템 (Unit, Battle보다 먼저 export 해야 함)
// ============================================================================
export {
  // 삼국지 진형
  Formation,
  IFormationStats,
  FORMATION_STATS,
  FORMATION_COUNTER,
  // 은영전 진형
  LoghFormation,
  CombatStance,
  ILoghFormationStats,
  ICombatStanceStats,
  LOGH_FORMATION_STATS,
  COMBAT_STANCE_STATS,
  // 유틸리티 함수
  getFormationStats,
  getFormationCounter,
  getLoghFormationStats,
  getCombatStanceStats,
  applyFormationModifier,
  applyLoghFormationModifier,
  applyCombatStanceModifier,
  // 진형 변경
  IFormationChangeCost,
  FORMATION_CHANGE_COST,
  LOGH_FORMATION_CHANGE_COST,
  canChangeFormation,
  canChangeLoghFormation,
  // 메타데이터
  IFormationMeta,
  FORMATION_META,
  LOGH_FORMATION_META,
} from './Formation';

// ============================================================================
// Unit 시스템
// ============================================================================
export {
  // 공통 타입
  GameType,
  Faction,
  IStatusEffect,
  IUnit,
  IUnitStats,
  // 삼국지 유닛
  SamgukjiUnitType,
  IGeneral,
  ISamgukjiUnit,
  ISamgukjiUnitStats,
  // 은영전 유닛
  ShipType,
  IShipGroup,
  IAdmiral,
  IGroundTroop,
  FleetType,
  ILoghUnit,
  ILoghUnitStats,
  // 통합 유닛 타입
  BattleUnit,
  // 타입 가드
  isSamgukjiUnit,
  isLoghUnit,
  isUnitAlive,
  canUnitAct,
  // 팩토리
  ISamgukjiUnitCreateOptions,
  ILoghUnitCreateOptions,
  IUnitFactory,
  // 상수
  LOGH_CONSTANTS,
  FLEET_TYPE_LIMITS,
} from './Unit';

// ============================================================================
// Event 시스템 (Battle보다 먼저 export 해야 함)
// ============================================================================
export {
  // 이벤트 타입
  BattleEventType,
  // 기본 이벤트
  IBattleEvent,
  // 라이프사이클 이벤트
  IBattleStartEvent,
  IBattleEndEvent,
  IBattlePauseEvent,
  IBattleResumeEvent,
  // 턴 이벤트
  ITurnStartEvent,
  ITurnEndEvent,
  IPhaseChangeEvent,
  // 유닛 액션 이벤트
  IUnitSpawnEvent,
  IUnitMoveEvent,
  IUnitAttackEvent,
  IUnitDamageEvent,
  IUnitHealEvent,
  IUnitDeathEvent,
  IUnitRetreatEvent,
  IUnitCaptureEvent,
  // 상태 변화 이벤트
  ISkillActivateEvent,
  ISkillEffectEvent,
  IFormationChangeEvent,
  IStanceChangeEvent,
  IBuffApplyEvent,
  IBuffExpireEvent,
  IMoraleChangeEvent,
  // 전투 결과 이벤트
  ICriticalHitEvent,
  IEvadeEvent,
  IBlockEvent,
  ICounterAttackEvent,
  // 건물 이벤트
  IBuildingDamageEvent,
  IBuildingDestroyEvent,
  IBuildingCaptureEvent,
  // 공중전 이벤트
  IAirAttackEvent,
  IAirInterceptEvent,
  IAirEscortEvent,
  IAirReconEvent,
  // 통합 이벤트 타입
  BattleEvent,
  // 리스너
  BattleEventListener,
  BattleEventListenerMap,
  // 이벤트 이미터
  IBattleEventEmitter,
  BattleEventEmitter,
  // 전투 로그
  BattleLogType,
  BattleLog,
  createBattleLog,
  // 이벤트 헬퍼
  createBaseEvent,
  createMoveEvent,
  createAttackEvent,
  createDeathEvent,
  // 타입 가드
  isUnitActionEvent,
  isTurnEvent,
  isAirCombatEvent,
} from './Event';

// ============================================================================
// Battle 시스템
// ============================================================================
export {
  // 전투 타입
  BattleType,
  BattleStatus,
  BattleResult,
  VictoryConditionType,
  IVictoryCondition,
  // 지형
  TerrainType,
  HeightLevel,
  IBattleTile,
  IBuilding,
  // 액션
  ActionType,
  IAction,
  IMoveAction,
  IAttackAction,
  IDefendAction,
  ISkillAction,
  IWaitAction,
  IRetreatAction,
  IFormationAction,
  Action,
  // 공격 결과
  IAttackResult,
  // 전투 설정
  IBattleConfig,
  // 전투 인터페이스
  IBattle,
  // 턴제 전투
  TurnPhase,
  ITurnBasedBattle,
  IResolutionResult,
  // 실시간 전투
  IRealtimeBattle,
  ICombatUpdateResult,
  // 통합 전투 타입
  Battle,
  // 타입 가드
  isTurnBasedBattle,
  isRealtimeBattle,
  // 엔진 인터페이스
  IBattleEngine,
  ITurnBasedBattleEngine,
  IRealtimeBattleEngine,
  // 팩토리 인터페이스
  ITurnBasedBattleCreateOptions,
  IRealtimeBattleCreateOptions,
  IBattleFactory,
} from './Battle';




