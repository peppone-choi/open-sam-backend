/**
 * Gin7 Nobility Types
 * 은하영웅전설 작위 및 봉토 시스템 타입 정의
 */

/**
 * 작위 등급 (제국 전용)
 * 제국에서만 작위를 수여할 수 있음
 */
export type NobilityRank = 
  | 'knight'    // 기사 (騎士) - 작위 없는 귀족
  | 'baron'     // 남작 (男爵) - Baron
  | 'viscount'  // 자작 (子爵) - Viscount
  | 'count'     // 백작 (伯爵) - Count
  | 'marquis'   // 후작 (侯爵) - Marquis
  | 'duke';     // 공작 (公爵) - Duke

/**
 * 작위 정보
 */
export interface NobilityTitle {
  rank: NobilityRank;
  name: string;          // 표시 이름 (한국어)
  nameEn: string;        // 영문 이름
  minMerit: number;      // 필요 최소 공적
  taxRate: number;       // 봉토 세금 수입 비율 (0.0 ~ 1.0)
  maxFiefs: number;      // 최대 봉토 수
}

/**
 * 작위 등급 상세 정보
 */
export const NOBILITY_RANKS: Record<NobilityRank, NobilityTitle> = {
  knight: {
    rank: 'knight',
    name: '기사',
    nameEn: 'Knight',
    minMerit: 100,
    taxRate: 0.0,
    maxFiefs: 0,
  },
  baron: {
    rank: 'baron',
    name: '남작',
    nameEn: 'Baron',
    minMerit: 500,
    taxRate: 0.05,
    maxFiefs: 1,
  },
  viscount: {
    rank: 'viscount',
    name: '자작',
    nameEn: 'Viscount',
    minMerit: 1500,
    taxRate: 0.08,
    maxFiefs: 2,
  },
  count: {
    rank: 'count',
    name: '백작',
    nameEn: 'Count',
    minMerit: 4000,
    taxRate: 0.10,
    maxFiefs: 3,
  },
  marquis: {
    rank: 'marquis',
    name: '후작',
    nameEn: 'Marquis',
    minMerit: 10000,
    taxRate: 0.12,
    maxFiefs: 5,
  },
  duke: {
    rank: 'duke',
    name: '공작',
    nameEn: 'Duke',
    minMerit: 25000,
    taxRate: 0.15,
    maxFiefs: 10,
  },
};

/**
 * 작위 등급 순서 (승작 순서)
 */
export const NOBILITY_RANK_ORDER: NobilityRank[] = [
  'knight',
  'baron',
  'viscount',
  'count',
  'marquis',
  'duke',
];

/**
 * 봉토 (영지) 정보
 */
export interface Fief {
  planetId: string;      // 봉토 행성 ID
  planetName: string;    // 봉토 행성 이름
  grantedAt: Date;       // 수여 일자
  annualIncome: number;  // 연간 세금 수입
}

/**
 * 캐릭터 귀족 정보
 */
export interface CharacterNobility {
  rank: NobilityRank | null;          // 현재 작위 (null = 평민)
  fiefs: Fief[];                      // 보유 봉토 목록
  ennobbledAt?: Date;                 // 서작 일자
  lastPromotedAt?: Date;              // 마지막 승작 일자
  totalTaxIncome: number;             // 누적 세금 수입
}

/**
 * 작위 수여 (서작) 요청
 */
export interface EnnobleRequest {
  targetCommanderNo: number;          // 대상 커맨더 번호
  newRank: NobilityRank;              // 수여할 작위
}

/**
 * 작위 수여 결과
 */
export interface EnnobleResult {
  success: boolean;
  message: string;
  previousRank?: NobilityRank | null;
  newRank?: NobilityRank;
}

/**
 * 봉토 수여 요청
 */
export interface GrantFiefRequest {
  targetCommanderNo: number;          // 대상 커맨더 번호
  planetId: string;                   // 봉토로 수여할 행성 ID
}

/**
 * 봉토 수여 결과
 */
export interface GrantFiefResult {
  success: boolean;
  message: string;
  fief?: Fief;
}

/**
 * 유산 상속 정보
 */
export interface LegacyInheritance {
  previousCharacterId: string;        // 이전 캐릭터 ID
  previousCharacterName: string;      // 이전 캐릭터 이름
  inheritedWealth: number;            // 상속된 재산
  inheritedFame: number;              // 상속된 명성
  karma: number;                      // Karma 포인트 (스탯 보너스용)
  inheritedAt: Date;                  // 상속 일자
}

/**
 * Karma (업보) 시스템
 * 전생의 명성/공적에 따른 차기 캐릭터 보너스
 */
export interface KarmaBonus {
  statBonuses: Partial<Record<string, number>>;  // 스탯 보너스
  traitUnlocks: string[];                        // 해금 트레잇
  startingWealth: number;                        // 시작 재산 보너스
  reputationBonus: number;                       // 명성 보너스
}

/**
 * Karma 등급 계산
 */
export type KarmaGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS';

/**
 * Karma 등급별 보너스 테이블
 */
export const KARMA_GRADE_THRESHOLDS: Record<KarmaGrade, { minPoints: number; bonus: KarmaBonus }> = {
  F: {
    minPoints: 0,
    bonus: {
      statBonuses: {},
      traitUnlocks: [],
      startingWealth: 0,
      reputationBonus: 0,
    },
  },
  E: {
    minPoints: 100,
    bonus: {
      statBonuses: {},
      traitUnlocks: [],
      startingWealth: 1000,
      reputationBonus: 5,
    },
  },
  D: {
    minPoints: 500,
    bonus: {
      statBonuses: {},
      traitUnlocks: ['veteran'],
      startingWealth: 5000,
      reputationBonus: 10,
    },
  },
  C: {
    minPoints: 2000,
    bonus: {
      statBonuses: { leadership: 1 },
      traitUnlocks: ['veteran', 'experienced'],
      startingWealth: 15000,
      reputationBonus: 25,
    },
  },
  B: {
    minPoints: 5000,
    bonus: {
      statBonuses: { leadership: 1, command: 1 },
      traitUnlocks: ['veteran', 'experienced', 'tactician'],
      startingWealth: 50000,
      reputationBonus: 50,
    },
  },
  A: {
    minPoints: 15000,
    bonus: {
      statBonuses: { leadership: 2, command: 1, intelligence: 1 },
      traitUnlocks: ['veteran', 'experienced', 'tactician', 'strategist'],
      startingWealth: 150000,
      reputationBonus: 100,
    },
  },
  S: {
    minPoints: 50000,
    bonus: {
      statBonuses: { leadership: 2, command: 2, intelligence: 1, operation: 1 },
      traitUnlocks: ['veteran', 'experienced', 'tactician', 'strategist', 'genius'],
      startingWealth: 500000,
      reputationBonus: 200,
    },
  },
  SS: {
    minPoints: 150000,
    bonus: {
      statBonuses: { leadership: 3, command: 2, intelligence: 2, operation: 1, piloting: 1 },
      traitUnlocks: ['veteran', 'experienced', 'tactician', 'strategist', 'genius', 'legendary'],
      startingWealth: 1500000,
      reputationBonus: 500,
    },
  },
};

/**
 * Karma 등급 계산 함수
 */
export function calculateKarmaGrade(karmaPoints: number): KarmaGrade {
  const grades: KarmaGrade[] = ['SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
  
  for (const grade of grades) {
    if (karmaPoints >= KARMA_GRADE_THRESHOLDS[grade].minPoints) {
      return grade;
    }
  }
  
  return 'F';
}

/**
 * 작위 승작 가능 여부 확인
 */
export function canPromoteNobility(
  currentRank: NobilityRank | null,
  targetRank: NobilityRank,
  merit: number
): { canPromote: boolean; reason?: string } {
  const targetInfo = NOBILITY_RANKS[targetRank];
  
  // 공적 체크
  if (merit < targetInfo.minMerit) {
    return {
      canPromote: false,
      reason: `공적이 부족합니다. (필요: ${targetInfo.minMerit}, 현재: ${merit})`,
    };
  }
  
  // 승작 순서 체크
  if (currentRank) {
    const currentIndex = NOBILITY_RANK_ORDER.indexOf(currentRank);
    const targetIndex = NOBILITY_RANK_ORDER.indexOf(targetRank);
    
    if (targetIndex <= currentIndex) {
      return {
        canPromote: false,
        reason: '현재 작위보다 높은 작위만 수여할 수 있습니다.',
      };
    }
    
    // 한 단계씩만 승작 가능
    if (targetIndex > currentIndex + 1) {
      const nextRank = NOBILITY_RANK_ORDER[currentIndex + 1];
      return {
        canPromote: false,
        reason: `한 단계씩만 승작할 수 있습니다. 다음 단계: ${NOBILITY_RANKS[nextRank].name}`,
      };
    }
  } else {
    // 평민은 기사부터 시작
    if (targetRank !== 'knight') {
      return {
        canPromote: false,
        reason: '평민은 기사부터 시작해야 합니다.',
      };
    }
  }
  
  return { canPromote: true };
}

/**
 * 봉토 수여 가능 여부 확인
 */
export function canGrantFief(
  nobility: CharacterNobility | null
): { canGrant: boolean; reason?: string } {
  if (!nobility || !nobility.rank) {
    return {
      canGrant: false,
      reason: '작위가 없는 인물에게는 봉토를 수여할 수 없습니다.',
    };
  }
  
  const rankInfo = NOBILITY_RANKS[nobility.rank];
  
  if (rankInfo.maxFiefs === 0) {
    return {
      canGrant: false,
      reason: `${rankInfo.name}에게는 봉토를 수여할 수 없습니다.`,
    };
  }
  
  if (nobility.fiefs.length >= rankInfo.maxFiefs) {
    return {
      canGrant: false,
      reason: `최대 봉토 수에 도달했습니다. (${rankInfo.name}: 최대 ${rankInfo.maxFiefs}개)`,
    };
  }
  
  return { canGrant: true };
}

/**
 * Karma 포인트 계산
 * 명성 + 공적 + 봉토 가치 기반
 */
export function calculateKarmaPoints(
  fame: number,
  merit: number,
  nobility: CharacterNobility | null
): number {
  let karmaPoints = fame + merit;
  
  if (nobility) {
    // 작위 보너스
    if (nobility.rank) {
      const rankIndex = NOBILITY_RANK_ORDER.indexOf(nobility.rank);
      karmaPoints += rankIndex * 1000;
    }
    
    // 봉토 보너스
    karmaPoints += nobility.totalTaxIncome * 0.1;
  }
  
  return Math.floor(karmaPoints);
}














