/**
 * 통합 Event 시스템
 * 전투 이벤트 및 EventEmitter 패턴
 */

import { IGridPosition, IContinuousPosition, Position } from './Position';
import { Formation, LoghFormation, CombatStance } from './Formation';

// ============================================================================
// 이벤트 타입
// ============================================================================

/**
 * 전투 이벤트 타입
 */
export type BattleEventType =
  // 전투 라이프사이클
  | 'battle:start'
  | 'battle:end'
  | 'battle:pause'
  | 'battle:resume'
  // 턴 관련 (턴제)
  | 'turn:start'
  | 'turn:end'
  | 'phase:change'
  // 유닛 액션
  | 'unit:spawn'
  | 'unit:move'
  | 'unit:attack'
  | 'unit:damage'
  | 'unit:heal'
  | 'unit:death'
  | 'unit:retreat'
  | 'unit:capture'
  // 상태 변화
  | 'skill:activate'
  | 'skill:effect'
  | 'formation:change'
  | 'stance:change'
  | 'buff:apply'
  | 'buff:expire'
  | 'morale:change'
  // 전투 결과
  | 'critical:hit'
  | 'evade'
  | 'block'
  | 'counter:attack'
  // 건물 관련
  | 'building:damage'
  | 'building:destroy'
  | 'building:capture'
  // 공중전 (은영전)
  | 'air:attack'
  | 'air:intercept'
  | 'air:escort'
  | 'air:recon';

// ============================================================================
// 기본 이벤트 인터페이스
// ============================================================================

/**
 * 기본 전투 이벤트
 */
export interface IBattleEvent {
  type: BattleEventType;
  timestamp: number;       // Unix timestamp (ms)
  battleId: string;
  turnNumber?: number;     // 턴제 전투용
  elapsedTime?: number;    // 실시간 전투용 (초)
}

// ============================================================================
// 전투 라이프사이클 이벤트
// ============================================================================

/**
 * 전투 시작 이벤트
 */
export interface IBattleStartEvent extends IBattleEvent {
  type: 'battle:start';
  attackerIds: string[];
  defenderIds: string[];
  battleType: 'turn-based' | 'realtime';
}

/**
 * 전투 종료 이벤트
 */
export interface IBattleEndEvent extends IBattleEvent {
  type: 'battle:end';
  result: 'attacker_win' | 'defender_win' | 'draw';
  reason: string;
  totalTurns?: number;
  totalTime?: number;
  casualties: {
    attacker: number;
    defender: number;
  };
}

/**
 * 전투 일시정지 이벤트
 */
export interface IBattlePauseEvent extends IBattleEvent {
  type: 'battle:pause';
  reason?: string;
}

/**
 * 전투 재개 이벤트
 */
export interface IBattleResumeEvent extends IBattleEvent {
  type: 'battle:resume';
}

// ============================================================================
// 턴 관련 이벤트
// ============================================================================

/**
 * 턴 시작 이벤트
 */
export interface ITurnStartEvent extends IBattleEvent {
  type: 'turn:start';
  turnNumber: number;
  activeUnitId?: string;
  turnOrder: string[];
}

/**
 * 턴 종료 이벤트
 */
export interface ITurnEndEvent extends IBattleEvent {
  type: 'turn:end';
  turnNumber: number;
  summary: {
    movesCount: number;
    attacksCount: number;
    casualties: number;
  };
}

/**
 * 페이즈 변경 이벤트
 */
export interface IPhaseChangeEvent extends IBattleEvent {
  type: 'phase:change';
  previousPhase: string;
  newPhase: string;
}

// ============================================================================
// 유닛 액션 이벤트
// ============================================================================

/**
 * 유닛 생성 이벤트
 */
export interface IUnitSpawnEvent extends IBattleEvent {
  type: 'unit:spawn';
  unitId: string;
  unitName: string;
  position: Position;
  side: 'attacker' | 'defender';
}

/**
 * 유닛 이동 이벤트
 */
export interface IUnitMoveEvent extends IBattleEvent {
  type: 'unit:move';
  unitId: string;
  from: Position;
  to: Position;
  path?: Position[];
  duration?: number;  // 실시간: 이동 시간 (초)
}

/**
 * 유닛 공격 이벤트
 */
export interface IUnitAttackEvent extends IBattleEvent {
  type: 'unit:attack';
  attackerId: string;
  targetId: string;
  damage: number;
  isCritical: boolean;
  isEvaded: boolean;
  isBlocked: boolean;
  skillId?: string;
}

/**
 * 유닛 피해 이벤트
 */
export interface IUnitDamageEvent extends IBattleEvent {
  type: 'unit:damage';
  unitId: string;
  damage: number;
  currentHp: number;
  maxHp: number;
  source: 'attack' | 'skill' | 'effect' | 'terrain' | 'morale';
  sourceId?: string;
}

/**
 * 유닛 치유 이벤트
 */
export interface IUnitHealEvent extends IBattleEvent {
  type: 'unit:heal';
  unitId: string;
  amount: number;
  currentHp: number;
  maxHp: number;
  sourceId?: string;
}

/**
 * 유닛 사망 이벤트
 */
export interface IUnitDeathEvent extends IBattleEvent {
  type: 'unit:death';
  unitId: string;
  unitName: string;
  killedBy?: string;
  position: Position;
  side: 'attacker' | 'defender';
}

/**
 * 유닛 퇴각 이벤트
 */
export interface IUnitRetreatEvent extends IBattleEvent {
  type: 'unit:retreat';
  unitId: string;
  from: Position;
  reason: 'order' | 'morale' | 'damage';
}

/**
 * 유닛 포획 이벤트
 */
export interface IUnitCaptureEvent extends IBattleEvent {
  type: 'unit:capture';
  unitId: string;
  capturedBy: string;
}

// ============================================================================
// 상태 변화 이벤트
// ============================================================================

/**
 * 스킬 발동 이벤트
 */
export interface ISkillActivateEvent extends IBattleEvent {
  type: 'skill:activate';
  unitId: string;
  skillId: string;
  skillName: string;
  targetId?: string;
  targetPosition?: Position;
}

/**
 * 스킬 효과 이벤트
 */
export interface ISkillEffectEvent extends IBattleEvent {
  type: 'skill:effect';
  skillId: string;
  effectType: 'damage' | 'heal' | 'buff' | 'debuff' | 'special';
  affectedUnits: string[];
  values: Record<string, number>;
}

/**
 * 진형 변경 이벤트
 */
export interface IFormationChangeEvent extends IBattleEvent {
  type: 'formation:change';
  unitId: string;
  previousFormation: Formation | LoghFormation;
  newFormation: Formation | LoghFormation;
}

/**
 * 자세 변경 이벤트 (은영전)
 */
export interface IStanceChangeEvent extends IBattleEvent {
  type: 'stance:change';
  unitId: string;
  previousStance: CombatStance;
  newStance: CombatStance;
}

/**
 * 버프 적용 이벤트
 */
export interface IBuffApplyEvent extends IBattleEvent {
  type: 'buff:apply';
  unitId: string;
  buffId: string;
  buffName: string;
  buffType: 'buff' | 'debuff';
  duration: number;
  value: number;
  sourceId?: string;
}

/**
 * 버프 만료 이벤트
 */
export interface IBuffExpireEvent extends IBattleEvent {
  type: 'buff:expire';
  unitId: string;
  buffId: string;
  buffName: string;
}

/**
 * 사기 변화 이벤트
 */
export interface IMoraleChangeEvent extends IBattleEvent {
  type: 'morale:change';
  unitId: string;
  previousMorale: number;
  newMorale: number;
  reason: 'damage' | 'death' | 'victory' | 'skill' | 'leader';
}

// ============================================================================
// 전투 결과 이벤트
// ============================================================================

/**
 * 치명타 이벤트
 */
export interface ICriticalHitEvent extends IBattleEvent {
  type: 'critical:hit';
  attackerId: string;
  targetId: string;
  baseDamage: number;
  criticalDamage: number;
  multiplier: number;
}

/**
 * 회피 이벤트
 */
export interface IEvadeEvent extends IBattleEvent {
  type: 'evade';
  attackerId: string;
  evaderId: string;
  attackType: 'normal' | 'skill';
}

/**
 * 방어 이벤트
 */
export interface IBlockEvent extends IBattleEvent {
  type: 'block';
  attackerId: string;
  blockerId: string;
  blockedDamage: number;
}

/**
 * 반격 이벤트
 */
export interface ICounterAttackEvent extends IBattleEvent {
  type: 'counter:attack';
  counterId: string;
  originalAttackerId: string;
  damage: number;
}

// ============================================================================
// 건물 관련 이벤트
// ============================================================================

/**
 * 건물 피해 이벤트
 */
export interface IBuildingDamageEvent extends IBattleEvent {
  type: 'building:damage';
  buildingId: string;
  buildingType: string;
  damage: number;
  currentHp: number;
  attackerId: string;
}

/**
 * 건물 파괴 이벤트
 */
export interface IBuildingDestroyEvent extends IBattleEvent {
  type: 'building:destroy';
  buildingId: string;
  buildingType: string;
  destroyedBy: string;
}

/**
 * 건물 점령 이벤트
 */
export interface IBuildingCaptureEvent extends IBattleEvent {
  type: 'building:capture';
  buildingId: string;
  buildingType: string;
  capturedBy: string;
  previousOwner?: 'attacker' | 'defender';
}

// ============================================================================
// 공중전 이벤트 (은영전)
// ============================================================================

/**
 * 공중 공격 이벤트
 */
export interface IAirAttackEvent extends IBattleEvent {
  type: 'air:attack';
  sourceFleetId: string;
  targetFleetId: string;
  damage: number;
  fighterCount: number;
}

/**
 * 공중 요격 이벤트
 */
export interface IAirInterceptEvent extends IBattleEvent {
  type: 'air:intercept';
  sourceFleetId: string;
  targetFleetId: string;
  destroyedFighters: number;
}

/**
 * 공중 호위 이벤트
 */
export interface IAirEscortEvent extends IBattleEvent {
  type: 'air:escort';
  sourceFleetId: string;
  protectedFleetId: string;
}

/**
 * 공중 정찰 이벤트
 */
export interface IAirReconEvent extends IBattleEvent {
  type: 'air:recon';
  sourceFleetId: string;
  targetFleetId?: string;
  discoveredInfo?: string[];
}

// ============================================================================
// 통합 이벤트 타입
// ============================================================================

/**
 * 모든 전투 이벤트의 유니온
 */
export type BattleEvent =
  // 라이프사이클
  | IBattleStartEvent
  | IBattleEndEvent
  | IBattlePauseEvent
  | IBattleResumeEvent
  // 턴
  | ITurnStartEvent
  | ITurnEndEvent
  | IPhaseChangeEvent
  // 유닛 액션
  | IUnitSpawnEvent
  | IUnitMoveEvent
  | IUnitAttackEvent
  | IUnitDamageEvent
  | IUnitHealEvent
  | IUnitDeathEvent
  | IUnitRetreatEvent
  | IUnitCaptureEvent
  // 상태 변화
  | ISkillActivateEvent
  | ISkillEffectEvent
  | IFormationChangeEvent
  | IStanceChangeEvent
  | IBuffApplyEvent
  | IBuffExpireEvent
  | IMoraleChangeEvent
  // 전투 결과
  | ICriticalHitEvent
  | IEvadeEvent
  | IBlockEvent
  | ICounterAttackEvent
  // 건물
  | IBuildingDamageEvent
  | IBuildingDestroyEvent
  | IBuildingCaptureEvent
  // 공중전
  | IAirAttackEvent
  | IAirInterceptEvent
  | IAirEscortEvent
  | IAirReconEvent;

// ============================================================================
// 이벤트 리스너
// ============================================================================

/**
 * 이벤트 리스너 타입
 */
export type BattleEventListener<T extends BattleEvent = BattleEvent> = (event: T) => void;

/**
 * 이벤트 리스너 맵 (타입별 리스너 배열)
 */
export type BattleEventListenerMap = {
  [K in BattleEventType]?: BattleEventListener<Extract<BattleEvent, { type: K }>>[];
};

// ============================================================================
// 이벤트 이미터 인터페이스
// ============================================================================

/**
 * 전투 이벤트 이미터 인터페이스
 */
export interface IBattleEventEmitter {
  /**
   * 이벤트 리스너 등록
   */
  on<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void;

  /**
   * 일회성 이벤트 리스너 등록
   */
  once<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void;

  /**
   * 이벤트 리스너 제거
   */
  off<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void;

  /**
   * 이벤트 발생
   */
  emit<T extends BattleEvent>(event: T): void;

  /**
   * 특정 타입의 모든 리스너 제거
   */
  removeAllListeners(type?: BattleEventType): void;

  /**
   * 리스너 개수 조회
   */
  listenerCount(type: BattleEventType): number;
}

// ============================================================================
// 이벤트 이미터 구현
// ============================================================================

/**
 * 전투 이벤트 이미터 기본 구현
 */
export class BattleEventEmitter implements IBattleEventEmitter {
  private listeners: Map<BattleEventType, Set<BattleEventListener>> = new Map();
  private onceListeners: Map<BattleEventType, Set<BattleEventListener>> = new Map();

  on<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as BattleEventListener);
  }

  once<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void {
    if (!this.onceListeners.has(type)) {
      this.onceListeners.set(type, new Set());
    }
    this.onceListeners.get(type)!.add(listener as BattleEventListener);
  }

  off<T extends BattleEvent>(
    type: T['type'],
    listener: BattleEventListener<T>
  ): void {
    this.listeners.get(type)?.delete(listener as BattleEventListener);
    this.onceListeners.get(type)?.delete(listener as BattleEventListener);
  }

  emit<T extends BattleEvent>(event: T): void {
    const type = event.type;

    // 일반 리스너 호출
    const regularListeners = this.listeners.get(type);
    if (regularListeners) {
      regularListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${type}:`, error);
        }
      });
    }

    // 일회성 리스너 호출 및 제거
    const onceListeners = this.onceListeners.get(type);
    if (onceListeners) {
      onceListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in once listener for ${type}:`, error);
        }
      });
      this.onceListeners.delete(type);
    }
  }

  removeAllListeners(type?: BattleEventType): void {
    if (type) {
      this.listeners.delete(type);
      this.onceListeners.delete(type);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  listenerCount(type: BattleEventType): number {
    const regular = this.listeners.get(type)?.size || 0;
    const once = this.onceListeners.get(type)?.size || 0;
    return regular + once;
  }
}

// ============================================================================
// 전투 로그
// ============================================================================

/**
 * 전투 로그 타입
 */
export type BattleLogType = 'info' | 'action' | 'damage' | 'death' | 'skill' | 'system';

/**
 * 전투 로그 항목
 */
export interface BattleLog {
  id: string;
  timestamp: number;
  turnNumber?: number;
  elapsedTime?: number;
  type: BattleLogType;
  message: string;
  data?: Record<string, unknown>;
  relatedEvent?: BattleEvent;
}

/**
 * 전투 로그 생성 헬퍼
 */
export function createBattleLog(
  type: BattleLogType,
  message: string,
  options?: {
    turnNumber?: number;
    elapsedTime?: number;
    data?: Record<string, unknown>;
    relatedEvent?: BattleEvent;
  }
): BattleLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    message,
    ...options,
  };
}

// ============================================================================
// 이벤트 헬퍼 함수
// ============================================================================

/**
 * 기본 이벤트 생성
 */
export function createBaseEvent(
  battleId: string,
  type: BattleEventType,
  options?: { turnNumber?: number; elapsedTime?: number }
): IBattleEvent {
  return {
    type,
    timestamp: Date.now(),
    battleId,
    ...options,
  };
}

/**
 * 유닛 이동 이벤트 생성
 */
export function createMoveEvent(
  battleId: string,
  unitId: string,
  from: Position,
  to: Position,
  path?: Position[],
  options?: { turnNumber?: number; elapsedTime?: number; duration?: number }
): IUnitMoveEvent {
  return {
    ...createBaseEvent(battleId, 'unit:move', options),
    type: 'unit:move',
    unitId,
    from,
    to,
    path,
    duration: options?.duration,
  };
}

/**
 * 유닛 공격 이벤트 생성
 */
export function createAttackEvent(
  battleId: string,
  attackerId: string,
  targetId: string,
  result: {
    damage: number;
    isCritical: boolean;
    isEvaded: boolean;
    isBlocked: boolean;
    skillId?: string;
  },
  options?: { turnNumber?: number; elapsedTime?: number }
): IUnitAttackEvent {
  return {
    ...createBaseEvent(battleId, 'unit:attack', options),
    type: 'unit:attack',
    attackerId,
    targetId,
    ...result,
  };
}

/**
 * 유닛 사망 이벤트 생성
 */
export function createDeathEvent(
  battleId: string,
  unitId: string,
  unitName: string,
  position: Position,
  side: 'attacker' | 'defender',
  killedBy?: string,
  options?: { turnNumber?: number; elapsedTime?: number }
): IUnitDeathEvent {
  return {
    ...createBaseEvent(battleId, 'unit:death', options),
    type: 'unit:death',
    unitId,
    unitName,
    position,
    side,
    killedBy,
  };
}

// ============================================================================
// 타입 가드
// ============================================================================

/**
 * 유닛 액션 이벤트인지 확인
 */
export function isUnitActionEvent(event: BattleEvent): event is
  | IUnitMoveEvent
  | IUnitAttackEvent
  | IUnitDamageEvent
  | IUnitDeathEvent {
  return event.type.startsWith('unit:');
}

/**
 * 턴 관련 이벤트인지 확인
 */
export function isTurnEvent(event: BattleEvent): event is
  | ITurnStartEvent
  | ITurnEndEvent
  | IPhaseChangeEvent {
  return event.type.startsWith('turn:') || event.type === 'phase:change';
}

/**
 * 공중전 이벤트인지 확인
 */
export function isAirCombatEvent(event: BattleEvent): event is
  | IAirAttackEvent
  | IAirInterceptEvent
  | IAirEscortEvent
  | IAirReconEvent {
  return event.type.startsWith('air:');
}




