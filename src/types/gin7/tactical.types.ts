/**
 * Gin7 Tactical Combat Types
 * 전술 전투 시스템의 타입 정의
 */

import { ShipClass, SHIP_SPECS } from '../../models/gin7/Fleet';

// ============================================================
// Vector & Math Types
// ============================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================
// Unit State (GIN7_API_CONTRACT 준수)
// ============================================================

/**
 * 제독(Commander) 보너스 - 캐릭터 스탯 기반
 * Character의 stats를 전투에 반영하기 위한 보너스 값
 */
export interface CommanderBonus {
  /** 공격력 보너스 (command/might 기반, 0.8 ~ 1.2) */
  attackMod: number;
  /** 방어력 보너스 (intellect 기반, 0.8 ~ 1.2) */
  defenseMod: number;
  /** 명중률 보너스 (command 기반, 0.9 ~ 1.1) */
  accuracyMod: number;
  /** 회피율 보너스 (intellect 기반, 0.9 ~ 1.1) */
  evasionMod: number;
  /** 사기 보너스 (charm 기반, -10 ~ +10) */
  moraleBonus: number;
}

/** 기본 제독 보너스 (능력치 미적용 시) */
export const DEFAULT_COMMANDER_BONUS: CommanderBonus = {
  attackMod: 1.0,
  defenseMod: 1.0,
  accuracyMod: 1.0,
  evasionMod: 1.0,
  moraleBonus: 0,
};

/**
 * 캐릭터 스탯에서 제독 보너스 계산
 * @param stats 캐릭터 스탯 (command, might, intellect, politics, charm)
 * @returns 전투 보너스
 */
export function calculateCommanderBonus(stats: {
  command?: number;
  might?: number;
  intellect?: number;
  politics?: number;
  charm?: number;
}): CommanderBonus {
  // 기본값 (스탯이 없을 경우 50 기준)
  const command = stats.command ?? 50;
  const might = stats.might ?? 50;
  const intellect = stats.intellect ?? 50;
  const charm = stats.charm ?? 50;
  
  // 스탯 50 기준, 0~100 범위에서 0.8~1.2 또는 0.9~1.1 범위로 변환
  // (stat - 50) / 50 = -1 ~ 1, * 0.2 = -0.2 ~ 0.2, + 1.0 = 0.8 ~ 1.2
  const attackMod = 1.0 + ((command + might) / 2 - 50) / 50 * 0.2;
  const defenseMod = 1.0 + (intellect - 50) / 50 * 0.2;
  const accuracyMod = 1.0 + (command - 50) / 50 * 0.1;
  const evasionMod = 1.0 + (intellect - 50) / 50 * 0.1;
  const moraleBonus = Math.floor((charm - 50) / 5); // -10 ~ +10
  
  return {
    attackMod: Math.max(0.8, Math.min(1.2, attackMod)),
    defenseMod: Math.max(0.8, Math.min(1.2, defenseMod)),
    accuracyMod: Math.max(0.9, Math.min(1.1, accuracyMod)),
    evasionMod: Math.max(0.9, Math.min(1.1, evasionMod)),
    moraleBonus: Math.max(-10, Math.min(10, moraleBonus)),
  };
}

export interface UnitState {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  
  // HP & Shields
  hp: number;
  maxHp: number;
  shieldFront: number;
  shieldRear: number;
  shieldLeft: number;
  shieldRight: number;
  maxShield: number;
  
  // Combat
  armor: number;
  morale: number;
  
  // Resources (per tick consumption)
  fuel: number;
  maxFuel: number;
  ammo: number;
  maxAmmo: number;
  
  // Ship info
  shipClass: ShipClass;
  shipCount: number;
  
  // Ownership
  factionId: string;
  commanderId: string;
  fleetId: string;
  
  // Status
  isDestroyed: boolean;
  isChaos: boolean; // 사기 0 도달 시
  
  // Energy Distribution (총합 100)
  energyDistribution: EnergyDistribution;
  
  // Targeting
  targetId?: string;
  targetPosition?: Vector3;
  
  // Commander Bonus (제독 특성 반영) - L004 버그 수정
  commanderBonus: CommanderBonus;
}

// ============================================================
// Energy Distribution System
// ============================================================

export interface EnergyDistribution {
  beam: number;      // 빔 무기 출력
  gun: number;       // 실탄 무기 출력
  shield: number;    // 쉴드 재생
  engine: number;    // 추진력/기동성
  warp: number;      // 워프 충전 (전투 중 탈출용)
  sensor: number;    // 센서/조준 보정
}

export const DEFAULT_ENERGY_DISTRIBUTION: EnergyDistribution = {
  beam: 20,
  gun: 20,
  shield: 20,
  engine: 20,
  warp: 0,
  sensor: 20,
};

// ============================================================
// Battle Session Types
// ============================================================

export type BattleStatus = 'WAITING' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'ENDED';

export interface BattleParticipant {
  factionId: string;
  fleetIds: string[];
  commanderIds: string[];
  ready: boolean;
  retreated: boolean;
  surrendered: boolean;
}

export interface BattleResult {
  winnerId: string | null;
  reason: 'ANNIHILATION' | 'RETREAT' | 'SURRENDER' | 'TIMEOUT' | 'DRAW';
  casualties: Record<string, CasualtyReport>;
  duration: number; // in ticks
  endTime: Date;
}

export interface CasualtyReport {
  shipsLost: number;
  shipsDestroyed: number;
  damageDealt: number;
  damageTaken: number;
  creditsLost: number;
}

// ============================================================
// Commands (Client -> Server)
// ============================================================

export type TacticalCommandType = 
  | 'MOVE'
  | 'ATTACK'
  | 'STOP'
  | 'FORMATION'
  | 'ENERGY_DISTRIBUTION'
  | 'RETREAT'
  | 'SURRENDER'
  | 'REPAIR'
  | 'CHANGE_FORMATION'
  | 'PARALLEL_MOVE'
  | 'TURN_180';

export interface TacticalCommand {
  type: TacticalCommandType;
  unitIds: string[];
  timestamp: number;
  data: TacticalCommandData;
}

export type TacticalCommandData = 
  | MoveCommandData
  | AttackCommandData
  | StopCommandData
  | FormationCommandData
  | EnergyDistributionCommandData
  | RetreatCommandData
  | SurrenderCommandData
  | RepairCommandData
  // 전투정 관련
  | LaunchFightersCommandData
  | RecoverFightersCommandData
  | FighterAttackCommandData
  | FighterInterceptCommandData;

export interface MoveCommandData {
  targetPosition: Vector3;
  formation?: FormationType;
}

export interface AttackCommandData {
  targetId: string;
  attackType?: 'ALL' | 'BEAM' | 'GUN' | 'MISSILE';
}

export interface StopCommandData {
  holdPosition: boolean;
}

export interface FormationCommandData {
  formation: FormationType;
}

export interface ChangeFormationCommandData {
  formation?: FormationType;
  targetFormation?: FormationType | string;
  transitionTime?: number;
  priority?: 'NORMAL' | 'URGENT' | number;
}

export interface ParallelMoveCommandData {
  direction: Vector3;
  distance?: number;
  maintainFormation?: boolean;
}

export interface EnergyDistributionCommandData {
  distribution: EnergyDistribution;
}

export interface RetreatCommandData {
  direction?: Vector3;
}

export interface SurrenderCommandData {
  // No additional data
}

/**
 * 수리 커맨드 데이터 (공작함 전용)
 */
export interface RepairCommandData {
  targetUnitId: string;           // 수리 대상 유닛 ID
  targetComponent: ShipComponent; // 수리할 부위
  repairType?: RepairType;        // 수리 타입 (기본: FIELD)
}

// ============================================================
// Fighter Command Data (전투정 커맨드 데이터)
// ============================================================

/**
 * 전투정 사출 커맨드 데이터
 */
export interface LaunchFightersCommandData {
  squadronId: string;           // 출격할 편대 ID
  mission: FighterMissionType;  // 임무 타입
  targetId?: string;            // 공격 대상 ID (유닛 또는 편대)
  count?: number;               // 출격 수량 (미지정 시 전체)
}

/**
 * 전투정 귀환 커맨드 데이터
 */
export interface RecoverFightersCommandData {
  squadronId: string;           // 귀환할 편대 ID
}

/**
 * 전투정 대함 공격 커맨드 데이터
 */
export interface FighterAttackCommandData {
  squadronId: string;           // 공격할 편대 ID
  targetFleetId: string;        // 목표 함대 ID
  targetUnitId: string;         // 목표 유닛 ID
}

/**
 * 전투정 요격 (공전) 커맨드 데이터
 */
export interface FighterInterceptCommandData {
  squadronId: string;           // 요격할 편대 ID
  targetFleetId: string;        // 목표 함대 ID
  targetSquadronId: string;     // 목표 편대 ID
}

/**
 * 전투정 임무 타입
 */
export type FighterMissionType =
  | 'PATROL'        // 순찰/호위
  | 'INTERCEPT'     // 요격 (적 전투기 공격)
  | 'ATTACK'        // 대함 공격
  | 'ESCORT'        // 함대 호위
  | 'RECON';        // 정찰

export type FormationType = 
  | 'LINE'       // 종대 진형
  | 'WEDGE'      // 쐐기 진형
  | 'CIRCLE'     // 원형 진형
  | 'SPREAD'     // 산개 진형
  | 'DEFENSIVE'  // 방어 진형
  | 'ASSAULT';   // 돌격 진형

/**
 * 고급 진형 타입 (은하영웅전설 VII 기준)
 */
export type AdvancedFormationType =
  | 'STANDARD'    // 기본진 - 균형
  | 'SPINDLE'     // 방추진 (錐行陣) - 돌파력 특화
  | 'LINE'        // 횡열진 (橫列陣) - 일제사격 특화
  | 'CIRCULAR'    // 차륜진/원형진 (車輪陣) - 방어 특화
  | 'ECHELON'     // 사선진 (斜線陣) - 측면 유리
  | 'WEDGE'       // 쐐기진 - 돌파용
  | 'ENCIRCLE'    // 포위진 - 포위 특화
  | 'RETREAT';    // 퇴각 대형

// ============================================================
// Events (Server -> Client)
// ============================================================

export interface BattleStartEvent {
  battleId: string;
  gridId: string;
  participants: BattleParticipant[];
  mapSize: { width: number; height: number; depth: number };
  startTime: number;
}

export interface BattleUpdateEvent {
  battleId: string;
  tick: number;
  timestamp: number;
  units: UnitState[];
  projectiles: ProjectileState[];
  effects: EffectState[];
}

export interface BattleEndEvent {
  battleId: string;
  result: BattleResult;
}

export interface UnitDestroyedEvent {
  battleId: string;
  unitId: string;
  destroyedBy: string;
  position: Vector3;
  timestamp: number;
}

export interface DamageEvent {
  battleId: string;
  sourceId: string;
  targetId: string;
  damage: number;
  damageType: 'BEAM' | 'GUN' | 'MISSILE' | 'COLLISION';
  shieldAbsorbed: number;
  armorReduced: number;
  hpDamage: number;
  position: Vector3;
}

// ============================================================
// Projectile & Effect States
// ============================================================

export interface ProjectileState {
  id: string;
  type: 'BEAM' | 'BULLET' | 'MISSILE';
  position: Vector3;
  velocity: Vector3;
  sourceId: string;
  targetId?: string;
  damage: number;
  lifetime: number;
}

export interface EffectState {
  id: string;
  type: 'EXPLOSION' | 'SHIELD_HIT' | 'BEAM_FIRE' | 'ENGINE_FLARE' | 'REPAIR_BEAM' | 'CHAIN_EXPLOSION';
  position: Vector3;
  scale: number;
  duration: number;
  startTick: number;
}

// ============================================================
// Physics Constants
// ============================================================

export const TACTICAL_CONSTANTS = {
  // Tick rate
  TICK_INTERVAL_MS: 60,          // 60ms per tick (~16.67 ticks per second)
  TICKS_PER_SECOND: 16,
  
  // Map bounds
  MAP_SIZE: { width: 10000, height: 10000, depth: 5000 },
  
  // Movement
  MAX_VELOCITY: 100,             // Units per second
  MAX_ANGULAR_VELOCITY: Math.PI, // Radians per second
  DRAG_COEFFICIENT: 0.02,        // Velocity damping
  ANGULAR_DRAG: 0.05,            // Angular velocity damping
  
  // Combat
  BEAM_SPEED: 500,
  BULLET_SPEED: 200,
  MISSILE_SPEED: 80,
  MISSILE_TURN_RATE: Math.PI * 2,
  
  // Shield
  SHIELD_REGEN_RATE: 0.5,        // Per second at 100% energy
  SHIELD_REGEN_DELAY: 30,        // Ticks after taking damage
  
  // Morale
  MORALE_DAMAGE_LOSS: 2,         // Per hit
  MORALE_ALLY_DEATH_LOSS: 10,    // When ally destroyed
  MORALE_RECOVERY_RATE: 0.1,     // Per second
  CHAOS_THRESHOLD: 0,            // Morale level for CHAOS state
  
  // Retreat
  RETREAT_SPEED_BONUS: 1.5,
  RETREAT_TICKS: 300,            // ~18 seconds to escape
  
  // Timeouts
  BATTLE_TIMEOUT_TICKS: 18000,   // ~18 minutes max battle
  COUNTDOWN_TICKS: 80,           // ~5 seconds countdown
};

// ============================================================
// Combat Calculation Helpers
// ============================================================

export function getShipCombatStats(shipClass: ShipClass) {
  return SHIP_SPECS[shipClass];
}

/**
 * 데미지 계산 (제독 보너스 적용)
 * @param attackerClass 공격자 함선 클래스
 * @param weaponType 무기 타입
 * @param energyPercent 에너지 배분 %
 * @param distance 거리
 * @param attackerBonus 공격자 제독 보너스 (선택)
 * @param defenderBonus 방어자 제독 보너스 (선택)
 */
export function calculateDamage(
  attackerClass: ShipClass,
  weaponType: 'BEAM' | 'GUN' | 'MISSILE',
  energyPercent: number,
  distance: number,
  attackerBonus?: CommanderBonus,
  defenderBonus?: CommanderBonus
): number {
  const spec = SHIP_SPECS[attackerClass];
  const baseDamage = spec.attack;
  
  // Energy bonus (0.5x at 0%, 1.5x at 100%)
  const energyMod = 0.5 + (energyPercent / 100);
  
  // Distance falloff
  const maxRange = weaponType === 'BEAM' ? 300 : weaponType === 'GUN' ? 200 : 500;
  const rangeMod = Math.max(0, 1 - (distance / maxRange) * 0.5);
  
  // 제독 보너스 적용 (L004 버그 수정)
  const attackMod = attackerBonus?.attackMod ?? 1.0;
  const defenseMod = defenderBonus?.defenseMod ?? 1.0;
  
  return Math.floor(baseDamage * energyMod * rangeMod * attackMod / defenseMod);
}

/**
 * 명중률 계산 (제독 보너스 적용)
 * @param attackerClass 공격자 함선 클래스
 * @param defenderClass 방어자 함선 클래스
 * @param distance 거리
 * @param sensorEnergy 센서 에너지 %
 * @param attackerBonus 공격자 제독 보너스 (선택)
 * @param defenderBonus 방어자 제독 보너스 (선택)
 */
export function calculateHitChance(
  attackerClass: ShipClass,
  defenderClass: ShipClass,
  distance: number,
  sensorEnergy: number,
  attackerBonus?: CommanderBonus,
  defenderBonus?: CommanderBonus
): number {
  const attacker = SHIP_SPECS[attackerClass];
  const defender = SHIP_SPECS[defenderClass];
  
  const baseAccuracy = attacker.accuracy;
  const evasion = defender.evasion;
  
  // Sensor bonus
  const sensorMod = 0.8 + (sensorEnergy / 100) * 0.4;
  
  // Distance penalty
  const distanceMod = Math.max(0.5, 1 - distance / 500);
  
  // 제독 보너스 적용 (L004 버그 수정)
  const accuracyMod = attackerBonus?.accuracyMod ?? 1.0;
  const evasionMod = defenderBonus?.evasionMod ?? 1.0;
  
  const hitChance = (baseAccuracy * sensorMod * distanceMod * accuracyMod) - (evasion * evasionMod);
  return Math.max(5, Math.min(95, hitChance)); // Clamp 5-95%
}

// ============================================================
// Component Damage System (부위별 데미지)
// ============================================================

/**
 * 함선 부위 타입
 */
export type ShipComponent = 
  | 'HULL'          // 선체 (메인 HP)
  | 'ENGINE'        // 기관 (이동/회피)
  | 'BRIDGE'        // 함교 (지휘 능력)
  | 'MAIN_WEAPON'   // 주포 (공격력)
  | 'HANGAR';       // 격납고 (함재기 - 항모 전용)

/**
 * 부위별 HP 상태
 */
export interface ComponentHealth {
  current: number;    // 현재 HP (0-100)
  max: number;        // 최대 HP (100)
  isDestroyed: boolean;
}

/**
 * 함선 부위별 데미지 상태
 */
export interface ShipComponents {
  hull: ComponentHealth;
  engine: ComponentHealth;
  bridge: ComponentHealth;
  mainWeapon: ComponentHealth;
  hangar?: ComponentHealth;  // 항모 전용
}

/**
 * 기본 부위 HP 초기화
 */
export const DEFAULT_COMPONENTS: ShipComponents = {
  hull: { current: 100, max: 100, isDestroyed: false },
  engine: { current: 100, max: 100, isDestroyed: false },
  bridge: { current: 100, max: 100, isDestroyed: false },
  mainWeapon: { current: 100, max: 100, isDestroyed: false },
};

/**
 * 항모용 부위 HP 초기화 (격납고 포함)
 */
export const DEFAULT_CARRIER_COMPONENTS: ShipComponents = {
  ...DEFAULT_COMPONENTS,
  hangar: { current: 100, max: 100, isDestroyed: false },
};

// ============================================================
// Debuff System (부위 파괴 디버프)
// ============================================================

/**
 * 디버프 타입
 */
export type DebuffType = 
  | 'ENGINE_DAMAGED'      // 기관 손상: 속도 50% 감소
  | 'ENGINE_DESTROYED'    // 기관 파괴: 이동 불가, 속도 10%
  | 'BRIDGE_DAMAGED'      // 함교 손상: 명중률 30% 감소
  | 'BRIDGE_DESTROYED'    // 함교 파괴: 명령 불가 (Uncontrollable)
  | 'WEAPON_DAMAGED'      // 주포 손상: 공격력 30% 감소
  | 'WEAPON_DESTROYED'    // 주포 파괴: 공격력 50% 감소
  | 'HANGAR_DAMAGED'      // 격납고 손상: 함재기 출격 불가
  | 'HANGAR_DESTROYED'    // 격납고 파괴: 함재기 전손
  | 'REPAIRING';          // 수리 중: 회피율 0

/**
 * 디버프 효과 정의
 */
export interface DebuffEffect {
  type: DebuffType;
  speedMultiplier: number;      // 속도 배율 (1.0 = 정상)
  attackMultiplier: number;     // 공격력 배율
  accuracyMultiplier: number;   // 명중률 배율
  evasionMultiplier: number;    // 회피율 배율
  canReceiveOrders: boolean;    // 명령 수신 가능 여부
  canLaunchFighters: boolean;   // 함재기 출격 가능 여부
}

/**
 * 디버프 효과 테이블
 */
export const DEBUFF_EFFECTS: Record<DebuffType, DebuffEffect> = {
  ENGINE_DAMAGED: {
    type: 'ENGINE_DAMAGED',
    speedMultiplier: 0.5,
    attackMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    evasionMultiplier: 0.7,
    canReceiveOrders: true,
    canLaunchFighters: true,
  },
  ENGINE_DESTROYED: {
    type: 'ENGINE_DESTROYED',
    speedMultiplier: 0.1,        // 거의 이동 불가
    attackMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    evasionMultiplier: 0.0,      // 회피 불가
    canReceiveOrders: true,
    canLaunchFighters: true,
  },
  BRIDGE_DAMAGED: {
    type: 'BRIDGE_DAMAGED',
    speedMultiplier: 1.0,
    attackMultiplier: 1.0,
    accuracyMultiplier: 0.7,
    evasionMultiplier: 1.0,
    canReceiveOrders: true,
    canLaunchFighters: true,
  },
  BRIDGE_DESTROYED: {
    type: 'BRIDGE_DESTROYED',
    speedMultiplier: 0.5,        // 자동 조종
    attackMultiplier: 0.5,       // 조준 불량
    accuracyMultiplier: 0.3,
    evasionMultiplier: 0.3,
    canReceiveOrders: false,     // 명령 불가!
    canLaunchFighters: false,
  },
  WEAPON_DAMAGED: {
    type: 'WEAPON_DAMAGED',
    speedMultiplier: 1.0,
    attackMultiplier: 0.7,
    accuracyMultiplier: 0.9,
    evasionMultiplier: 1.0,
    canReceiveOrders: true,
    canLaunchFighters: true,
  },
  WEAPON_DESTROYED: {
    type: 'WEAPON_DESTROYED',
    speedMultiplier: 1.0,
    attackMultiplier: 0.5,       // 보조 무장만 사용 가능
    accuracyMultiplier: 0.7,
    evasionMultiplier: 1.0,
    canReceiveOrders: true,
    canLaunchFighters: true,
  },
  HANGAR_DAMAGED: {
    type: 'HANGAR_DAMAGED',
    speedMultiplier: 1.0,
    attackMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    evasionMultiplier: 1.0,
    canReceiveOrders: true,
    canLaunchFighters: false,    // 출격 불가
  },
  HANGAR_DESTROYED: {
    type: 'HANGAR_DESTROYED',
    speedMultiplier: 1.0,
    attackMultiplier: 0.3,       // 함재기 공격력 상실
    accuracyMultiplier: 1.0,
    evasionMultiplier: 1.0,
    canReceiveOrders: true,
    canLaunchFighters: false,
  },
  REPAIRING: {
    type: 'REPAIRING',
    speedMultiplier: 0.0,        // 정지
    attackMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    evasionMultiplier: 0.0,      // 회피 불가
    canReceiveOrders: true,
    canLaunchFighters: false,
  },
};

/**
 * 유닛 활성 디버프
 */
export interface ActiveDebuff {
  type: DebuffType;
  appliedAt: number;  // 적용된 틱
  duration?: number;  // 지속 시간 (틱, undefined = 영구)
  sourceId?: string;  // 발생 원인 유닛
}

// ============================================================
// Repair System (수리 시스템)
// ============================================================

/**
 * 수리 타입
 */
export type RepairType = 
  | 'EMERGENCY'     // 긴급 수리 (전투 중, 느림)
  | 'FIELD'         // 야전 수리 (공작함 필요)
  | 'DOCK';         // 정박 수리 (행성/스테이션)

/**
 * 수리 작업 상태
 */
export interface RepairTask {
  targetUnitId: string;
  repairShipId: string;
  repairType: RepairType;
  targetComponent: ShipComponent;
  startTick: number;
  estimatedEndTick: number;
  repairRate: number;           // 틱당 수리량
  materialCost: number;         // 자재 소모량
  progress: number;             // 0-100%
}

/**
 * 수리 비용 테이블 (부위별)
 */
export const REPAIR_COSTS: Record<ShipComponent, { time: number; materials: number }> = {
  HULL: { time: 100, materials: 50 },       // 100틱 (~6초), 자재 50
  ENGINE: { time: 80, materials: 40 },
  BRIDGE: { time: 60, materials: 30 },
  MAIN_WEAPON: { time: 70, materials: 35 },
  HANGAR: { time: 90, materials: 45 },
};

// ============================================================
// Chain Reaction (유폭 시스템)
// ============================================================

/**
 * 유폭 효과 범위
 */
export const EXPLOSION_RADIUS = 50;  // 유닛 단위

/**
 * 유폭 데미지 계산 (함급별)
 */
export const EXPLOSION_DAMAGE: Record<ShipClass, number> = {
  flagship: 500,
  battleship: 300,
  carrier: 250,
  cruiser: 150,
  destroyer: 80,
  frigate: 50,
  corvette: 30,
  transport: 40,
  engineering: 20,
};

/**
 * 유폭 이벤트
 */
export interface ChainExplosionEvent {
  battleId: string;
  sourceUnitId: string;
  position: Vector3;
  radius: number;
  damage: number;
  affectedUnits: string[];
  timestamp: number;
}

// ============================================================
// Command Delay System (명령 지연 시스템)
// ============================================================

/**
 * 지연된 명령 상태
 */
export type DelayedCommandStatus = 
  | 'QUEUED'      // 대기열에 추가됨
  | 'EXECUTING'   // 실행 중
  | 'COMPLETED'   // 완료됨
  | 'CANCELLED'   // 취소됨
  | 'FAILED';     // 실패

/**
 * 지연된 명령 래퍼 인터페이스
 */
export interface DelayedCommand {
  id: string;                        // 고유 식별자
  battleId: string;                  // 전투 세션 ID
  commanderId: string;               // 명령을 내린 지휘관 ID
  factionId: string;                 // 소속 세력 ID
  
  // 원본 명령
  command: TacticalCommand;
  
  // 타이밍
  issueTime: number;                 // 발령 시간 (tick)
  executeTime: number;               // 실행 예정 시간 (tick)
  
  // 지연 계산 상세
  delayBreakdown: DelayBreakdown;
  
  // 상태
  status: DelayedCommandStatus;
  
  // 메타데이터
  priority: CommandPriority;
  cancellable: boolean;              // 취소 가능 여부 (실행 전까지)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 명령 우선순위
 */
export type CommandPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';

/**
 * 지연 시간 상세 내역
 */
export interface DelayBreakdown {
  baseDelay: number;                 // 기본 지연 (0~20초를 tick 단위로)
  distancePenalty: number;           // 거리에 따른 추가 지연
  jammingPenalty: number;            // 전자전 방해에 따른 추가 지연
  commanderSkillBonus: number;       // 지휘관 능력에 따른 감소
  totalDelay: number;                // 최종 지연 시간 (tick)
}

/**
 * 명령 지연 설정
 */
export const COMMAND_DELAY_CONSTANTS = {
  // 기본 지연 범위 (tick 단위, 1tick = 60ms)
  MIN_BASE_DELAY_TICKS: 0,           // 최소 0초
  MAX_BASE_DELAY_TICKS: 333,         // 최대 20초 (~333틱)
  
  // 거리 기반 지연 (1000 유닛당)
  DISTANCE_DELAY_PER_1000: 50,       // 1000 유닛당 ~3초 추가
  
  // 전자전 방해 배율
  JAMMING_DELAY_MULTIPLIER: 2.0,     // 방해 시 지연 2배
  BLACKOUT_DELAY_MULTIPLIER: 10.0,   // 통신 두절 시 지연 10배
  
  // 지휘관 스킬 보너스 (최대 50% 감소)
  MAX_COMMANDER_BONUS: 0.5,
  
  // 우선순위별 지연 배율
  PRIORITY_MULTIPLIERS: {
    LOW: 1.5,
    NORMAL: 1.0,
    HIGH: 0.7,
    EMERGENCY: 0.3,
  } as Record<CommandPriority, number>,
  
  // 취소 시 혼란 확률
  CANCEL_CHAOS_PROBABILITY: 0.15,    // 15% 확률로 혼란 발생
};

// ============================================================
// Electronic Warfare System (전자전 시스템)
// ============================================================

/**
 * 전자전 상태 타입
 */
export type JammingLevel = 
  | 'CLEAR'        // 정상 통신
  | 'INTERFERENCE' // 간섭 (지연 1.5배)
  | 'HEAVY'        // 심한 방해 (지연 2배)
  | 'BLACKOUT';    // 통신 두절 (명령 불가)

/**
 * 전자전 상태
 */
export interface ElectronicWarfareState {
  battleId: string;
  factionId: string;
  
  // 미노프스키 입자 농도 (0-100)
  minovskyDensity: number;
  
  // 현재 재밍 레벨
  jammingLevel: JammingLevel;
  
  // 적 전자전 공격 여부
  isUnderEWAttack: boolean;
  attackSourceId?: string;
  
  // 지속 시간 (틱)
  duration: number;
  startTick: number;
}

/**
 * 재밍 레벨별 임계값
 */
export const JAMMING_THRESHOLDS = {
  CLEAR: 0,          // 0-25%
  INTERFERENCE: 25,  // 25-50%
  HEAVY: 50,         // 50-75%
  BLACKOUT: 75,      // 75-100%
};

/**
 * 재밍 레벨별 지연 배율
 */
export const JAMMING_DELAY_MULTIPLIERS: Record<JammingLevel, number> = {
  CLEAR: 1.0,
  INTERFERENCE: 1.5,
  HEAVY: 2.0,
  BLACKOUT: Infinity,  // 명령 불가
};

/**
 * 명령 큐 이벤트
 */
export interface CommandQueueEvent {
  type: 'COMMAND_QUEUED' | 'COMMAND_EXECUTING' | 'COMMAND_COMPLETED' | 'COMMAND_CANCELLED' | 'COMMAND_FAILED';
  delayedCommand: DelayedCommand;
  timestamp: number;
}

/**
 * 명령 큐 상태 요약
 */
export interface CommandQueueSummary {
  battleId: string;
  factionId: string;
  totalQueued: number;
  executing: number;
  averageDelay: number;
  jammingLevel: JammingLevel;
}

