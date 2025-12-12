/**
 * politics.types.ts
 * 국가 정책 관련 타입 정의
 * 
 * Agent 05 - Gin7 Politics Core
 * - 국가 목표 (National Goal)
 * - 예산 배분 (Budget Allocation)
 * - 세율/관세율 정책 (Tax/Tariff Policy)
 */

// ============================================================
// 국가 목표 (National Goal) 타입
// ============================================================

/**
 * 국가 목표 유형
 * 각 목표는 국가의 전략적 방향을 결정하며, 관련 보너스/페널티를 부여
 */
export type NationalGoalType =
  | 'MILITARY_EXPANSION'      // 군사 확장 - 군사력 +20%, 경제 -5%
  | 'ECONOMIC_GROWTH'         // 경제 성장 - 경제력 +20%, 군사력 -5%
  | 'TERRITORIAL_DEFENSE'     // 영토 방어 - 방어력 +15%, 안정성 +10%
  | 'TECHNOLOGICAL_ADVANCE'   // 기술 발전 - 연구 속도 +20%, 경제 -5%
  | 'DIPLOMATIC_INFLUENCE'    // 외교적 영향력 - 외교 +20%
  | 'INTERNAL_STABILITY'      // 내부 안정 - 안정성 +20%, 경제 +5%
  | 'TRADE_DOMINANCE'         // 무역 지배 - 무역 수입 +25%, 군사력 -10%
  | 'CULTURAL_SUPREMACY';     // 문화 우위 - 지지율 +15%, 외교 +10%

/**
 * 국가 목표 보너스 구조
 */
export interface INationalGoalBonuses {
  military?: number;      // 군사력 보너스 (%)
  economy?: number;       // 경제력 보너스 (%)
  technology?: number;    // 기술력 보너스 (%)
  diplomacy?: number;     // 외교력 보너스 (%)
  stability?: number;     // 안정성 보너스 (%)
  trade?: number;         // 무역 보너스 (%)
  support?: number;       // 지지율 보너스 (%)
}

/**
 * 국가 목표 데이터 구조
 * Faction.data.nationalGoal에 저장
 */
export interface INationalGoal {
  type: NationalGoalType;
  priority: number;           // 우선순위 (1-5)
  description: string;        // 목표 설명
  bonuses: INationalGoalBonuses;
  setBy: string;              // 설정한 캐릭터 ID
  setAt: Date;                // 설정 시점
  expiresAt?: Date;           // 만료 시점 (선택)
  isActive: boolean;
}

/**
 * 국가 목표 정의 상수
 */
export const NATIONAL_GOAL_DEFINITIONS: Record<NationalGoalType, Omit<INationalGoal, 'setBy' | 'setAt' | 'isActive' | 'priority' | 'expiresAt'>> = {
  MILITARY_EXPANSION: {
    type: 'MILITARY_EXPANSION',
    description: '군사 확장',
    bonuses: { military: 20, economy: -5 }
  },
  ECONOMIC_GROWTH: {
    type: 'ECONOMIC_GROWTH',
    description: '경제 성장',
    bonuses: { economy: 20, military: -5 }
  },
  TERRITORIAL_DEFENSE: {
    type: 'TERRITORIAL_DEFENSE',
    description: '영토 방어',
    bonuses: { military: 15, stability: 10 }
  },
  TECHNOLOGICAL_ADVANCE: {
    type: 'TECHNOLOGICAL_ADVANCE',
    description: '기술 발전',
    bonuses: { technology: 20, economy: -5 }
  },
  DIPLOMATIC_INFLUENCE: {
    type: 'DIPLOMATIC_INFLUENCE',
    description: '외교적 영향력',
    bonuses: { diplomacy: 20 }
  },
  INTERNAL_STABILITY: {
    type: 'INTERNAL_STABILITY',
    description: '내부 안정',
    bonuses: { stability: 20, economy: 5 }
  },
  TRADE_DOMINANCE: {
    type: 'TRADE_DOMINANCE',
    description: '무역 지배',
    bonuses: { trade: 25, military: -10 }
  },
  CULTURAL_SUPREMACY: {
    type: 'CULTURAL_SUPREMACY',
    description: '문화 우위',
    bonuses: { support: 15, diplomacy: 10 }
  }
};

// ============================================================
// 예산 배분 (Budget Allocation) 타입
// ============================================================

/**
 * 예산 카테고리 (BudgetService와 호환)
 */
export type BudgetCategoryType =
  | 'defense'           // 국방비 - 함대/군사 유지
  | 'administration'    // 행정비 - 관료/시설 운영
  | 'construction'      // 건설비 - 시설 건설/업그레이드
  | 'research'          // 연구비 - 기술 개발
  | 'welfare'           // 복지비 - 민심 관리
  | 'intelligence'      // 정보비 - 첩보 활동
  | 'diplomacy'         // 외교비 - 외교 활동
  | 'reserve';          // 예비비

/**
 * 예산 배분 비율 구조 (비율 기반, 합계 100%)
 */
export interface IBudgetAllocationRatio {
  defense: number;        // 국방비 비율 (%)
  administration: number; // 행정비 비율 (%)
  construction: number;   // 건설비 비율 (%)
  research: number;       // 연구비 비율 (%)
  welfare: number;        // 복지비 비율 (%)
  intelligence: number;   // 정보비 비율 (%)
  diplomacy: number;      // 외교비 비율 (%)
  reserve: number;        // 예비비 비율 (%)
}

/**
 * 예산 배분 데이터 (Faction.data.budgetAllocation에 저장)
 */
export interface IBudgetAllocationData {
  allocation: IBudgetAllocationRatio;
  allocatedBy: string;    // 배분한 캐릭터 ID
  allocatedAt: Date;      // 배분 시점
  totalBudget: number;    // 총 예산액
}

/**
 * 기본 예산 배분 비율
 */
export const DEFAULT_BUDGET_ALLOCATION: IBudgetAllocationRatio = {
  defense: 30,
  administration: 20,
  construction: 15,
  research: 10,
  welfare: 10,
  intelligence: 5,
  diplomacy: 5,
  reserve: 5
};

// ============================================================
// 세율/관세율 정책 (Tax/Tariff Policy) 타입
// ============================================================

/**
 * 세율 정책 구조 (Faction.data.taxPolicy에 저장)
 */
export interface ITaxPolicyData {
  baseTaxRate: number;        // 기본 세율 (0-100)
  warTaxRate: number;         // 전시 추가세 (0-30)
  luxuryTaxRate: number;      // 사치세 (0-20)
  isEmergencyTax: boolean;    // 비상 과세 여부
  changedBy: string;          // 변경한 캐릭터 ID
  changedAt: Date;            // 변경 시점
}

/**
 * 관세율 정책 구조 (Faction.data.tariffPolicy에 저장)
 */
export interface ITariffPolicyData {
  tariffRate: number;         // 관세율 (0-100)
  changedBy: string;          // 변경한 캐릭터 ID
  changedAt: Date;            // 변경 시점
}

/**
 * 세율 범위 상수
 */
export const TAX_RATE_LIMITS = {
  MIN_TAX_RATE: 0,
  MAX_TAX_RATE: 50,           // 기본 세율 최대 50%
  MAX_WAR_TAX_RATE: 30,       // 전시세 최대 30%
  MAX_LUXURY_TAX_RATE: 20,    // 사치세 최대 20%
  MIN_TARIFF_RATE: 0,
  MAX_TARIFF_RATE: 100        // 관세율 최대 100%
} as const;

// ============================================================
// 권한 검증 관련 타입
// ============================================================

/**
 * 정치 커맨드 권한 타입
 */
export type PoliticsAuthorityType =
  | 'NATIONAL_GOAL'       // 국가 목표 설정 권한
  | 'BUDGET_ALLOCATION'   // 예산 배분 권한
  | 'TAX_CHANGE'          // 세율 변경 권한
  | 'TARIFF_CHANGE';      // 관세율 변경 권한

/**
 * 권한별 필요 직책 매핑
 * GovernmentStructure의 AuthorityType과 연결
 */
export const POLITICS_AUTHORITY_MAP: Record<PoliticsAuthorityType, string[]> = {
  NATIONAL_GOAL: ['all', 'legislation'],              // 황제/의장 또는 입법권자
  BUDGET_ALLOCATION: ['all', 'finance'],              // 황제/의장 또는 재정권자
  TAX_CHANGE: ['all', 'finance'],                     // 황제/의장 또는 재정권자
  TARIFF_CHANGE: ['all', 'finance', 'diplomacy']      // 황제/의장, 재정권자 또는 외교권자
};

/**
 * 권한 검증 결과
 */
export interface IAuthorityCheckResult {
  hasAuthority: boolean;
  reason?: string;
  position?: string;        // 권한을 부여한 직책
}

// ============================================================
// Faction.data 확장 타입
// ============================================================

/**
 * Faction.data에 저장되는 정책 데이터 구조
 * 기존 Faction 모델의 data 필드를 확장
 */
export interface IFactionPolicyData {
  // 국가 목표
  nationalGoal?: INationalGoal;
  
  // 예산 배분
  budgetAllocation?: IBudgetAllocationData;
  
  // 세율 정책
  taxPolicy?: ITaxPolicyData;
  
  // 관세율 정책
  tariffPolicy?: ITariffPolicyData;
  
  // 기타 확장 데이터
  [key: string]: unknown;
}



