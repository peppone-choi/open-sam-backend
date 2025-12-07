/**
 * Gin7 Character Generation Service
 * 은하영웅전설 캐릭터 생성 시스템
 */

import {
  Gin7Stats,
  Gin7StatKey,
  GIN7_STAT_KEYS,
  StatRollingConfig,
  DEFAULT_STAT_CONFIG,
  POINT_BUY_COST,
  INITIAL_BUY_POINTS,
  Gin7Trait,
  CreateCharacterRequest,
  CreateCharacterResult,
  Gin7Faction,
  NameStyle,
  NameGeneratorConfig
} from '../../types/gin7/character.types';
import { GIN7_TRAITS, getTraitById as getGin7TraitById } from '../../data/gin7/traits';
import seedrandom from 'seedrandom';

/**
 * 정규분포 기반 랜덤 숫자 생성 (Box-Muller 변환)
 * u1, u2가 0이 되지 않도록 보정
 */
function gaussianRandom(rng: () => number, mean: number, stdDev: number): number {
  // u1이 0이면 log(0) = -Infinity 문제 발생, 최소값 보정
  let u1 = rng();
  let u2 = rng();
  
  // 0을 피하기 위해 매우 작은 값으로 보정
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // NaN/Infinity 체크
  if (!Number.isFinite(z0)) {
    return mean; // 안전한 기본값 반환
  }
  
  return z0 * stdDev + mean;
}

/**
 * 숫자를 범위 내로 클램프
 */
function clamp(value: number, min: number, max: number): number {
  // NaN 체크
  if (!Number.isFinite(value)) {
    return Math.round((min + max) / 2); // 중간값 반환
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * 8대 스탯을 정규분포 기반으로 롤링
 * @param seed - 랜덤 시드 (재현성 보장)
 * @param config - 스탯 롤링 설정
 * @returns 8대 스탯 객체
 */
export function rollStats(
  seed?: string,
  config: Partial<StatRollingConfig> = {}
): Gin7Stats {
  const cfg: StatRollingConfig = { ...DEFAULT_STAT_CONFIG, ...config };
  const rng = seedrandom(seed || Date.now().toString());

  // 1단계: 정규분포로 초기 스탯 생성
  const rawStats: Record<Gin7StatKey, number> = {} as Record<Gin7StatKey, number>;
  let total = 0;

  for (const key of GIN7_STAT_KEYS) {
    const value = gaussianRandom(rng, cfg.mean, cfg.stdDev);
    rawStats[key] = clamp(value, cfg.minStat, cfg.maxStat);
    total += rawStats[key];
  }

  // 2단계: 총합 조정 (목표치에 맞춤)
  const stats = adjustToTotal(rawStats, cfg.totalPoints, cfg.minStat, cfg.maxStat, rng);

  return stats;
}

/**
 * 스탯 총합을 목표치에 맞게 조정
 * 한 번에 1씩만 조정하여 자연스러운 분포 유지
 */
function adjustToTotal(
  stats: Record<Gin7StatKey, number>,
  targetTotal: number,
  minStat: number,
  maxStat: number,
  rng: () => number
): Gin7Stats {
  const result = { ...stats } as Gin7Stats;
  let currentTotal = Object.values(result).reduce((a, b) => a + b, 0);
  
  // NaN 체크 - 모든 값이 유효한지 확인
  for (const key of GIN7_STAT_KEYS) {
    if (!Number.isFinite(result[key])) {
      result[key] = Math.round((minStat + maxStat) / 2);
    }
  }
  currentTotal = Object.values(result).reduce((a, b) => a + b, 0);
  
  const maxIterations = 500; // 충분한 반복 횟수
  let iterations = 0;

  while (currentTotal !== targetTotal && iterations < maxIterations) {
    const diff = targetTotal - currentTotal;
    
    // 조정 가능한 스탯들을 찾음
    const adjustableKeys = GIN7_STAT_KEYS.filter(key => {
      if (diff > 0) return result[key] < maxStat; // 증가 가능
      if (diff < 0) return result[key] > minStat; // 감소 가능
      return false;
    });
    
    if (adjustableKeys.length === 0) break; // 더 이상 조정 불가
    
    // 랜덤하게 하나 선택하여 1씩 조정
    const keyIndex = Math.floor(rng() * adjustableKeys.length);
    const key = adjustableKeys[keyIndex];
    
    if (diff > 0) {
      result[key] += 1;
      currentTotal += 1;
    } else {
      result[key] -= 1;
      currentTotal -= 1;
    }
    
    iterations++;
  }

  return result;
}

/**
 * 포인트 구매 방식으로 스탯 계산
 * @param statAllocation - 각 스탯에 할당할 값 (1-10)
 * @returns 유효성 검증 결과와 총 비용
 */
export function calculatePointBuyCost(statAllocation: Partial<Gin7Stats>): {
  valid: boolean;
  totalCost: number;
  remaining: number;
  errors: string[];
} {
  const errors: string[] = [];
  let totalCost = 0;

  for (const key of GIN7_STAT_KEYS) {
    const value = statAllocation[key];
    if (value === undefined) {
      errors.push(`${key} 스탯이 지정되지 않았습니다.`);
      continue;
    }
    if (value < 1 || value > 10) {
      errors.push(`${key} 스탯은 1~10 사이여야 합니다. (현재: ${value})`);
      continue;
    }
    totalCost += POINT_BUY_COST[value];
  }

  const remaining = INITIAL_BUY_POINTS - totalCost;

  return {
    valid: errors.length === 0 && remaining >= 0,
    totalCost,
    remaining,
    errors
  };
}

/**
 * 포인트 구매 방식으로 스탯 생성
 */
export function createStatsByPointBuy(statAllocation: Gin7Stats): {
  success: boolean;
  stats?: Gin7Stats;
  remaining?: number;
  error?: string;
} {
  const result = calculatePointBuyCost(statAllocation);

  if (!result.valid) {
    return {
      success: false,
      error: result.errors.join(', ') || '포인트가 부족합니다.'
    };
  }

  return {
    success: true,
    stats: { ...statAllocation },
    remaining: result.remaining
  };
}

/**
 * 트레잇 획득 확률 롤링
 * @param availableTraits - 획득 가능한 트레잇 목록
 * @param maxTraits - 최대 획득 트레잇 수
 * @param seed - 랜덤 시드
 */
export function rollTraits(
  availableTraits: Gin7Trait[],
  maxTraits: number = 3,
  seed?: string
): Gin7Trait[] {
  const rng = seedrandom(seed || Date.now().toString());
  const acquiredTraits: Gin7Trait[] = [];

  // 희귀도 순으로 정렬 (낮은 확률부터)
  const sortedTraits = [...availableTraits].sort((a, b) => a.rarity - b.rarity);

  for (const trait of sortedTraits) {
    if (acquiredTraits.length >= maxTraits) break;

    // 상충 트레잇 체크
    const hasConflict = trait.conflicts?.some(
      conflictId => acquiredTraits.some(t => t.id === conflictId)
    );
    if (hasConflict) continue;

    // 필수 트레잇 체크
    const meetsRequirements = !trait.requires || trait.requires.every(
      reqId => acquiredTraits.some(t => t.id === reqId)
    );
    if (!meetsRequirements) continue;

    // 확률 롤
    if (rng() < trait.rarity) {
      acquiredTraits.push(trait);
    }
  }

  return acquiredTraits;
}

/**
 * 트레잇 선택 유효성 검증
 */
export function validateTraitSelection(
  selectedTraitIds: string[],
  availablePoints: number
): {
  valid: boolean;
  totalCost: number;
  remaining: number;
  errors: string[];
  traits: Gin7Trait[];
} {
  const errors: string[] = [];
  const traits: Gin7Trait[] = [];
  let totalCost = 0;

  for (const traitId of selectedTraitIds) {
    const trait = getGin7TraitById(traitId);
    if (!trait) {
      errors.push(`알 수 없는 트레잇: ${traitId}`);
      continue;
    }

    // 상충 트레잇 체크
    const hasConflict = trait.conflicts?.some(
      conflictId => traits.some(t => t.id === conflictId)
    );
    if (hasConflict) {
      errors.push(`${trait.nameKo}는 이미 선택한 트레잇과 상충됩니다.`);
      continue;
    }

    traits.push(trait);
    totalCost += trait.pointCost;
  }

  const remaining = availablePoints - totalCost;

  return {
    valid: errors.length === 0 && remaining >= 0,
    totalCost,
    remaining,
    errors,
    traits
  };
}

/**
 * 캐릭터 생성
 */
export function createCharacter(request: CreateCharacterRequest): CreateCharacterResult {
  const { name, faction, method, seed, traitIds } = request;

  // 이름 유효성 검증
  if (!name || name.trim().length < 2) {
    return { success: false, error: '이름은 2자 이상이어야 합니다.' };
  }

  // 스탯 생성
  let stats: Gin7Stats;
  if (method === 'roll') {
    stats = rollStats(seed);
  } else {
    // point_buy는 별도 API에서 처리
    return { success: false, error: '포인트 구매는 별도 API를 사용하세요.' };
  }

  // 트레잇 처리
  let traits: string[] = [];
  let traitPointsUsed = 0;

  if (traitIds && traitIds.length > 0) {
    const validation = validateTraitSelection(traitIds, 10); // 기본 10포인트
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }
    traits = traitIds;
    traitPointsUsed = validation.totalCost;
  } else {
    // 자동 트레잇 롤링
    const rolledTraits = rollTraits(GIN7_TRAITS, 2, seed);
    traits = rolledTraits.map(t => t.id);
    traitPointsUsed = rolledTraits.reduce((sum, t) => sum + t.pointCost, 0);
  }

  const totalStatPoints = Object.values(stats).reduce((a, b) => a + b, 0);

  return {
    success: true,
    character: {
      name: name.trim(),
      faction,
      stats,
      traits,
      totalStatPoints,
      traitPointsUsed
    }
  };
}

/** 이름 생성 데이터 */
const NAME_DATA = {
  imperial: {
    male: {
      first: ['라인하르트', '키르히아이스', '오스카', '볼프강', '프리드리히', 
              '카를', '하인리히', '에르빈', '아달베르트', '빌리발트'],
      last: ['폰 로엔그람', '폰 뮌첼', '폰 리텐하임', '폰 브라운슈바이크', 
             '폰 라이헨바흐', '폰 슈타인메츠', '폰 루프', '폰 클라인겔트']
    },
    female: {
      first: ['안네로제', '힐데가르트', '에바', '마리안네', '도로테아'],
      last: ['폰 그뤼네발트', '폰 마린도르프', '폰 라인하르트']
    }
  },
  alliance: {
    male: {
      first: ['양', '율리안', '더스티', '알렉산드르', '왈터', '올리비에', 
              '에드윈', '드와이트', '윌렘', '바그다슈'],
      last: ['웬리', '민츠', '아텐보로', '뷰코크', '시드니', '포플린', 
             '피셔', '그린힐', '홀랜드']
    },
    female: {
      first: ['프레데리카', '제시카', '카린', '샬롯테'],
      last: ['그린힐', '에드워즈', '휴베릭']
    }
  },
  phezzan: {
    male: {
      first: ['아드리안', '루비', '보리스', '니콜라스'],
      last: ['루빈스키', '콘체', '마르코', '드 빌리에']
    },
    female: {
      first: ['도미니크', '엘리자베스'],
      last: ['산피에르', '마르코']
    }
  }
};

/**
 * 랜덤 이름 생성
 */
export function generateName(config: NameGeneratorConfig, seed?: string): string {
  const rng = seedrandom(seed || Date.now().toString());
  const { style, gender = 'male' } = config;
  
  const data = NAME_DATA[style];
  const genderData = data[gender as 'male' | 'female'] || data.male;
  
  const firstIdx = Math.floor(rng() * genderData.first.length);
  const lastIdx = Math.floor(rng() * genderData.last.length);
  
  return `${genderData.first[firstIdx]} ${genderData.last[lastIdx]}`;
}

/**
 * 스탯 요약 문자열 생성
 */
export function formatStats(stats: Gin7Stats): string {
  return GIN7_STAT_KEYS.map(key => {
    const value = stats[key];
    const bar = '█'.repeat(value) + '░'.repeat(10 - value);
    return `${key.padEnd(12)} [${bar}] ${value}`;
  }).join('\n');
}

/**
 * 스탯 등급 계산
 */
export function getStatGrade(total: number): string {
  if (total >= 70) return 'S';
  if (total >= 65) return 'A';
  if (total >= 58) return 'B';
  if (total >= 50) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

export default {
  rollStats,
  calculatePointBuyCost,
  createStatsByPointBuy,
  rollTraits,
  validateTraitSelection,
  createCharacter,
  generateName,
  formatStats,
  getStatGrade
};

