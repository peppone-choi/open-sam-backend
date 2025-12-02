/**
 * 통합 진형 시스템
 * 삼국지 + 은하영웅전설 진형 통합
 */

// ============================================================================
// 삼국지 진형 시스템
// ============================================================================

/**
 * 삼국지 진형 타입
 * 역사적 진형을 기반으로 한 전술 시스템
 */
export type Formation =
  | 'fishScale'    // 어린진(魚鱗陣) - 공격 중시, 쐐기 대형
  | 'craneWing'    // 학익진(鶴翼陣) - 포위 공격, 날개 대형
  | 'circular'     // 방원진(方圓陣) - 방어 중시, 원형
  | 'arrowhead'    // 봉시진(鋒矢陣) - 돌파, 화살촉 대형
  | 'longSnake'    // 장사진(長蛇陣) - 기동력, 뱀 대형
  | 'yenWing'      // 안행진(雁行陣) - 측면 공격, 기러기 대형
  | 'square'       // 방진(方陣) - 균형, 사각 대형
  | 'hook';        // 구형진(鉤形陣) - 매복, 갈고리 대형

/**
 * 삼국지 진형 스탯 보정
 */
export interface IFormationStats {
  attack: number;       // 공격력 보정 (1.0 = 100%)
  defense: number;      // 방어력 보정
  speed: number;        // 이동 속도 보정
  range: number;        // 사정거리 보정
  critRate?: number;    // 치명타 확률 보정
  morale?: number;      // 사기 보정
}

/**
 * 삼국지 진형 설정
 */
export const FORMATION_STATS: Record<Formation, IFormationStats> = {
  fishScale: {
    attack: 1.2,
    defense: 0.9,
    speed: 1.0,
    range: 1.0,
    critRate: 1.1,
    morale: 1.0,
  },
  craneWing: {
    attack: 1.1,
    defense: 1.0,
    speed: 0.9,
    range: 1.1,
    critRate: 1.0,
    morale: 1.0,
  },
  circular: {
    attack: 0.9,
    defense: 1.3,
    speed: 0.8,
    range: 1.0,
    critRate: 0.9,
    morale: 1.1,
  },
  arrowhead: {
    attack: 1.3,
    defense: 0.8,
    speed: 1.2,
    range: 0.9,
    critRate: 1.2,
    morale: 1.0,
  },
  longSnake: {
    attack: 1.0,
    defense: 1.0,
    speed: 1.3,
    range: 1.0,
    critRate: 1.0,
    morale: 0.9,
  },
  yenWing: {
    attack: 1.15,
    defense: 0.95,
    speed: 1.0,
    range: 1.2,
    critRate: 1.0,
    morale: 1.0,
  },
  square: {
    attack: 1.0,
    defense: 1.1,
    speed: 0.95,
    range: 1.0,
    critRate: 1.0,
    morale: 1.05,
  },
  hook: {
    attack: 1.1,
    defense: 0.85,
    speed: 1.1,
    range: 0.95,
    critRate: 1.3, // 매복 보너스
    morale: 0.95,
  },
};

/**
 * 진형 상성 관계
 * 특정 진형이 다른 진형에 유리/불리
 * 값: 1.0 = 동등, >1.0 = 유리, <1.0 = 불리
 */
export const FORMATION_COUNTER: Record<Formation, Partial<Record<Formation, number>>> = {
  fishScale: {
    craneWing: 0.85,   // 포위에 약함
    circular: 0.9,     // 방어진에 약간 약함
    longSnake: 1.15,   // 장사진에 유리
  },
  craneWing: {
    arrowhead: 0.8,    // 돌파에 약함
    fishScale: 1.15,   // 어린진에 유리
    circular: 1.1,
  },
  circular: {
    arrowhead: 0.9,    // 돌파에 약간 약함
    fishScale: 1.1,
    longSnake: 1.2,    // 장사진에 유리
  },
  arrowhead: {
    circular: 1.1,
    craneWing: 1.2,    // 학익진에 유리
    hook: 0.7,         // 매복에 약함
  },
  longSnake: {
    fishScale: 0.85,
    circular: 0.8,
    hook: 1.15,        // 갈고리진에 유리
  },
  yenWing: {
    square: 1.1,
    longSnake: 1.1,
    circular: 0.9,
  },
  square: {
    yenWing: 0.9,
    arrowhead: 0.95,
    circular: 1.0,
  },
  hook: {
    arrowhead: 1.3,    // 돌파 부대 매복에 유리
    longSnake: 0.85,
    craneWing: 0.9,
  },
};

// ============================================================================
// 은하영웅전설 진형 시스템
// ============================================================================

/**
 * 은영전 함대 진형
 */
export type LoghFormation =
  | 'standard'     // 표준 - 균형
  | 'offensive'    // 공세 - 공격 중시
  | 'defensive'    // 수세 - 방어 중시
  | 'encircle'     // 포위 - 적 포위
  | 'retreat'      // 퇴각 - 기동력 중시
  | 'wedge'        // 쐐기 - 돌파
  | 'crane';       // 학익 - 측면 공격

/**
 * 은영전 전투 자세
 */
export type CombatStance =
  | 'aggressive'   // 공격적 - 화력 집중
  | 'defensive'    // 방어적 - 피해 최소화
  | 'balanced'     // 균형 - 표준
  | 'hold_fire'    // 사격 금지 - 은폐/기동
  | 'evasive';     // 회피 - 최대 회피

/**
 * 은영전 진형 스탯 보정 (퍼센트)
 */
export interface ILoghFormationStats {
  attackBonus: number;      // 공격력 보너스 (%)
  defenseBonus: number;     // 방어력 보너스 (%)
  mobilityBonus: number;    // 기동력 보너스 (%)
}

/**
 * 은영전 자세 스탯 보정 (퍼센트)
 */
export interface ICombatStanceStats {
  attackRange: number;      // 사정거리 보정 (%)
  fireRate: number;         // 사격 속도 보정 (%)
  evasion: number;          // 회피율 보정 (%)
  mobility: number;         // 기동력 보정 (%)
  accuracy: number;         // 명중률 보정 (%)
}

/**
 * 은영전 진형 설정
 */
export const LOGH_FORMATION_STATS: Record<LoghFormation, ILoghFormationStats> = {
  standard: { attackBonus: 0, defenseBonus: 0, mobilityBonus: 0 },
  offensive: { attackBonus: 20, defenseBonus: -10, mobilityBonus: 0 },
  defensive: { attackBonus: -10, defenseBonus: 20, mobilityBonus: -10 },
  encircle: { attackBonus: 10, defenseBonus: 0, mobilityBonus: -20 },
  retreat: { attackBonus: -50, defenseBonus: -20, mobilityBonus: 30 },
  wedge: { attackBonus: 30, defenseBonus: -15, mobilityBonus: 10 },
  crane: { attackBonus: 5, defenseBonus: -5, mobilityBonus: 5 },
};

/**
 * 은영전 자세 설정
 */
export const COMBAT_STANCE_STATS: Record<CombatStance, ICombatStanceStats> = {
  balanced: { attackRange: 0, fireRate: 0, evasion: 0, mobility: 0, accuracy: 0 },
  aggressive: { attackRange: 10, fireRate: 20, evasion: -10, mobility: 15, accuracy: -5 },
  defensive: { attackRange: -10, fireRate: -10, evasion: 20, mobility: -20, accuracy: 10 },
  hold_fire: { attackRange: 0, fireRate: -100, evasion: 10, mobility: 20, accuracy: 0 },
  evasive: { attackRange: -20, fireRate: -30, evasion: 40, mobility: 50, accuracy: -20 },
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 삼국지 진형 스탯 가져오기
 */
export function getFormationStats(formation: Formation): IFormationStats {
  return FORMATION_STATS[formation] || FORMATION_STATS.square;
}

/**
 * 진형 상성 보정치 가져오기
 */
export function getFormationCounter(attacker: Formation, defender: Formation): number {
  return FORMATION_COUNTER[attacker]?.[defender] ?? 1.0;
}

/**
 * 은영전 진형 스탯 가져오기
 */
export function getLoghFormationStats(formation: LoghFormation): ILoghFormationStats {
  return LOGH_FORMATION_STATS[formation] || LOGH_FORMATION_STATS.standard;
}

/**
 * 은영전 자세 스탯 가져오기
 */
export function getCombatStanceStats(stance: CombatStance): ICombatStanceStats {
  return COMBAT_STANCE_STATS[stance] || COMBAT_STANCE_STATS.balanced;
}

/**
 * 전투 보정치 적용 (삼국지)
 */
export function applyFormationModifier(
  baseValue: number,
  formation: Formation,
  statType: keyof IFormationStats
): number {
  const stats = getFormationStats(formation);
  const modifier = stats[statType] ?? 1.0;
  return baseValue * modifier;
}

/**
 * 전투 보정치 적용 (은영전 진형)
 */
export function applyLoghFormationModifier(
  baseValue: number,
  formation: LoghFormation,
  statType: keyof ILoghFormationStats
): number {
  const stats = getLoghFormationStats(formation);
  const modifier = stats[statType] ?? 0;
  return baseValue * (1 + modifier / 100);
}

/**
 * 전투 보정치 적용 (은영전 자세)
 */
export function applyCombatStanceModifier(
  baseValue: number,
  stance: CombatStance,
  statType: keyof ICombatStanceStats
): number {
  const stats = getCombatStanceStats(stance);
  const modifier = stats[statType] ?? 0;
  return baseValue * (1 + modifier / 100);
}

// ============================================================================
// 진형 변경 관련
// ============================================================================

/**
 * 진형 변경 비용 (턴/시간)
 */
export interface IFormationChangeCost {
  turns?: number;        // 턴제: 필요 턴 수
  time?: number;         // 실시간: 필요 초
  moraleRequired: number; // 필요 최소 사기
  mobilityPenalty: number; // 변경 중 기동력 패널티 (%)
}

/**
 * 삼국지 진형 변경 비용
 */
export const FORMATION_CHANGE_COST: Record<Formation, IFormationChangeCost> = {
  fishScale: { turns: 1, moraleRequired: 30, mobilityPenalty: 50 },
  craneWing: { turns: 2, moraleRequired: 40, mobilityPenalty: 60 },
  circular: { turns: 1, moraleRequired: 20, mobilityPenalty: 40 },
  arrowhead: { turns: 1, moraleRequired: 35, mobilityPenalty: 45 },
  longSnake: { turns: 1, moraleRequired: 25, mobilityPenalty: 30 },
  yenWing: { turns: 2, moraleRequired: 40, mobilityPenalty: 55 },
  square: { turns: 1, moraleRequired: 20, mobilityPenalty: 35 },
  hook: { turns: 2, moraleRequired: 45, mobilityPenalty: 70 },
};

/**
 * 은영전 진형 변경 비용
 */
export const LOGH_FORMATION_CHANGE_COST: Record<LoghFormation, IFormationChangeCost> = {
  standard: { time: 5, moraleRequired: 20, mobilityPenalty: 20 },
  offensive: { time: 8, moraleRequired: 35, mobilityPenalty: 30 },
  defensive: { time: 6, moraleRequired: 25, mobilityPenalty: 40 },
  encircle: { time: 15, moraleRequired: 50, mobilityPenalty: 60 },
  retreat: { time: 3, moraleRequired: 10, mobilityPenalty: 10 },
  wedge: { time: 10, moraleRequired: 40, mobilityPenalty: 35 },
  crane: { time: 12, moraleRequired: 45, mobilityPenalty: 45 },
};

/**
 * 진형 변경 가능 여부 확인 (삼국지)
 */
export function canChangeFormation(
  currentMorale: number,
  targetFormation: Formation
): boolean {
  const cost = FORMATION_CHANGE_COST[targetFormation];
  return currentMorale >= cost.moraleRequired;
}

/**
 * 진형 변경 가능 여부 확인 (은영전)
 */
export function canChangeLoghFormation(
  currentMorale: number,
  targetFormation: LoghFormation
): boolean {
  const cost = LOGH_FORMATION_CHANGE_COST[targetFormation];
  return currentMorale >= cost.moraleRequired;
}

// ============================================================================
// 진형 정보
// ============================================================================

/**
 * 진형 메타데이터
 */
export interface IFormationMeta {
  id: string;
  name: string;
  nameKorean: string;
  description: string;
  icon?: string;
}

/**
 * 삼국지 진형 메타데이터
 */
export const FORMATION_META: Record<Formation, IFormationMeta> = {
  fishScale: {
    id: 'fishScale',
    name: 'Fish Scale',
    nameKorean: '어린진(魚鱗陣)',
    description: '물고기 비늘처럼 밀집한 공격형 진형. 전방 돌파에 유리.',
  },
  craneWing: {
    id: 'craneWing',
    name: 'Crane Wing',
    nameKorean: '학익진(鶴翼陣)',
    description: '학의 날개처럼 펼쳐진 포위형 진형. 측면 공격에 유리.',
  },
  circular: {
    id: 'circular',
    name: 'Circular',
    nameKorean: '방원진(方圓陣)',
    description: '원형으로 배치한 방어형 진형. 전방위 방어에 유리.',
  },
  arrowhead: {
    id: 'arrowhead',
    name: 'Arrowhead',
    nameKorean: '봉시진(鋒矢陣)',
    description: '화살촉 형태의 돌파형 진형. 적진 돌파에 유리.',
  },
  longSnake: {
    id: 'longSnake',
    name: 'Long Snake',
    nameKorean: '장사진(長蛇陣)',
    description: '뱀처럼 긴 기동형 진형. 빠른 이동과 회피에 유리.',
  },
  yenWing: {
    id: 'yenWing',
    name: 'Yen Wing',
    nameKorean: '안행진(雁行陣)',
    description: '기러기 날개처럼 비스듬한 측면 공격 진형.',
  },
  square: {
    id: 'square',
    name: 'Square',
    nameKorean: '방진(方陣)',
    description: '사각형의 균형 잡힌 기본 진형.',
  },
  hook: {
    id: 'hook',
    name: 'Hook',
    nameKorean: '구형진(鉤形陣)',
    description: '갈고리 형태의 매복형 진형. 기습에 유리.',
  },
};

/**
 * 은영전 진형 메타데이터
 */
export const LOGH_FORMATION_META: Record<LoghFormation, IFormationMeta> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    nameKorean: '표준 진형',
    description: '균형 잡힌 기본 함대 진형.',
  },
  offensive: {
    id: 'offensive',
    name: 'Offensive',
    nameKorean: '공세 진형',
    description: '화력 집중을 위한 공격형 진형.',
  },
  defensive: {
    id: 'defensive',
    name: 'Defensive',
    nameKorean: '수세 진형',
    description: '피해 최소화를 위한 방어형 진형.',
  },
  encircle: {
    id: 'encircle',
    name: 'Encircle',
    nameKorean: '포위 진형',
    description: '적 함대를 포위하기 위한 진형.',
  },
  retreat: {
    id: 'retreat',
    name: 'Retreat',
    nameKorean: '퇴각 진형',
    description: '신속한 철수를 위한 진형.',
  },
  wedge: {
    id: 'wedge',
    name: 'Wedge',
    nameKorean: '쐐기 진형',
    description: '적진 돌파를 위한 쐐기 형태 진형.',
  },
  crane: {
    id: 'crane',
    name: 'Crane',
    nameKorean: '학익 진형',
    description: '측면 공격을 위한 날개 형태 진형.',
  },
};




