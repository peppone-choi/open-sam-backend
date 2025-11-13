/**
 * TraitSystem - 부대 특성 시스템 (토탈 워: 삼국 기반)
 * 
 * 부대의 특수 능력을 정의하고 전투에서 다양한 효과를 발휘합니다.
 * 엘리트 유닛, 특수 병종, 장수 효과 등에 사용됩니다.
 */

import { UnitType } from '../../core/battle-calculator';

/**
 * 부대 특성 열거형
 */
export enum UnitTrait {
  // === 사기 관련 ===
  DISCIPLINED = 'DISCIPLINED',           // 훈련됨: 사기 -10% 감소 완화
  UNBREAKABLE = 'UNBREAKABLE',           // 불굴: 사기 붕괴 없음 (패주하지 않음)
  INSPIRING = 'INSPIRING',               // 고무: 주변 아군 사기 +5
  LOW_MORALE = 'LOW_MORALE',             // 낮은 사기: 사기 -20 페널티
  
  // === 공포 효과 ===
  CAUSE_FEAR = 'CAUSE_FEAR',             // 공포 유발: 적 사기 -5
  FEAR_IMMUNE = 'FEAR_IMMUNE',           // 공포 면역
  CAUSE_TERROR = 'CAUSE_TERROR',         // 공포 유발: 적 사기 -12, 패주 확률 증가
  
  // === 피로도 관련 ===
  FATIGUE_RESISTANT = 'FATIGUE_RESISTANT', // 피로 저항: 피로도 50% 느리게 증가
  FATIGUE_IMMUNE = 'FATIGUE_IMMUNE',       // 피로 면역: 피로도 증가 없음
  QUICK_FATIGUE = 'QUICK_FATIGUE',         // 빠른 피로: 피로도 50% 빠르게 증가
  
  // === 지형 관련 ===
  FOREST_EXPERT = 'FOREST_EXPERT',       // 숲 전문가: 숲에서 속도/공격 페널티 무시
  MOUNTAIN_EXPERT = 'MOUNTAIN_EXPERT',   // 산악 전문가: 산악에서 속도/공격 페널티 무시
  ALL_TERRAIN = 'ALL_TERRAIN',           // 전지형: 모든 지형 페널티 50% 감소
  
  // === 돌격 관련 ===
  CHARGE_DEFENSE = 'CHARGE_DEFENSE',     // 돌격 방어: 돌격 보너스 무효화 (창병 기본)
  CHARGE_REFLECT = 'CHARGE_REFLECT',     // 돌격 반사: 돌격 피해 반사 (일반)
  CHARGE_REFLECT_CAVALRY = 'CHARGE_REFLECT_CAVALRY', // 대기병 돌격 반사: 기병 돌격 피해 100% 반사
  POWERFUL_CHARGE = 'POWERFUL_CHARGE',   // 강력한 돌격: 돌격 보너스 +100%
  DEVASTATING_CHARGE = 'DEVASTATING_CHARGE', // 파괴적 돌격: 돌격 보너스 +200%, 충격 피해 2배
  
  // === 특수 배치 ===
  GUERRILLA_DEPLOY = 'GUERRILLA_DEPLOY', // 유격 배치: 전장 어디든 배치 가능
  VANGUARD_DEPLOY = 'VANGUARD_DEPLOY',   // 전위 배치: 아군 진영 앞쪽까지 배치 가능
  
  // === 은신 & 정찰 ===
  STALK = 'STALK',                       // 은신: 숲/언덕에서 은신 가능
  HIDE_FOREST = 'HIDE_FOREST',           // 숲 은신: 숲에서만 은신
  HIDE_ANYWHERE = 'HIDE_ANYWHERE',       // 완전 은신: 어디서든 은신 가능
  
  // === 사격 관련 ===
  SNIPER = 'SNIPER',                     // 저격수: 사거리 +20%, 명중률 +15%
  FLAMING_SHOT = 'FLAMING_SHOT',         // 화살: 사기 -5, 화염 피해
  ARMOR_PIERCING_SHOT = 'ARMOR_PIERCING_SHOT', // 관통탄: 장갑 관통 +50%
  RAPID_FIRE = 'RAPID_FIRE',             // 속사: 공격 속도 +30%
  
  // === 방어 관련 ===
  SHIELDED = 'SHIELDED',                 // 방패: 정면 원거리 방어 +35%
  SHIELD_WALL_EXPERT = 'SHIELD_WALL_EXPERT', // 방패벽 전문: 방패벽 포메이션 효과 +50%
  ARMORED = 'ARMORED',                   // 중갑: 장갑 +20
  HEAVILY_ARMORED = 'HEAVILY_ARMORED',   // 초중갑: 장갑 +40, 속도 -20%
  
  // === 공격 관련 ===
  ARMOR_PIERCING = 'ARMOR_PIERCING',     // 관통 무기: 관통 피해 +30%
  ANTI_INFANTRY = 'ANTI_INFANTRY',       // 대보병: 보병 상대 +20% 피해
  ANTI_CAVALRY = 'ANTI_CAVALRY',         // 대기병: 기병 상대 +25% 피해
  BONUS_VS_LARGE = 'BONUS_VS_LARGE',     // 대형 상대 보너스: 기병/공성병기 +30%
  
  // === 재생 & 회복 ===
  REGENERATION = 'REGENERATION',         // 재생: 전투 중 체력 회복
  ENCOURAGE = 'ENCOURAGE',               // 격려: 근처 아군 사기 회복
  
  // === 특수 능력 ===
  FIRE_IMMUNE = 'FIRE_IMMUNE',           // 화염 면역
  FIRE_VULNERABLE = 'FIRE_VULNERABLE',   // 화염 취약: 화염 피해 +50%
  SIEGE_ATTACKER = 'SIEGE_ATTACKER',     // 공성 특화: 성문/성벽 +100% 피해
  SIEGE_DEFENDER = 'SIEGE_DEFENDER',     // 수성 특화: 성 방어 시 +30% 방어
  
  // === 엘리트 전용 ===
  EXPERT_CHARGE_DEFENSE = 'EXPERT_CHARGE_DEFENSE', // 전문 돌격 방어: 돌격 피해 완전 무효
  PERFECT_VIGOR = 'PERFECT_VIGOR',       // 완벽한 활력: 피로도 매우 느리게 증가 (20%)
  ENCOURAGE_NEARBY = 'ENCOURAGE_NEARBY', // 주변 격려: 30m 내 아군 사기 +10, 피로 회복
}

/**
 * 피로도 상태 (토탈 워 기준)
 */
export enum FatigueLevel {
  FRESH = 'FRESH',                       // 활력이 넘침 (0-20%)
  ACTIVE = 'ACTIVE',                     // 활동적임 (20-40%)
  WINDED = 'WINDED',                     // 숨이 가쁨 (40-60%)
  TIRED = 'TIRED',                       // 지침 (60-80%)
  VERY_TIRED = 'VERY_TIRED',             // 매우 지침 (80-95%)
  EXHAUSTED = 'EXHAUSTED'                // 탈진 (95-100%)
}

/**
 * 피로도 효과 (능력치 감소)
 */
export const FATIGUE_EFFECTS: Record<FatigueLevel, { 
  speed: number;      // 속도 배수
  attack: number;     // 공격력 배수
  defense: number;    // 방어력 배수
  moralePenalty: number; // 사기 감소
}> = {
  [FatigueLevel.FRESH]: { speed: 1.0, attack: 1.0, defense: 1.0, moralePenalty: 0 },
  [FatigueLevel.ACTIVE]: { speed: 0.95, attack: 1.0, defense: 1.0, moralePenalty: 0 },
  [FatigueLevel.WINDED]: { speed: 0.85, attack: 0.95, defense: 0.95, moralePenalty: -5 },
  [FatigueLevel.TIRED]: { speed: 0.7, attack: 0.85, defense: 0.9, moralePenalty: -10 },
  [FatigueLevel.VERY_TIRED]: { speed: 0.5, attack: 0.7, defense: 0.8, moralePenalty: -20 },
  [FatigueLevel.EXHAUSTED]: { speed: 0.3, attack: 0.5, defense: 0.6, moralePenalty: -30 }
};

/**
 * 특성 효과 데이터
 */
export interface TraitEffect {
  moraleBonus?: number;          // 사기 보너스
  moraleMultiplier?: number;     // 사기 배수
  moraleLoss?: number;           // 사기 감소 (0 = 감소 없음)
  speedMultiplier?: number;      // 속도 배수
  attackMultiplier?: number;     // 공격력 배수
  defenseMultiplier?: number;    // 방어력 배수
  armorBonus?: number;           // 장갑 보너스
  chargeBonus?: number;          // 돌격 보너스 배수
  fatigueRateMultiplier?: number; // 피로도 증가율
  rangeBonus?: number;           // 사거리 보너스 (%)
  accuracyBonus?: number;        // 명중률 보너스 (%)
  description: string;           // 설명
}

/**
 * 특성별 효과 정의
 */
export const TRAIT_EFFECTS: Record<UnitTrait, TraitEffect> = {
  // 사기
  [UnitTrait.DISCIPLINED]: {
    moraleMultiplier: 1.1,
    description: '훈련된 부대. 사기 감소 10% 완화'
  },
  [UnitTrait.UNBREAKABLE]: {
    moraleLoss: 0,
    description: '불굴의 의지. 절대 패주하지 않음'
  },
  [UnitTrait.INSPIRING]: {
    moraleBonus: 5,
    description: '고무적인 존재. 주변 아군 사기 +5'
  },
  [UnitTrait.LOW_MORALE]: {
    moraleBonus: -20,
    description: '낮은 사기. 쉽게 흔들림'
  },
  
  // 공포
  [UnitTrait.CAUSE_FEAR]: {
    description: '공포 유발. 적 사기 -5'
  },
  [UnitTrait.FEAR_IMMUNE]: {
    description: '공포 면역'
  },
  [UnitTrait.CAUSE_TERROR]: {
    description: '공포 유발. 적 사기 -12, 패주 확률 증가'
  },
  
  // 피로도
  [UnitTrait.FATIGUE_RESISTANT]: {
    fatigueRateMultiplier: 0.5,
    description: '피로 저항. 피로도 50% 느리게 증가'
  },
  [UnitTrait.FATIGUE_IMMUNE]: {
    fatigueRateMultiplier: 0,
    description: '피로 면역. 피로도 증가 없음'
  },
  [UnitTrait.QUICK_FATIGUE]: {
    fatigueRateMultiplier: 1.5,
    description: '빠른 피로. 피로도 50% 빠르게 증가'
  },
  
  // 지형
  [UnitTrait.FOREST_EXPERT]: {
    description: '숲 전문가. 숲에서 페널티 무시'
  },
  [UnitTrait.MOUNTAIN_EXPERT]: {
    description: '산악 전문가. 산악에서 페널티 무시'
  },
  [UnitTrait.ALL_TERRAIN]: {
    description: '전지형. 지형 페널티 50% 감소'
  },
  
  // 돌격
  [UnitTrait.CHARGE_DEFENSE]: {
    description: '돌격 방어. 돌격 보너스 무효화'
  },
  [UnitTrait.CHARGE_REFLECT]: {
    description: '돌격 반사. 정면 돌격 피해 반사'
  },
  [UnitTrait.CHARGE_REFLECT_CAVALRY]: {
    description: '대기병 돌격 반사. 기병 돌격 피해 100% 반사'
  },
  [UnitTrait.POWERFUL_CHARGE]: {
    chargeBonus: 2.0,
    description: '강력한 돌격. 돌격 보너스 +100%'
  },
  [UnitTrait.DEVASTATING_CHARGE]: {
    chargeBonus: 3.0,
    description: '파괴적 돌격. 돌격 보너스 +200%, 충격 피해 2배'
  },
  
  // 배치
  [UnitTrait.GUERRILLA_DEPLOY]: {
    description: '유격 배치. 전장 어디든 배치 가능'
  },
  [UnitTrait.VANGUARD_DEPLOY]: {
    description: '전위 배치. 전진 배치 가능'
  },
  
  // 은신
  [UnitTrait.STALK]: {
    description: '은신. 숲/언덕에서 은신 가능'
  },
  [UnitTrait.HIDE_FOREST]: {
    description: '숲 은신'
  },
  [UnitTrait.HIDE_ANYWHERE]: {
    description: '완전 은신'
  },
  
  // 사격
  [UnitTrait.SNIPER]: {
    rangeBonus: 20,
    accuracyBonus: 15,
    description: '저격수. 사거리 +20%, 명중률 +15%'
  },
  [UnitTrait.FLAMING_SHOT]: {
    description: '화살. 화염 피해, 적 사기 -5'
  },
  [UnitTrait.ARMOR_PIERCING_SHOT]: {
    description: '관통탄. 장갑 관통 +50%'
  },
  [UnitTrait.RAPID_FIRE]: {
    attackMultiplier: 1.3,
    description: '속사. 공격 속도 +30%'
  },
  
  // 방어
  [UnitTrait.SHIELDED]: {
    description: '방패. 정면 원거리 방어 +35%'
  },
  [UnitTrait.SHIELD_WALL_EXPERT]: {
    description: '방패벽 전문가. 방패벽 효과 +50%'
  },
  [UnitTrait.ARMORED]: {
    armorBonus: 20,
    speedMultiplier: 0.95,
    description: '중갑. 장갑 +20'
  },
  [UnitTrait.HEAVILY_ARMORED]: {
    armorBonus: 40,
    speedMultiplier: 0.8,
    description: '초중갑. 장갑 +40, 속도 -20%'
  },
  
  // 공격
  [UnitTrait.ARMOR_PIERCING]: {
    description: '관통 무기. 관통 피해 +30%'
  },
  [UnitTrait.ANTI_INFANTRY]: {
    description: '대보병. 보병 상대 +20% 피해'
  },
  [UnitTrait.ANTI_CAVALRY]: {
    description: '대기병. 기병 상대 +25% 피해'
  },
  [UnitTrait.BONUS_VS_LARGE]: {
    description: '대형 상대. 기병/공성 +30% 피해'
  },
  
  // 재생
  [UnitTrait.REGENERATION]: {
    description: '재생. 전투 중 체력 회복'
  },
  [UnitTrait.ENCOURAGE]: {
    description: '격려. 근처 아군 사기 회복'
  },
  
  // 특수
  [UnitTrait.FIRE_IMMUNE]: {
    description: '화염 면역'
  },
  [UnitTrait.FIRE_VULNERABLE]: {
    description: '화염 취약. 화염 피해 +50%'
  },
  [UnitTrait.SIEGE_ATTACKER]: {
    description: '공성 특화. 성문/성벽 +100% 피해'
  },
  [UnitTrait.SIEGE_DEFENDER]: {
    defenseMultiplier: 1.3,
    description: '수성 특화. 성 방어 시 +30%'
  },
  
  // 엘리트
  [UnitTrait.EXPERT_CHARGE_DEFENSE]: {
    description: '전문 돌격 방어. 돌격 피해 완전 무효'
  },
  [UnitTrait.PERFECT_VIGOR]: {
    fatigueRateMultiplier: 0.2,
    description: '완벽한 활력. 피로도 매우 느리게 증가'
  },
  [UnitTrait.ENCOURAGE_NEARBY]: {
    description: '주변 격려. 30m 내 아군 사기 +10, 피로 회복'
  }
};

/**
 * 병종별 기본 특성
 */
export const DEFAULT_UNIT_TRAITS: Record<UnitType, UnitTrait[]> = {
  [UnitType.FOOTMAN]: [],
  [UnitType.SPEARMAN]: [UnitTrait.CHARGE_REFLECT_CAVALRY], // 창병은 기본적으로 돌격 반사
  [UnitType.HALBERD]: [UnitTrait.CHARGE_DEFENSE],           // 극병은 돌격 방어
  [UnitType.CAVALRY]: [UnitTrait.DEVASTATING_CHARGE],       // 기병은 강력한 돌격
  [UnitType.ARCHER]: [],
  [UnitType.WIZARD]: [],
  [UnitType.SIEGE]: [UnitTrait.SIEGE_ATTACKER]
};

/**
 * 피로도 계산
 */
export function calculateFatigue(
  currentFatigue: number,
  isRunning: boolean,
  isFighting: boolean,
  traits: UnitTrait[],
  deltaTime: number // ms
): number {
  // 기본 피로도 증가율 (달리기: 24/s, 전투: 10/s, 걷기: -1/s)
  let fatigueRate = 0;
  
  if (isRunning) {
    fatigueRate = 24;
  } else if (isFighting) {
    fatigueRate = 10;
  } else {
    fatigueRate = -1; // 걷기/대기 시 회복
  }
  
  // 특성 효과 적용
  for (const trait of traits) {
    const effect = TRAIT_EFFECTS[trait];
    if (effect.fatigueRateMultiplier !== undefined) {
      fatigueRate *= effect.fatigueRateMultiplier;
    }
  }
  
  // deltaTime 적용 (초 단위로 변환)
  const fatigueChange = (fatigueRate * deltaTime) / 1000;
  
  // 0-100 범위로 제한
  return Math.max(0, Math.min(100, currentFatigue + fatigueChange));
}

/**
 * 피로도 레벨 결정
 */
export function getFatigueLevel(fatigue: number): FatigueLevel {
  if (fatigue < 20) return FatigueLevel.FRESH;
  if (fatigue < 40) return FatigueLevel.ACTIVE;
  if (fatigue < 60) return FatigueLevel.WINDED;
  if (fatigue < 80) return FatigueLevel.TIRED;
  if (fatigue < 95) return FatigueLevel.VERY_TIRED;
  return FatigueLevel.EXHAUSTED;
}

/**
 * 돌격 피해 반사 확인
 */
export function checkChargeReflect(
  defenderTraits: UnitTrait[],
  attackerType: UnitType,
  isFrontalCharge: boolean
): number {
  if (!isFrontalCharge) return 0; // 측/후방 돌격은 반사 안됨
  
  // 대기병 돌격 반사 (창병 특화)
  if (defenderTraits.includes(UnitTrait.CHARGE_REFLECT_CAVALRY)) {
    if (attackerType === UnitType.CAVALRY) {
      return 1.0; // 100% 반사
    }
  }
  
  // 일반 돌격 반사
  if (defenderTraits.includes(UnitTrait.CHARGE_REFLECT)) {
    return 0.5; // 50% 반사
  }
  
  // 전문 돌격 방어
  if (defenderTraits.includes(UnitTrait.EXPERT_CHARGE_DEFENSE)) {
    return 1.0; // 100% 반사
  }
  
  return 0;
}

/**
 * 돌격 방어 확인 (돌격 보너스 무효화)
 */
export function hasChargeDefense(traits: UnitTrait[]): boolean {
  return traits.includes(UnitTrait.CHARGE_DEFENSE) ||
         traits.includes(UnitTrait.CHARGE_REFLECT) ||
         traits.includes(UnitTrait.CHARGE_REFLECT_CAVALRY) ||
         traits.includes(UnitTrait.EXPERT_CHARGE_DEFENSE);
}

/**
 * 사기 보너스 계산 (특성 기반)
 */
export function calculateMoraleModifier(traits: UnitTrait[]): { bonus: number; multiplier: number } {
  let bonus = 0;
  let multiplier = 1.0;
  
  for (const trait of traits) {
    const effect = TRAIT_EFFECTS[trait];
    if (effect.moraleBonus) bonus += effect.moraleBonus;
    if (effect.moraleMultiplier) multiplier *= effect.moraleMultiplier;
  }
  
  return { bonus, multiplier };
}

/**
 * 특성이 있는지 확인
 */
export function hasTrait(traits: UnitTrait[], trait: UnitTrait): boolean {
  return traits.includes(trait);
}
