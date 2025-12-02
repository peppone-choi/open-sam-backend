/**
 * LOGH Combat Types
 * 은하영웅전설 실시간 전투 타입 정의
 */

// ============================================================================
// Position & Vector Types
// ============================================================================

export interface Position2D {
  x: number;
  y: number;
}

export interface Velocity2D {
  x: number;
  y: number;
}

export interface TacticalPosition {
  x: number;
  y: number;
  velocity: Velocity2D;
  heading: number; // 0-360도
}

// ============================================================================
// Formation System (진형 시스템)
// ============================================================================

/**
 * 함대 진형 타입
 * 은하영웅전설 VII 매뉴얼 기반
 */
export type Formation = 
  | 'fishScale'   // 어린(魚鱗) - 공격 중시, 돌파력 증가
  | 'craneWing'   // 학익(鶴翼) - 포위 공격, 측면 강화
  | 'circular'    // 방원(方円) - 방어 중시, 전방위 대응
  | 'arrowhead'   // 봉시(鋒矢) - 기동력 증가, 돌격용
  | 'longSnake';  // 장사(長蛇) - 회피력 증가, 후퇴 용이

/**
 * 진형별 능력치 보정
 */
export interface FormationStats {
  attack: number;      // 공격력 배율 (1.0 기준)
  defense: number;     // 방어력 배율
  speed: number;       // 이동속도 배율
  range: number;       // 사정거리 배율
  evasion: number;     // 회피율 보너스 (%)
  description: string; // 진형 설명
  koreanName: string;  // 한국어 이름
  japaneseName: string; // 일본어 이름
}

/**
 * 진형별 스탯 정의
 */
export const FORMATION_STATS: Record<Formation, FormationStats> = {
  fishScale: {
    attack: 1.2,
    defense: 0.9,
    speed: 1.0,
    range: 1.0,
    evasion: 0,
    description: '공격 중시, 돌파력 증가',
    koreanName: '어린',
    japaneseName: '魚鱗',
  },
  craneWing: {
    attack: 1.1,
    defense: 1.0,
    speed: 0.9,
    range: 1.1,
    evasion: 5,
    description: '포위 공격, 측면 강화',
    koreanName: '학익',
    japaneseName: '鶴翼',
  },
  circular: {
    attack: 0.9,
    defense: 1.3,
    speed: 0.8,
    range: 1.0,
    evasion: 0,
    description: '방어 중시, 전방위 대응',
    koreanName: '방원',
    japaneseName: '方円',
  },
  arrowhead: {
    attack: 1.3,
    defense: 0.8,
    speed: 1.2,
    range: 0.9,
    evasion: -5,
    description: '기동력 증가, 돌격용',
    koreanName: '봉시',
    japaneseName: '鋒矢',
  },
  longSnake: {
    attack: 1.0,
    defense: 1.0,
    speed: 1.1,
    range: 1.0,
    evasion: 15,
    description: '회피력 증가, 후퇴 용이',
    koreanName: '장사',
    japaneseName: '長蛇',
  },
};

// ============================================================================
// Combat Constants (전투 상수)
// ============================================================================

export const COMBAT_CONSTANTS = {
  // 전술 맵 크기
  TACTICAL_MAP_SIZE: 10000,
  
  // 게임 루프
  TICK_INTERVAL_MS: 50, // 50ms = 20 ticks/sec
  TICK_RATE: 20, // 초당 틱 수
  
  // 기본 전투 수치
  BASE_ATTACK_RANGE: 500, // 기본 사정거리
  BASE_MOVEMENT_SPEED: 100, // 기본 이동 속도 (단위/초)
  BASE_TURN_RATE: 90, // 기본 회전 속도 (도/초)
  
  // 보급 시스템
  SUPPLY_CONSUMPTION_PER_SHIP_PER_HOUR: 0.1, // 함선당 시간당 보급 소모
  SUPPLY_COMBAT_MULTIPLIER: 3, // 전투 중 보급 소모 배율
  LOW_SUPPLY_THRESHOLD: 20, // 보급 부족 기준 (%)
  LOW_SUPPLY_PENALTY: 0.5, // 보급 부족 시 전투력 페널티 (50%)
  
  // 사기 시스템
  MORALE_LOSS_PER_CASUALTY: 0.01, // 손실당 사기 감소
  MORALE_LOSS_LOW_SUPPLY: 1, // 보급 부족 시 초당 사기 감소
  MORALE_SURRENDER_THRESHOLD: 10, // 항복 기준 사기
  MORALE_ROUT_THRESHOLD: 0, // 궤멸 기준 사기
  
  // 거리 임계값
  ARRIVAL_THRESHOLD: 10, // 목적지 도착 판정 거리
  COLLISION_DISTANCE: 50, // 충돌 판정 거리
} as const;

// ============================================================================
// Combat Events (전투 이벤트)
// ============================================================================

export type CombatEventType = 
  | 'shot'       // 발포
  | 'hit'        // 명중
  | 'miss'       // 빗나감
  | 'destroy'    // 함대 파괴
  | 'retreat'    // 후퇴
  | 'surrender'  // 항복
  | 'rout'       // 궤멸
  | 'air_attack' // 전투기 공격
  | 'air_intercept' // 전투기 요격
  | 'supply_depleted'; // 보급 고갈

export interface CombatEvent {
  type: CombatEventType;
  timestamp: number;
  sourceFleetId?: string;
  targetFleetId?: string;
  damage?: number;
  position?: Position2D;
  details?: Record<string, any>;
}

// ============================================================================
// Fleet State (함대 상태)
// ============================================================================

export interface FleetCombatState {
  fleetId: string;
  name: string;
  faction: 'empire' | 'alliance' | 'neutral';
  
  // 위치 및 이동
  position: Position2D;
  velocity: Velocity2D;
  heading: number;
  targetPosition?: Position2D;
  
  // 전투 상태
  formation: Formation;
  totalShips: number;
  totalStrength: number;
  morale: number;
  supply: number;
  
  // 전투 수치 (보정 적용된 값)
  effectiveAttack: number;
  effectiveDefense: number;
  effectiveRange: number;
  effectiveSpeed: number;
  
  // 상태 플래그
  isMoving: boolean;
  isInCombat: boolean;
  isRetreating: boolean;
  hasLowSupply: boolean;
}

// ============================================================================
// Battle State (전투 상태)
// ============================================================================

export interface BattleState {
  tacticalMapId: string;
  sessionId: string;
  tick: number;
  timestamp: number;
  
  // 참여 함대
  fleets: FleetCombatState[];
  
  // 이벤트
  events: CombatEvent[];
  
  // 전투 결과 (종료 시)
  result?: BattleResult;
}

export interface BattleResult {
  winner: 'empire' | 'alliance' | 'draw';
  casualties: {
    empire: number;
    alliance: number;
  };
  duration: number; // 전투 시간 (초)
}

// ============================================================================
// WebSocket Events (웹소켓 이벤트)
// ============================================================================

// 서버 → 클라이언트
export interface ServerEvents {
  'battle:state': BattleStatePayload;
  'battle:started': BattleStartedPayload;
  'battle:ended': BattleEndedPayload;
  'fleet:destroyed': FleetDestroyedPayload;
  'fleet:retreated': FleetRetreatedPayload;
  'fleet:formation-changed': FleetFormationChangedPayload;
  'supply:warning': SupplyWarningPayload;
}

export interface BattleStatePayload {
  timestamp: number;
  tick: number;
  fleets: FleetCombatState[];
  events: CombatEvent[];
}

export interface BattleStartedPayload {
  tacticalMapId: string;
  fleetIds: string[];
  timestamp: number;
}

export interface BattleEndedPayload {
  tacticalMapId: string;
  result: BattleResult;
  timestamp: number;
}

export interface FleetDestroyedPayload {
  fleetId: string;
  destroyedBy?: string;
  timestamp: number;
}

export interface FleetRetreatedPayload {
  fleetId: string;
  timestamp: number;
}

export interface FleetFormationChangedPayload {
  fleetId: string;
  formation: Formation;
  timestamp: number;
}

export interface SupplyWarningPayload {
  fleetId: string;
  supplyLevel: number;
  timestamp: number;
}

// 클라이언트 → 서버
export interface ClientEvents {
  'command:move': MoveCommandPayload;
  'command:attack': AttackCommandPayload;
  'command:formation': FormationCommandPayload;
  'command:retreat': RetreatCommandPayload;
  'command:hold': HoldCommandPayload;
}

export interface MoveCommandPayload {
  fleetId: string;
  destination: Position2D;
}

export interface AttackCommandPayload {
  fleetId: string;
  targetId: string;
}

export interface FormationCommandPayload {
  fleetId: string;
  formation: Formation;
}

export interface RetreatCommandPayload {
  fleetId: string;
}

export interface HoldCommandPayload {
  fleetId: string;
}

// ============================================================================
// Utility Functions (유틸리티 함수)
// ============================================================================

/**
 * 두 점 사이 거리 계산 (유클리드)
 */
export function getDistance(p1: Position2D, p2: Position2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 방향 벡터 정규화
 */
export function normalize(v: Velocity2D): Velocity2D {
  const magnitude = Math.sqrt(v.x * v.x + v.y * v.y);
  if (magnitude === 0) return { x: 0, y: 0 };
  return {
    x: v.x / magnitude,
    y: v.y / magnitude,
  };
}

/**
 * 각도를 라디안으로 변환
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 라디안을 각도로 변환
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * 벡터에서 각도 계산 (0-360)
 */
export function vectorToAngle(v: Velocity2D): number {
  const angle = toDegrees(Math.atan2(v.y, v.x));
  return angle < 0 ? angle + 360 : angle;
}

/**
 * 각도에서 단위 벡터 생성
 */
export function angleToVector(degrees: number): Velocity2D {
  const radians = toRadians(degrees);
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

/**
 * 값을 범위 내로 제한
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 보급 상태에 따른 전투력 배율 계산
 */
export function getSupplyMultiplier(supplyPercent: number): number {
  if (supplyPercent <= COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD) {
    return COMBAT_CONSTANTS.LOW_SUPPLY_PENALTY;
  }
  return 1.0;
}

/**
 * 진형 스탯 가져오기
 */
export function getFormationStats(formation: Formation): FormationStats {
  return FORMATION_STATS[formation] || FORMATION_STATS.fishScale;
}




