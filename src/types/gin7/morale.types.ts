/**
 * GIN7 Morale, Confusion & Stance System Types
 * 
 * 사기(Morale), 혼란(Confusion), 태세/진형(Stance/Formation) 시스템 타입 정의
 * - 은하영웅전설 VII 매뉴얼 기반
 */

// ============================================================
// Morale System Types (사기 시스템)
// ============================================================

/**
 * 사기 상태 레벨
 */
export enum MoraleState {
  EXCELLENT = 'EXCELLENT',  // 90+ : 사기 충천, 공격/방어 보너스
  GOOD = 'GOOD',            // 70-89 : 양호, 경미한 보너스
  NORMAL = 'NORMAL',        // 50-69 : 보통, 보정 없음
  LOW = 'LOW',              // 30-49 : 저하, 페널티 시작
  CRITICAL = 'CRITICAL',    // 0-29 : 위기, 심각한 페널티
}

/**
 * 사기 상태 임계값
 */
export const MORALE_THRESHOLDS: Record<MoraleState, { min: number; max: number }> = {
  [MoraleState.EXCELLENT]: { min: 90, max: 100 },
  [MoraleState.GOOD]: { min: 70, max: 89 },
  [MoraleState.NORMAL]: { min: 50, max: 69 },
  [MoraleState.LOW]: { min: 30, max: 49 },
  [MoraleState.CRITICAL]: { min: 0, max: 29 },
};

/**
 * 사기 상태별 전투 보정
 */
export interface MoraleModifiers {
  attackMod: number;       // 공격력 배율
  defenseMod: number;      // 방어력 배율
  accuracyMod: number;     // 명중률 배율
  evasionMod: number;      // 회피율 배율
  retreatChance: number;   // 명령 거부/탈영 확률 (0-1)
  rallyCost: number;       // 사기 회복에 필요한 CP
}

/**
 * 사기 상태별 보정치
 */
export const MORALE_MODIFIERS: Record<MoraleState, MoraleModifiers> = {
  [MoraleState.EXCELLENT]: {
    attackMod: 1.2,
    defenseMod: 1.15,
    accuracyMod: 1.1,
    evasionMod: 1.1,
    retreatChance: 0,
    rallyCost: 0,
  },
  [MoraleState.GOOD]: {
    attackMod: 1.1,
    defenseMod: 1.05,
    accuracyMod: 1.05,
    evasionMod: 1.05,
    retreatChance: 0,
    rallyCost: 0,
  },
  [MoraleState.NORMAL]: {
    attackMod: 1.0,
    defenseMod: 1.0,
    accuracyMod: 1.0,
    evasionMod: 1.0,
    retreatChance: 0,
    rallyCost: 10,
  },
  [MoraleState.LOW]: {
    attackMod: 0.85,
    defenseMod: 0.9,
    accuracyMod: 0.9,
    evasionMod: 0.85,
    retreatChance: 0.1,   // 10% 명령 거부
    rallyCost: 30,
  },
  [MoraleState.CRITICAL]: {
    attackMod: 0.6,
    defenseMod: 0.7,
    accuracyMod: 0.7,
    evasionMod: 0.6,
    retreatChance: 0.3,   // 30% 탈영/도주
    rallyCost: 60,
  },
};

/**
 * 사기 변화 요인
 */
export enum MoraleChangeReason {
  // 증가 요인
  VICTORY = 'VICTORY',                   // 전투 승리
  ENEMY_KILL = 'ENEMY_KILL',             // 적 격파
  COMMANDER_BONUS = 'COMMANDER_BONUS',   // 지휘관 특성
  SUPPLY_GOOD = 'SUPPLY_GOOD',           // 보급 양호
  RALLY = 'RALLY',                       // 사기 진작 명령
  REST = 'REST',                         // 휴식
  REINFORCEMENT = 'REINFORCEMENT',       // 지원군 도착
  
  // 감소 요인
  DEFEAT = 'DEFEAT',                     // 전투 패배
  DAMAGE_TAKEN = 'DAMAGE_TAKEN',         // 피해 입음
  ALLY_DESTROYED = 'ALLY_DESTROYED',     // 아군 전멸
  COMMANDER_KILLED = 'COMMANDER_KILLED', // 지휘관 전사
  SUPPLY_CUT = 'SUPPLY_CUT',             // 보급선 차단
  SURROUNDED = 'SURROUNDED',             // 포위됨
  ROUTED_ALLY = 'ROUTED_ALLY',           // 아군 패주
  FATIGUE = 'FATIGUE',                   // 장시간 전투
}

/**
 * 사기 변화량 정의
 */
export const MORALE_CHANGE_VALUES: Record<MoraleChangeReason, number> = {
  // 증가 (+)
  [MoraleChangeReason.VICTORY]: 15,
  [MoraleChangeReason.ENEMY_KILL]: 3,
  [MoraleChangeReason.COMMANDER_BONUS]: 5,
  [MoraleChangeReason.SUPPLY_GOOD]: 2,
  [MoraleChangeReason.RALLY]: 10,
  [MoraleChangeReason.REST]: 5,
  [MoraleChangeReason.REINFORCEMENT]: 10,
  
  // 감소 (-)
  [MoraleChangeReason.DEFEAT]: -20,
  [MoraleChangeReason.DAMAGE_TAKEN]: -5,
  [MoraleChangeReason.ALLY_DESTROYED]: -8,
  [MoraleChangeReason.COMMANDER_KILLED]: -25,
  [MoraleChangeReason.SUPPLY_CUT]: -10,
  [MoraleChangeReason.SURROUNDED]: -15,
  [MoraleChangeReason.ROUTED_ALLY]: -10,
  [MoraleChangeReason.FATIGUE]: -3,
};

/**
 * 유닛 사기 상태
 */
export interface UnitMoraleState {
  unitId: string;
  currentMorale: number;    // 0-100
  maxMorale: number;        // 기본 100, 지휘관 특성으로 변동
  moraleState: MoraleState;
  
  // 사기 회복
  recoveryRate: number;     // 턴당 자연 회복량
  lastRecoveryTick: number;
  
  // 사기 저하 면역
  immunityTicks: number;    // 사기 저하 면역 남은 틱
  
  // 기록
  moraleHistory: MoraleHistoryEntry[];
}

/**
 * 사기 변화 기록
 */
export interface MoraleHistoryEntry {
  tick: number;
  reason: MoraleChangeReason;
  change: number;
  newMorale: number;
}

// ============================================================
// Confusion System Types (혼란 시스템)
// ============================================================

/**
 * 혼란 상태 레벨
 */
export enum ConfusionLevel {
  NONE = 'NONE',       // 정상
  MINOR = 'MINOR',     // 경미한 혼란 - 일부 명령 지연
  MAJOR = 'MAJOR',     // 심각한 혼란 - 명령 무시, 무질서
  ROUTED = 'ROUTED',   // 패주 - 통제 불능, 도주
}

/**
 * 혼란 상태별 효과
 */
export interface ConfusionEffects {
  commandDelay: number;       // 명령 지연 (틱)
  commandIgnoreChance: number; // 명령 무시 확률 (0-1)
  attackMod: number;          // 공격력 배율
  defenseMod: number;         // 방어력 배율
  speedMod: number;           // 이동속도 배율
  spreadChance: number;       // 인접 유닛 전파 확률
  duration: number;           // 기본 지속 시간 (틱)
}

/**
 * 혼란 레벨별 효과
 */
export const CONFUSION_EFFECTS: Record<ConfusionLevel, ConfusionEffects> = {
  [ConfusionLevel.NONE]: {
    commandDelay: 0,
    commandIgnoreChance: 0,
    attackMod: 1.0,
    defenseMod: 1.0,
    speedMod: 1.0,
    spreadChance: 0,
    duration: 0,
  },
  [ConfusionLevel.MINOR]: {
    commandDelay: 2,
    commandIgnoreChance: 0.1,
    attackMod: 0.9,
    defenseMod: 0.9,
    speedMod: 0.95,
    spreadChance: 0.05,
    duration: 30,          // 30틱
  },
  [ConfusionLevel.MAJOR]: {
    commandDelay: 5,
    commandIgnoreChance: 0.4,
    attackMod: 0.6,
    defenseMod: 0.6,
    speedMod: 0.7,
    spreadChance: 0.2,
    duration: 60,          // 60틱
  },
  [ConfusionLevel.ROUTED]: {
    commandDelay: 10,
    commandIgnoreChance: 0.9,  // 거의 모든 명령 무시
    attackMod: 0.2,
    defenseMod: 0.3,
    speedMod: 1.5,             // 도주 속도 증가
    spreadChance: 0.5,
    duration: 120,             // 120틱
  },
};

/**
 * 혼란 발생 조건
 */
export enum ConfusionTrigger {
  HEAVY_CASUALTIES = 'HEAVY_CASUALTIES',       // 급격한 손실 (50%+ 피해)
  COMMANDER_KILLED = 'COMMANDER_KILLED',       // 지휘관 전사
  SURROUNDED = 'SURROUNDED',                   // 완전 포위
  FLAGSHIP_DESTROYED = 'FLAGSHIP_DESTROYED',   // 기함 격침
  ALLY_ROUTED = 'ALLY_ROUTED',                 // 인접 아군 패주
  CRITICAL_MORALE = 'CRITICAL_MORALE',         // 사기 위험 상태
  AMBUSH = 'AMBUSH',                           // 기습 당함
  ELECTRONIC_WARFARE = 'ELECTRONIC_WARFARE',   // 전자전 피해
}

/**
 * 혼란 트리거별 혼란 레벨
 */
export const CONFUSION_TRIGGER_LEVELS: Record<ConfusionTrigger, ConfusionLevel> = {
  [ConfusionTrigger.HEAVY_CASUALTIES]: ConfusionLevel.MAJOR,
  [ConfusionTrigger.COMMANDER_KILLED]: ConfusionLevel.MAJOR,
  [ConfusionTrigger.SURROUNDED]: ConfusionLevel.MINOR,
  [ConfusionTrigger.FLAGSHIP_DESTROYED]: ConfusionLevel.ROUTED,
  [ConfusionTrigger.ALLY_ROUTED]: ConfusionLevel.MINOR,
  [ConfusionTrigger.CRITICAL_MORALE]: ConfusionLevel.MINOR,
  [ConfusionTrigger.AMBUSH]: ConfusionLevel.MAJOR,
  [ConfusionTrigger.ELECTRONIC_WARFARE]: ConfusionLevel.MINOR,
};

/**
 * 유닛 혼란 상태
 */
export interface UnitConfusionState {
  unitId: string;
  level: ConfusionLevel;
  trigger?: ConfusionTrigger;
  
  // 지속 시간
  startTick: number;
  remainingTicks: number;
  
  // 회복 조건
  recoveryProgress: number;   // 0-1 (회복 진행도)
  recoveryRate: number;       // 틱당 회복량
  
  // 전파 면역
  spreadImmunityTicks: number;
}

// ============================================================
// Stance/Formation System Types (태세/진형 시스템)
// ============================================================

/**
 * 전투 태세
 */
export enum BattleStance {
  ASSAULT = 'ASSAULT',       // 공격 태세 - 공격+ 방어-
  DEFENSIVE = 'DEFENSIVE',   // 방어 태세 - 방어+ 공격-
  CHARGE = 'CHARGE',         // 돌격 태세 - 근접 공격 특화
  RETREAT = 'RETREAT',       // 후퇴 태세 - 이탈 특화
  HOLD = 'HOLD',             // 정지/대기 - 회피+
  PURSUIT = 'PURSUIT',       // 추격 태세 - 속도+
}

/**
 * 지상전 진형
 */
export enum GroundFormationType {
  COLUMN = 'COLUMN',           // 종대 - 이동 특화
  LINE = 'LINE',               // 횡대 - 화력 특화
  WEDGE = 'WEDGE',             // 쐐기 - 돌파 특화
  CRANE_WING = 'CRANE_WING',   // 학익진 - 포위 특화
  FISH_SCALE = 'FISH_SCALE',   // 어린진 - 방어 특화
  CIRCULAR = 'CIRCULAR',       // 원진 - 전방위 방어
  GUERRILLA = 'GUERRILLA',     // 산개 - 피해 분산
}

/**
 * 태세별 스탯 보정
 */
export interface StanceModifiers {
  attackMod: number;
  defenseMod: number;
  accuracyMod: number;
  evasionMod: number;
  speedMod: number;
  moraleRecoveryMod: number;
  detectionRange: number;      // 감지 범위 배율
  stealthMod: number;          // 은신 능력 배율
}

/**
 * 태세별 보정치
 */
export const STANCE_MODIFIERS: Record<BattleStance, StanceModifiers> = {
  [BattleStance.ASSAULT]: {
    attackMod: 1.3,
    defenseMod: 0.8,
    accuracyMod: 1.1,
    evasionMod: 0.9,
    speedMod: 1.1,
    moraleRecoveryMod: 0.8,
    detectionRange: 1.0,
    stealthMod: 0.8,
  },
  [BattleStance.DEFENSIVE]: {
    attackMod: 0.8,
    defenseMod: 1.4,
    accuracyMod: 1.0,
    evasionMod: 1.1,
    speedMod: 0.7,
    moraleRecoveryMod: 1.2,
    detectionRange: 1.2,
    stealthMod: 1.0,
  },
  [BattleStance.CHARGE]: {
    attackMod: 1.5,
    defenseMod: 0.6,
    accuracyMod: 0.9,
    evasionMod: 0.7,
    speedMod: 1.4,
    moraleRecoveryMod: 0.5,
    detectionRange: 0.8,
    stealthMod: 0.5,
  },
  [BattleStance.RETREAT]: {
    attackMod: 0.4,
    defenseMod: 0.9,
    accuracyMod: 0.7,
    evasionMod: 1.3,
    speedMod: 1.5,
    moraleRecoveryMod: 0.3,
    detectionRange: 0.7,
    stealthMod: 1.2,
  },
  [BattleStance.HOLD]: {
    attackMod: 0.9,
    defenseMod: 1.2,
    accuracyMod: 1.15,
    evasionMod: 1.2,
    speedMod: 0.0,             // 이동 불가
    moraleRecoveryMod: 1.5,
    detectionRange: 1.3,
    stealthMod: 1.3,
  },
  [BattleStance.PURSUIT]: {
    attackMod: 1.1,
    defenseMod: 0.85,
    accuracyMod: 0.85,
    evasionMod: 0.9,
    speedMod: 1.3,
    moraleRecoveryMod: 0.7,
    detectionRange: 1.1,
    stealthMod: 0.7,
  },
};

/**
 * 진형별 스탯 보정 (지상전)
 */
export interface GroundFormationModifiers {
  attackMod: number;
  defenseMod: number;
  flankDefense: number;       // 측면 방어력
  rearDefense: number;        // 후방 방어력
  chargePower: number;        // 돌격 위력
  resistCharge: number;       // 돌격 저항
  rangedAccuracy: number;     // 원거리 명중
  meleeBonus: number;         // 근접 보너스
  movementSpeed: number;      // 이동 속도
  changeTime: number;         // 진형 변경 소요 시간 (틱)
}

/**
 * 지상전 진형별 보정치
 */
export const GROUND_FORMATION_MODIFIERS: Record<GroundFormationType, GroundFormationModifiers> = {
  [GroundFormationType.COLUMN]: {
    attackMod: 0.9,
    defenseMod: 0.85,
    flankDefense: 0.6,
    rearDefense: 0.5,
    chargePower: 1.3,
    resistCharge: 0.7,
    rangedAccuracy: 0.8,
    meleeBonus: 1.0,
    movementSpeed: 1.4,
    changeTime: 10,
  },
  [GroundFormationType.LINE]: {
    attackMod: 1.2,
    defenseMod: 1.0,
    flankDefense: 0.7,
    rearDefense: 0.6,
    chargePower: 0.8,
    resistCharge: 1.2,
    rangedAccuracy: 1.3,
    meleeBonus: 0.9,
    movementSpeed: 0.9,
    changeTime: 15,
  },
  [GroundFormationType.WEDGE]: {
    attackMod: 1.3,
    defenseMod: 0.9,
    flankDefense: 0.75,
    rearDefense: 0.7,
    chargePower: 1.5,
    resistCharge: 0.8,
    rangedAccuracy: 0.9,
    meleeBonus: 1.2,
    movementSpeed: 1.1,
    changeTime: 20,
  },
  [GroundFormationType.CRANE_WING]: {
    attackMod: 1.15,
    defenseMod: 0.95,
    flankDefense: 1.1,
    rearDefense: 0.8,
    chargePower: 0.7,
    resistCharge: 1.0,
    rangedAccuracy: 1.2,
    meleeBonus: 1.1,
    movementSpeed: 0.85,
    changeTime: 25,
  },
  [GroundFormationType.FISH_SCALE]: {
    attackMod: 1.0,
    defenseMod: 1.3,
    flankDefense: 1.2,
    rearDefense: 1.1,
    chargePower: 0.6,
    resistCharge: 1.4,
    rangedAccuracy: 1.0,
    meleeBonus: 0.95,
    movementSpeed: 0.8,
    changeTime: 20,
  },
  [GroundFormationType.CIRCULAR]: {
    attackMod: 0.85,
    defenseMod: 1.4,
    flankDefense: 1.4,
    rearDefense: 1.4,
    chargePower: 0.4,
    resistCharge: 1.5,
    rangedAccuracy: 0.9,
    meleeBonus: 0.8,
    movementSpeed: 0.5,
    changeTime: 30,
  },
  [GroundFormationType.GUERRILLA]: {
    attackMod: 0.8,
    defenseMod: 0.7,
    flankDefense: 1.0,
    rearDefense: 1.0,
    chargePower: 0.5,
    resistCharge: 0.5,
    rangedAccuracy: 1.1,
    meleeBonus: 0.7,
    movementSpeed: 1.2,
    changeTime: 8,
  },
};

/**
 * 유닛 태세/진형 상태
 */
export interface UnitStanceState {
  unitId: string;
  
  // 태세
  currentStance: BattleStance;
  previousStance?: BattleStance;
  stanceChangeProgress: number;  // 0-1 (변경 진행도)
  stanceChangeTicks: number;     // 변경 남은 틱
  
  // 진형 (지상전용)
  currentFormation?: GroundFormationType;
  previousFormation?: GroundFormationType;
  formationChangeProgress: number;
  formationChangeTicks: number;
  
  // 태세 유지 보너스
  stanceHoldTicks: number;       // 현재 태세 유지 시간
  holdBonus: number;             // 유지 보너스 (0-0.2)
}

/**
 * 태세/진형 변경 커맨드
 */
export interface ChangeStanceCommand {
  unitId: string;
  targetStance: BattleStance;
  priority?: 'NORMAL' | 'URGENT';
}

export interface ChangeGroundFormationCommand {
  unitId: string;
  targetFormation: GroundFormationType;
  priority?: 'NORMAL' | 'URGENT';
}

// ============================================================
// Constants
// ============================================================

export const MORALE_CONSTANTS = {
  DEFAULT_MAX_MORALE: 100,
  DEFAULT_START_MORALE: 70,
  BASE_RECOVERY_RATE: 2,           // 틱당 기본 회복
  RECOVERY_INTERVAL_TICKS: 60,     // 자연 회복 간격 (60틱 = 약 1분)
  MAX_HISTORY_ENTRIES: 50,
  IMMUNITY_AFTER_RALLY: 30,        // 사기 진작 후 면역 시간 (틱)
};

export const CONFUSION_CONSTANTS = {
  SPREAD_CHECK_INTERVAL: 10,       // 전파 확인 간격 (틱)
  SPREAD_RADIUS: 100,              // 전파 범위
  RECOVERY_PER_TICK: 0.02,         // 틱당 회복량
  IMMUNITY_AFTER_RECOVERY: 60,     // 회복 후 면역 시간 (틱)
  HEAVY_CASUALTY_THRESHOLD: 0.5,   // 급격한 손실 기준 (50%)
};

export const STANCE_CONSTANTS = {
  BASE_CHANGE_TIME: 15,            // 기본 태세 변경 시간 (틱)
  URGENT_TIME_MULTIPLIER: 0.5,     // 긴급 변경 시간 배율
  URGENT_PENALTY: 0.1,             // 긴급 변경 페널티 (모든 스탯 -10%)
  HOLD_BONUS_MAX: 0.2,             // 최대 유지 보너스
  HOLD_BONUS_PER_TICK: 0.001,      // 틱당 유지 보너스 증가
};

// ============================================================
// Event Types
// ============================================================

export interface MoraleChangeEvent {
  unitId: string;
  previousMorale: number;
  newMorale: number;
  previousState: MoraleState;
  newState: MoraleState;
  reason: MoraleChangeReason;
  timestamp: number;
}

export interface ConfusionChangeEvent {
  unitId: string;
  previousLevel: ConfusionLevel;
  newLevel: ConfusionLevel;
  trigger?: ConfusionTrigger;
  timestamp: number;
}

export interface ConfusionSpreadEvent {
  sourceUnitId: string;
  targetUnitId: string;
  level: ConfusionLevel;
  timestamp: number;
}

export interface StanceChangeEvent {
  unitId: string;
  previousStance: BattleStance;
  newStance: BattleStance;
  timestamp: number;
}

export interface FormationChangeGroundEvent {
  unitId: string;
  previousFormation: GroundFormationType;
  newFormation: GroundFormationType;
  timestamp: number;
}





