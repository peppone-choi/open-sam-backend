/**
 * GIN7 Rank Configuration
 * 
 * 계급 시스템 설정 - 은하영웅전설 스타일
 * 군사 계급 체계와 T.O(정원), 권한 레벨 정의
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

// ============================================================================
// Rank Definitions
// ============================================================================

export enum RankCode {
  // 사병 (Enlisted)
  PRIVATE_2ND = 'E1',        // 이등병
  PRIVATE_1ST = 'E2',        // 일등병
  CORPORAL = 'E3',           // 상등병
  SERGEANT = 'E4',           // 병장
  
  // 부사관 (Non-Commissioned Officers)
  STAFF_SERGEANT = 'N1',     // 하사
  SERGEANT_1ST = 'N2',       // 중사
  MASTER_SERGEANT = 'N3',    // 상사
  SERGEANT_MAJOR = 'N4',     // 원사
  
  // 위관 (Company Grade Officers)
  SECOND_LIEUTENANT = 'O1',  // 소위
  FIRST_LIEUTENANT = 'O2',   // 중위
  CAPTAIN = 'O3',            // 대위
  
  // 영관 (Field Grade Officers)
  MAJOR = 'O4',              // 소령
  LIEUTENANT_COLONEL = 'O5', // 중령
  COLONEL = 'O6',            // 대령
  
  // 장관 (General Officers) - 수동 승진
  BRIGADIER_GENERAL = 'G1',  // 준장
  MAJOR_GENERAL = 'G2',      // 소장
  LIEUTENANT_GENERAL = 'G3', // 중장
  GENERAL = 'G4',            // 대장
  FLEET_ADMIRAL = 'G5',      // 원수
}

export interface RankDefinition {
  code: RankCode;
  name: string;
  nameEn: string;
  tier: number;              // 계급 순위 (1=이등병, 19=원수)
  category: 'enlisted' | 'nco' | 'officer' | 'general';
  baseTO: number;            // 기본 정원 (세션 설정으로 배율 조정)
  autoPromotion: boolean;    // 자동 승진 가능 여부 (장관급 이상 false)
  salaryMultiplier: number;  // 녹봉 배수
  authorityLevel: number;    // 권한 레벨 (1-12)
  meritForPromotion: number; // 승진 필요 공적치
  minServiceMonths: number;  // 최소 복무 기간 (게임 월)
}

export const RANK_TABLE: Record<RankCode, RankDefinition> = {
  // 사병 (Enlisted) - 기본 자동 승진
  [RankCode.PRIVATE_2ND]: {
    code: RankCode.PRIVATE_2ND,
    name: '이등병',
    nameEn: 'Private 2nd Class',
    tier: 1,
    category: 'enlisted',
    baseTO: -1, // 무제한
    autoPromotion: true,
    salaryMultiplier: 1.0,
    authorityLevel: 1,
    meritForPromotion: 100,
    minServiceMonths: 1,
  },
  [RankCode.PRIVATE_1ST]: {
    code: RankCode.PRIVATE_1ST,
    name: '일등병',
    nameEn: 'Private 1st Class',
    tier: 2,
    category: 'enlisted',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 1.1,
    authorityLevel: 1,
    meritForPromotion: 200,
    minServiceMonths: 2,
  },
  [RankCode.CORPORAL]: {
    code: RankCode.CORPORAL,
    name: '상등병',
    nameEn: 'Corporal',
    tier: 3,
    category: 'enlisted',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 1.2,
    authorityLevel: 1,
    meritForPromotion: 400,
    minServiceMonths: 3,
  },
  [RankCode.SERGEANT]: {
    code: RankCode.SERGEANT,
    name: '병장',
    nameEn: 'Sergeant',
    tier: 4,
    category: 'enlisted',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 1.3,
    authorityLevel: 2,
    meritForPromotion: 800,
    minServiceMonths: 4,
  },
  
  // 부사관 (NCO)
  [RankCode.STAFF_SERGEANT]: {
    code: RankCode.STAFF_SERGEANT,
    name: '하사',
    nameEn: 'Staff Sergeant',
    tier: 5,
    category: 'nco',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 1.5,
    authorityLevel: 3,
    meritForPromotion: 1500,
    minServiceMonths: 6,
  },
  [RankCode.SERGEANT_1ST]: {
    code: RankCode.SERGEANT_1ST,
    name: '중사',
    nameEn: 'Sergeant First Class',
    tier: 6,
    category: 'nco',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 1.7,
    authorityLevel: 4,
    meritForPromotion: 2500,
    minServiceMonths: 8,
  },
  [RankCode.MASTER_SERGEANT]: {
    code: RankCode.MASTER_SERGEANT,
    name: '상사',
    nameEn: 'Master Sergeant',
    tier: 7,
    category: 'nco',
    baseTO: -1,
    autoPromotion: true,
    salaryMultiplier: 2.0,
    authorityLevel: 5,
    meritForPromotion: 4000,
    minServiceMonths: 12,
  },
  [RankCode.SERGEANT_MAJOR]: {
    code: RankCode.SERGEANT_MAJOR,
    name: '원사',
    nameEn: 'Sergeant Major',
    tier: 8,
    category: 'nco',
    baseTO: 100,
    autoPromotion: true,
    salaryMultiplier: 2.5,
    authorityLevel: 6,
    meritForPromotion: 6000,
    minServiceMonths: 18,
  },
  
  // 위관 (Company Grade)
  [RankCode.SECOND_LIEUTENANT]: {
    code: RankCode.SECOND_LIEUTENANT,
    name: '소위',
    nameEn: 'Second Lieutenant',
    tier: 9,
    category: 'officer',
    baseTO: 200,
    autoPromotion: true,
    salaryMultiplier: 3.0,
    authorityLevel: 7,
    meritForPromotion: 10000,
    minServiceMonths: 24,
  },
  [RankCode.FIRST_LIEUTENANT]: {
    code: RankCode.FIRST_LIEUTENANT,
    name: '중위',
    nameEn: 'First Lieutenant',
    tier: 10,
    category: 'officer',
    baseTO: 150,
    autoPromotion: true,
    salaryMultiplier: 3.5,
    authorityLevel: 7,
    meritForPromotion: 15000,
    minServiceMonths: 30,
  },
  [RankCode.CAPTAIN]: {
    code: RankCode.CAPTAIN,
    name: '대위',
    nameEn: 'Captain',
    tier: 11,
    category: 'officer',
    baseTO: 100,
    autoPromotion: true,
    salaryMultiplier: 4.0,
    authorityLevel: 8,
    meritForPromotion: 25000,
    minServiceMonths: 36,
  },
  
  // 영관 (Field Grade)
  [RankCode.MAJOR]: {
    code: RankCode.MAJOR,
    name: '소령',
    nameEn: 'Major',
    tier: 12,
    category: 'officer',
    baseTO: 50,
    autoPromotion: true,
    salaryMultiplier: 5.0,
    authorityLevel: 9,
    meritForPromotion: 40000,
    minServiceMonths: 48,
  },
  [RankCode.LIEUTENANT_COLONEL]: {
    code: RankCode.LIEUTENANT_COLONEL,
    name: '중령',
    nameEn: 'Lieutenant Colonel',
    tier: 13,
    category: 'officer',
    baseTO: 30,
    autoPromotion: true,
    salaryMultiplier: 6.0,
    authorityLevel: 9,
    meritForPromotion: 60000,
    minServiceMonths: 60,
  },
  [RankCode.COLONEL]: {
    code: RankCode.COLONEL,
    name: '대령',
    nameEn: 'Colonel',
    tier: 14,
    category: 'officer',
    baseTO: 20,
    autoPromotion: true, // 대령까지 자동 승진
    salaryMultiplier: 7.0,
    authorityLevel: 10,
    meritForPromotion: 100000,
    minServiceMonths: 72,
  },
  
  // 장관 (General Officers) - 수동 승진만 가능
  [RankCode.BRIGADIER_GENERAL]: {
    code: RankCode.BRIGADIER_GENERAL,
    name: '준장',
    nameEn: 'Brigadier General',
    tier: 15,
    category: 'general',
    baseTO: 10,
    autoPromotion: false,
    salaryMultiplier: 10.0,
    authorityLevel: 11,
    meritForPromotion: 200000,
    minServiceMonths: 84,
  },
  [RankCode.MAJOR_GENERAL]: {
    code: RankCode.MAJOR_GENERAL,
    name: '소장',
    nameEn: 'Major General',
    tier: 16,
    category: 'general',
    baseTO: 6,
    autoPromotion: false,
    salaryMultiplier: 12.0,
    authorityLevel: 11,
    meritForPromotion: 350000,
    minServiceMonths: 96,
  },
  [RankCode.LIEUTENANT_GENERAL]: {
    code: RankCode.LIEUTENANT_GENERAL,
    name: '중장',
    nameEn: 'Lieutenant General',
    tier: 17,
    category: 'general',
    baseTO: 4,
    autoPromotion: false,
    salaryMultiplier: 15.0,
    authorityLevel: 11,
    meritForPromotion: 500000,
    minServiceMonths: 120,
  },
  [RankCode.GENERAL]: {
    code: RankCode.GENERAL,
    name: '대장',
    nameEn: 'General',
    tier: 18,
    category: 'general',
    baseTO: 2,
    autoPromotion: false,
    salaryMultiplier: 20.0,
    authorityLevel: 12,
    meritForPromotion: 800000,
    minServiceMonths: 144,
  },
  [RankCode.FLEET_ADMIRAL]: {
    code: RankCode.FLEET_ADMIRAL,
    name: '원수',
    nameEn: 'Fleet Admiral',
    tier: 19,
    category: 'general',
    baseTO: 1,
    autoPromotion: false,
    salaryMultiplier: 30.0,
    authorityLevel: 12,
    meritForPromotion: -1, // 최고 계급
    minServiceMonths: 180,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 계급 코드로 정의 조회
 */
export function getRankDefinition(code: RankCode): RankDefinition {
  return RANK_TABLE[code];
}

/**
 * 계급 티어로 코드 조회
 */
export function getRankByTier(tier: number): RankDefinition | null {
  const entry = Object.values(RANK_TABLE).find(r => r.tier === tier);
  return entry || null;
}

/**
 * 다음 계급 조회
 */
export function getNextRank(currentCode: RankCode): RankDefinition | null {
  const current = RANK_TABLE[currentCode];
  if (!current) return null;
  return getRankByTier(current.tier + 1);
}

/**
 * 이전 계급 조회
 */
export function getPreviousRank(currentCode: RankCode): RankDefinition | null {
  const current = RANK_TABLE[currentCode];
  if (!current) return null;
  return getRankByTier(current.tier - 1);
}

/**
 * 자동 승진 가능한 계급 목록
 */
export function getAutoPromotableRanks(): RankDefinition[] {
  return Object.values(RANK_TABLE).filter(r => r.autoPromotion);
}

/**
 * 카테고리별 계급 목록
 */
export function getRanksByCategory(category: RankDefinition['category']): RankDefinition[] {
  return Object.values(RANK_TABLE).filter(r => r.category === category);
}

/**
 * 모든 계급 목록 (티어 순)
 */
export function getAllRanks(): RankDefinition[] {
  return Object.values(RANK_TABLE).sort((a, b) => a.tier - b.tier);
}

/**
 * 계급 비교 (a가 b보다 높으면 양수, 낮으면 음수)
 */
export function compareRanks(a: RankCode, b: RankCode): number {
  return RANK_TABLE[a].tier - RANK_TABLE[b].tier;
}

/**
 * 권한 레벨 체크
 */
export function hasAuthorityLevel(rank: RankCode, requiredLevel: number): boolean {
  return RANK_TABLE[rank].authorityLevel >= requiredLevel;
}

