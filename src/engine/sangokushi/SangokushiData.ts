/**
 * 삼국지 11 (코에이) 정확한 게임 데이터
 *
 * 출처: 웹 검색 (2025-11-08)
 * - 나무위키 삼국지 11
 * - 제타위키 삼국지 11 능력치 목록
 *
 * @module SangokushiData
 */

/**
 * 장수 데이터 인터페이스
 */
export interface ISangokushiCommander {
  /** 장수 이름 */
  name: string;
  /** 통솔력 (1-100) */
  leadership: number;
  /** 무력 (1-100) */
  strength: number;
  /** 지력 (1-100) */
  intelligence: number;
  /** 정치력 (1-100) */
  politics: number;
  /** 매력 (1-100) */
  charm: number;
  /** 특기 */
  specialAbility: string;
  /** 병과 적성 */
  unitAptitudes: {
    sword: 'S' | 'A' | 'B' | 'C';
    spear: 'S' | 'A' | 'B' | 'C';
    archer: 'S' | 'A' | 'B' | 'C';
    cavalry: 'S' | 'A' | 'B' | 'C';
    siege: 'S' | 'A' | 'B' | 'C';
    navy: 'S' | 'A' | 'B' | 'C';
  };
}

/**
 * 병종 타입
 */
export enum UnitType {
  /** 창병 (적색) - 기병에 강함 */
  SPEAR = 'spear',
  /** 극병 (청색) - 창병에 강함, 방어력 최고 */
  HALBERD = 'halberd',
  /** 기병 (흑색) - 극병에 강함, 기동력 최고 */
  CAVALRY = 'cavalry',
  /** 궁병/노병 - 원거리 공격 */
  ARCHER = 'archer',
}

/**
 * 병종 상성 시스템
 */
export const UNIT_COUNTER_SYSTEM = {
  [UnitType.SPEAR]: {
    strongAgainst: UnitType.CAVALRY,
    weakAgainst: UnitType.HALBERD,
    color: '적색',
    characteristics: [
      '기병에 강하고 극병에 약함',
      '공격력 중심, 방어력 보정 낮음',
      '전법으로 적을 강제 이동',
      '모래땅에서는 전법 사용 불가',
    ],
  },
  [UnitType.HALBERD]: {
    strongAgainst: UnitType.SPEAR,
    weakAgainst: UnitType.CAVALRY,
    color: '청색',
    characteristics: [
      '창병에 강함',
      '모든 병종 중 방어력 최고',
      '다수의 적 공격 가능',
      '모든 지형에서 전법 사용 가능',
    ],
  },
  [UnitType.CAVALRY]: {
    strongAgainst: UnitType.HALBERD,
    weakAgainst: UnitType.SPEAR,
    color: '흑색',
    characteristics: [
      '극병에 강함',
      '공격력 + 기동력 우수',
      '일기토 발생 가능',
      '습지/독천/잔도/숲에서 전법 사용 불가',
    ],
  },
  [UnitType.ARCHER]: {
    strongAgainst: null,
    weakAgainst: null,
    color: '기타',
    characteristics: [
      '원거리 공격',
      '반격 받지 않음 (응사 제외)',
      '지형 영향 적음',
      '특기 없어도 사용 가능',
    ],
  },
};

/**
 * 명장 데이터
 * 출처: 웹 검색 (2025-11-08)
 */
export const FAMOUS_COMMANDERS: Record<string, ISangokushiCommander> = {
  /** 조조 (Cao Cao) - 게임 내 최고 종합 능력치 */
  caocao: {
    name: '조조',
    leadership: 96,
    strength: 72,
    intelligence: 91,
    politics: 94,
    charm: 96,
    specialAbility: '허실', // Xu-shi (Deception)
    unitAptitudes: {
      sword: 'A',
      spear: 'A',
      archer: 'A',
      cavalry: 'S',
      siege: 'S',
      navy: 'B',
    },
  },

  /** 유비 (Liu Bei) */
  liubei: {
    name: '유비',
    leadership: 91,
    strength: 68,
    intelligence: 75,
    politics: 75,
    charm: 99, // 매력은 최고
    specialAbility: '도주', // Escape
    unitAptitudes: {
      sword: 'A',
      spear: 'A',
      archer: 'B',
      cavalry: 'A',
      siege: 'C',
      navy: 'C',
    },
  },

  /** 관우 (Guan Yu) */
  guanyu: {
    name: '관우',
    leadership: 96,
    strength: 97, // 여포(100), 장비(98), 마초(97) 다음
    intelligence: 74,
    politics: 62,
    charm: 93,
    specialAbility: '신장', // Divine General
    unitAptitudes: {
      sword: 'S',
      spear: 'S',
      archer: 'C',
      cavalry: 'S',
      siege: 'A',
      navy: 'B',
    },
  },

  /** 장비 (Zhang Fei) */
  zhangfei: {
    name: '장비',
    leadership: 88,
    strength: 98,
    intelligence: 30,
    politics: 28,
    charm: 65,
    specialAbility: '투신', // Assault (창신+극신)
    unitAptitudes: {
      sword: 'S',
      spear: 'S',
      archer: 'C',
      cavalry: 'A',
      siege: 'B',
      navy: 'C',
    },
  },

  /** 제갈량 (Zhuge Liang) */
  zhugeliang: {
    name: '제갈량',
    leadership: 92,
    strength: 13,
    intelligence: 100, // 최고 지력
    politics: 95,
    charm: 93,
    specialAbility: '귀모', // Divine Strategist
    unitAptitudes: {
      sword: 'C',
      spear: 'B',
      archer: 'A',
      cavalry: 'B',
      siege: 'S',
      navy: 'A',
    },
  },

  /** 여포 (Lü Bu) - 최강 무력 */
  lvbu: {
    name: '여포',
    leadership: 81,
    strength: 100, // 최고 무력
    intelligence: 28,
    politics: 11,
    charm: 28,
    specialAbility: '무쌍', // Unrivaled
    unitAptitudes: {
      sword: 'S',
      spear: 'S',
      archer: 'A',
      cavalry: 'S',
      siege: 'A',
      navy: 'C',
    },
  },

  /** 사마의 (Sima Yi) */
  simayi: {
    name: '사마의',
    leadership: 95,
    strength: 48,
    intelligence: 96,
    politics: 90,
    charm: 80,
    specialAbility: '귀모', // Divine Strategist
    unitAptitudes: {
      sword: 'A',
      spear: 'A',
      archer: 'S',
      cavalry: 'A',
      siege: 'S',
      navy: 'B',
    },
  },

  /** 조운 (Zhao Yun) */
  zhaoyun: {
    name: '조운',
    leadership: 91,
    strength: 96,
    intelligence: 76,
    politics: 65,
    charm: 93,
    specialAbility: '신장', // Divine General
    unitAptitudes: {
      sword: 'S',
      spear: 'S',
      archer: 'B',
      cavalry: 'S',
      siege: 'A',
      navy: 'B',
    },
  },
};

/**
 * 특기 목록 (일부)
 */
export const SPECIAL_ABILITIES = {
  /** 허실 - 조조 전용 */
  허실: {
    name: '허실',
    description: '적의 계략을 간파하고 자신의 계략 성공률 증가',
    effect: 'intelligence_bonus',
  },
  /** 도주 - 유비 전용 */
  도주: {
    name: '도주',
    description: '포위당했을 때 탈출 성공률 증가',
    effect: 'escape_bonus',
  },
  /** 신장 - 관우, 조운 등 */
  신장: {
    name: '신장',
    description: '무력이 높을 때 일반 공격 위력 증가',
    effect: 'strength_bonus',
  },
  /** 투신 - 장비 전용 */
  투신: {
    name: '투신',
    description: '창병 + 극병 특기 효과 동시 보유',
    effect: 'multi_weapon',
  },
  /** 귀모 - 제갈량, 사마의 */
  귀모: {
    name: '귀모',
    description: '계략 성공률 대폭 증가, 계략 거리 증가',
    effect: 'strategy_master',
  },
  /** 무쌍 - 여포 전용 */
  무쌍: {
    name: '무쌍',
    description: '일기토 최강, 일반 공격 위력 극대화',
    effect: 'combat_master',
  },
};

/**
 * 병종별 기본 스탯 (1000명 기준)
 */
export const UNIT_BASE_STATS = {
  [UnitType.SPEAR]: {
    attack: 100,
    defense: 90,
    mobility: 100,
    range: 1,
  },
  [UnitType.HALBERD]: {
    attack: 90,
    defense: 120, // 최고 방어력
    mobility: 90,
    range: 1,
  },
  [UnitType.CAVALRY]: {
    attack: 110,
    defense: 85,
    mobility: 150, // 최고 기동력
    range: 1,
  },
  [UnitType.ARCHER]: {
    attack: 80,
    defense: 70,
    mobility: 100,
    range: 3, // 원거리
  },
};

/**
 * 병과 적성별 능력치 보정
 */
export const APTITUDE_MODIFIERS = {
  S: 1.2, // +20%
  A: 1.1, // +10%
  B: 1.0, // 기본
  C: 0.9, // -10%
};

/**
 * 계산: 실제 전투력
 * (기본 스탯 + 장수 능력치) × 병과 적성 보정
 */
export function calculateCombatPower(
  commander: ISangokushiCommander,
  unitType: UnitType,
  soldiers: number
): number {
  const baseStats = UNIT_BASE_STATS[unitType];
  const aptitude = commander.unitAptitudes[unitType === UnitType.SPEAR ? 'spear' :
                                           unitType === UnitType.HALBERD ? 'spear' :
                                           unitType === UnitType.CAVALRY ? 'cavalry' : 'archer'];
  const modifier = APTITUDE_MODIFIERS[aptitude];

  // 전투력 = (기본 공격력 + 장수 무력) × 적성 보정 × 병력 수
  return (baseStats.attack + commander.strength) * modifier * (soldiers / 1000);
}
