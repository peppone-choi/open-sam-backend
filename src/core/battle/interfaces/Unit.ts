/**
 * 통합 Unit 시스템
 * 삼국지(장수+병사) + 은하영웅전설(함대) 유닛 통합
 */

import {
  IGridPosition,
  IGridPosition3D,
  IContinuousPosition,
  IMovingPosition,
  Position,
} from './Position';
import { Formation, LoghFormation, CombatStance } from './Formation';

// ============================================================================
// 공통 타입
// ============================================================================

/**
 * 게임 타입 식별자
 */
export type GameType = 'samgukji' | 'logh';

/**
 * 진영 (팩션)
 */
export type Faction = string; // 유연한 진영 시스템

/**
 * 버프/디버프 효과
 */
export interface IStatusEffect {
  id: string;
  type: 'buff' | 'debuff';
  name: string;
  value: number;       // 효과 값 (퍼센트 또는 절대값)
  duration: number;    // 남은 지속 시간 (턴 또는 초)
  stackable: boolean;  // 중첩 가능 여부
  source?: string;     // 효과 발생원 (스킬 ID 등)
}

// ============================================================================
// 기본 유닛 인터페이스 (공통)
// ============================================================================

/**
 * 기본 유닛 인터페이스 (모든 유닛의 공통 속성)
 */
export interface IUnit {
  // 식별자
  id: string;
  name: string;

  // 게임 타입
  readonly gameType: GameType;

  // 위치
  position: Position;

  // 체력
  hp: number;
  maxHp: number;

  // 사기
  morale: number;
  maxMorale: number;

  // 진영
  faction: Faction;
  side: 'attacker' | 'defender';

  // 상태
  isAlive: boolean;
  hasActed: boolean; // 이번 턴/틱에 행동했는지 (턴제용)

  // 버프/디버프
  statusEffects: IStatusEffect[];
}

/**
 * 유닛 기본 스탯
 */
export interface IUnitStats {
  attack: number;
  defense: number;
  speed: number;
  range: number; // 공격 사정거리
}

// ============================================================================
// 삼국지 유닛 시스템
// ============================================================================

/**
 * 삼국지 병종 타입
 */
export enum SamgukjiUnitType {
  FOOTMAN = 'FOOTMAN',       // 보병
  CAVALRY = 'CAVALRY',       // 기병
  ARCHER = 'ARCHER',         // 궁병
  WIZARD = 'WIZARD',         // 술사 (특수)
  SIEGE = 'SIEGE',           // 공성 병기
  NAVY = 'NAVY',             // 수군
}

/**
 * 장수 정보
 */
export interface IGeneral {
  id: number;
  name: string;
  portrait?: string;

  // 5대 능력치
  leadership: number;    // 통솔 (병사 지휘, 훈련)
  strength: number;      // 무력 (전투력)
  intelligence: number;  // 지력 (계략, 전술)
  politics: number;      // 정치 (내정)
  charm: number;         // 매력 (외교, 등용)

  // 특기/스킬
  skills: string[];

  // 경험치/레벨
  level: number;
  experience: number;
}

/**
 * 삼국지 유닛 (장수 + 병사)
 */
export interface ISamgukjiUnit extends IUnit {
  readonly gameType: 'samgukji';

  // 위치 (그리드 기반)
  position: IGridPosition | IGridPosition3D;

  // 장수 정보
  general: IGeneral;
  playerId: number;

  // 병사 정보
  troops: number;        // 현재 병사 수
  maxTroops: number;     // 최대 병사 수
  unitType: SamgukjiUnitType;
  training: number;      // 훈련도 (0-100)

  // 전투 스탯 (계산된 값)
  stats: ISamgukjiUnitStats;

  // 진형
  formation?: Formation;

  // 특수 능력
  canFly?: boolean;           // 비행 가능 여부
  canClimb?: boolean;         // 등반 가능 여부
  maxAltitude?: number;       // 최대 비행 고도
  maxClimbHeight?: number;    // 최대 등반 높이

  // 시야
  visionRange: number;

  // AFK 턴 (자동 전투용)
  afkTurns: number;
}

/**
 * 삼국지 유닛 스탯 (확장)
 */
export interface ISamgukjiUnitStats extends IUnitStats {
  attack: number;           // 공격력
  defense: number;          // 방어력
  speed: number;            // 이동 속도 (턴당 칸 수)
  range: number;            // 공격 사정거리 (칸)

  // 추가 스탯
  critRate: number;         // 치명타 확률 (0-1)
  critDamage: number;       // 치명타 배율 (1.5 = 150%)
  accuracy: number;         // 명중률 (0-1)
  evasion: number;          // 회피율 (0-1)

  // 지형 보정
  terrainBonus: number;     // 지형 보너스
  heightBonus: number;      // 고도 보너스
}

// ============================================================================
// 은하영웅전설 유닛 시스템
// ============================================================================

/**
 * 함선 종류
 */
export enum ShipType {
  BATTLESHIP = 'battleship',         // 전함
  CRUISER = 'cruiser',               // 순양함
  DESTROYER = 'destroyer',           // 구축함
  CARRIER = 'carrier',               // 항공모함
  TRANSPORT = 'transport',           // 수송함
  FLAGSHIP = 'flagship',             // 기함
  ASSAULT_SHIP = 'assault_ship',     // 양륙함
}

/**
 * 함선 그룹 (같은 종류의 함선 집합)
 */
export interface IShipGroup {
  type: ShipType;
  count: number;         // 유닛 수 (실제 함선 = count × 300)
  health: number;        // 상태 (0-100)
}

/**
 * 제독 정보
 */
export interface IAdmiral {
  id: string;
  name: string;
  portrait?: string;

  // 능력치
  command: number;       // 통솔 (함대 지휘)
  combat: number;        // 전투 (전술 능력)
  intelligence: number;  // 지략 (전략, 계략)
  politics: number;      // 정치 (외교)
  charisma: number;      // 매력 (사기 보정)

  // 특기/스킬
  skills: string[];

  // 경험치/레벨
  level: number;
  experience: number;
}

/**
 * 육전대 (지상군)
 */
export interface IGroundTroop {
  type: 'armored' | 'grenadier' | 'light_infantry';
  count: number;         // 유닛 수 (실제 병력 ≈ count × 2000)
  health: number;        // 상태 (0-100)
}

/**
 * 함대 유형
 */
export type FleetType =
  | 'single_ship'   // 단독함 (기함 1척)
  | 'fleet'         // 함대 (최대 60 유닛)
  | 'patrol'        // 순찰대 (3 유닛)
  | 'transport'     // 수송함대
  | 'ground_force'  // 지상부대
  | 'garrison';     // 행성수비대

/**
 * 은하영웅전설 유닛 (함대)
 */
export interface ILoghUnit extends IUnit {
  readonly gameType: 'logh';

  // 위치 (연속 좌표 기반)
  position: IContinuousPosition | IMovingPosition;

  // 전략 그리드 위치 (100x50)
  strategicPosition: { x: number; y: number };

  // 함대 정보
  fleetId: string;
  fleetName: string;
  fleetType: FleetType;

  // 제독 정보
  admiral?: IAdmiral;

  // 함선 구성
  ships: IShipGroup[];
  totalShips: number;        // 총 유닛 수
  totalStrength: number;     // 총 전투력

  // 육전대 (옵션)
  groundTroops?: IGroundTroop[];
  totalGroundTroops?: number;

  // 이동 정보
  velocity: { x: number; y: number };
  heading: number;           // 방향 (0-360도)
  movementSpeed: number;     // 초당 이동 속도
  isMoving: boolean;
  destination?: { x: number; y: number };

  // 진형 및 자세
  formation: LoghFormation;
  combatStance: CombatStance;

  // 자원
  supplies: number;          // 보급품
  fuel: number;              // 연료

  // 훈련도
  training: {
    discipline: number;      // 군기
    space: number;           // 항주 훈련
    ground: number;          // 육전 훈련
    air: number;             // 공전 훈련
  };

  // 전투 스탯
  stats: ILoghUnitStats;

  // 전투 상태
  isInCombat: boolean;
  tacticalMapId?: string;
  combatTarget?: string;     // 현재 교전 목표
}

/**
 * 은영전 유닛 스탯 (확장)
 */
export interface ILoghUnitStats extends IUnitStats {
  attack: number;            // 공격력
  defense: number;           // 방어력
  speed: number;             // 이동 속도
  range: number;             // 공격 사정거리

  // 추가 스탯
  fireRate: number;          // 사격 속도 배율
  accuracy: number;          // 명중률
  evasion: number;           // 회피율
  mobility: number;          // 기동력 (회전, 가속)
}

// ============================================================================
// 통합 유닛 타입
// ============================================================================

/**
 * 모든 전투 유닛의 유니온 타입
 */
export type BattleUnit = ISamgukjiUnit | ILoghUnit;

// ============================================================================
// 타입 가드 함수
// ============================================================================

/**
 * 삼국지 유닛인지 확인
 */
export function isSamgukjiUnit(unit: BattleUnit): unit is ISamgukjiUnit {
  return unit.gameType === 'samgukji';
}

/**
 * 은영전 유닛인지 확인
 */
export function isLoghUnit(unit: BattleUnit): unit is ILoghUnit {
  return unit.gameType === 'logh';
}

/**
 * 유닛이 살아있는지 확인
 */
export function isUnitAlive(unit: IUnit): boolean {
  return unit.isAlive && unit.hp > 0;
}

/**
 * 유닛이 행동 가능한지 확인
 */
export function canUnitAct(unit: IUnit): boolean {
  return isUnitAlive(unit) && !unit.hasActed;
}

// ============================================================================
// 유닛 팩토리 인터페이스
// ============================================================================

/**
 * 삼국지 유닛 생성 옵션
 */
export interface ISamgukjiUnitCreateOptions {
  general: IGeneral;
  playerId: number;
  faction: Faction;
  side: 'attacker' | 'defender';
  position: IGridPosition | IGridPosition3D;
  troops: number;
  unitType: SamgukjiUnitType;
  training?: number;
  formation?: Formation;
}

/**
 * 은영전 유닛 생성 옵션
 */
export interface ILoghUnitCreateOptions {
  admiral?: IAdmiral;
  faction: Faction;
  side: 'attacker' | 'defender';
  position: IContinuousPosition;
  strategicPosition: { x: number; y: number };
  fleetType: FleetType;
  ships: IShipGroup[];
  formation?: LoghFormation;
  combatStance?: CombatStance;
}

/**
 * 유닛 팩토리 인터페이스
 */
export interface IUnitFactory {
  createSamgukjiUnit(options: ISamgukjiUnitCreateOptions): ISamgukjiUnit;
  createLoghUnit(options: ILoghUnitCreateOptions): ILoghUnit;
}

// ============================================================================
// 상수
// ============================================================================

/**
 * 은영전 유닛 상수 (LOGH VII 매뉴얼 기준)
 */
export const LOGH_CONSTANTS = {
  SHIPS_PER_UNIT: 300,       // 1 함선 유닛 = 300척
  CREW_PER_SHIP: 100,        // 함선 1척당 승무원 100명
  TROOPS_PER_UNIT: 2000,     // 1 육전대 유닛 ≈ 2,000명
} as const;

/**
 * 함대 유형별 제한
 */
export const FLEET_TYPE_LIMITS: Record<
  FleetType,
  { maxUnits: number; maxShips: number; maxCrewSlots: number; maxGroundTroops: number }
> = {
  single_ship: { maxUnits: 0, maxShips: 1, maxCrewSlots: 1, maxGroundTroops: 0 },
  fleet: { maxUnits: 60, maxShips: 18000, maxCrewSlots: 10, maxGroundTroops: 0 },
  patrol: { maxUnits: 3, maxShips: 900, maxCrewSlots: 3, maxGroundTroops: 0 },
  transport: { maxUnits: 23, maxShips: 6900, maxCrewSlots: 3, maxGroundTroops: 0 },
  ground_force: { maxUnits: 3, maxShips: 900, maxCrewSlots: 1, maxGroundTroops: 3 },
  garrison: { maxUnits: 0, maxShips: 1, maxCrewSlots: 1, maxGroundTroops: 10 },
};




