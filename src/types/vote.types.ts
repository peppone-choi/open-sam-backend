/**
 * 투표/정치 시스템 타입 정의
 * Agent I: 정치/투표 시스템
 */

// ============================================
// 투표 유형
// ============================================

export enum VoteType {
  /** 일반 설문조사 */
  SURVEY = 'survey',
  /** 탄핵 투표 */
  IMPEACHMENT = 'impeachment',
  /** 군주/수뇌 선출 */
  LEADER_ELECTION = 'election',
  /** 정책 투표 (세율, 비례 등) */
  POLICY = 'policy',
  /** 외교 승인 투표 */
  DIPLOMACY = 'diplomacy',
  /** 천도 투표 */
  CAPITAL_MOVE = 'capital_move',
  /** 국호/국기 변경 */
  NATION_CHANGE = 'nation_change'
}

export enum VoteStatus {
  /** 투표 대기중 */
  PENDING = 'pending',
  /** 투표 진행중 */
  IN_PROGRESS = 'in_progress',
  /** 투표 통과 */
  PASSED = 'passed',
  /** 투표 부결 */
  REJECTED = 'rejected',
  /** 투표 취소됨 */
  CANCELLED = 'cancelled'
}

// ============================================
// 관직 레벨
// ============================================

export enum OfficerLevel {
  /** 재야 */
  NONE = 0,
  /** 일반 장수 */
  NORMAL = 1,
  /** 종사 (도시 관직) */
  JONGSA = 2,
  /** 군사 (도시 관직) */
  GUNSA = 3,
  /** 태수 (도시 관직) */
  TAESU = 4,
  /** 제3모사 (중위 관직) */
  THIRD_ADVISOR = 5,
  /** 제3장군 (중위 관직) */
  THIRD_GENERAL = 6,
  /** 제2모사 (중위 관직) */
  SECOND_ADVISOR = 7,
  /** 제2장군 (고위 관직) */
  SECOND_GENERAL = 8,
  /** 제1모사 (고위 관직) */
  FIRST_ADVISOR = 9,
  /** 제1장군 (고위 관직) */
  FIRST_GENERAL = 10,
  /** 승상/참모 */
  PRIME_MINISTER = 11,
  /** 군주 */
  RULER = 12
}

/**
 * 국가 레벨에 따른 최소 수뇌 레벨
 * PHP getNationChiefLevel() 대응
 */
export const NATION_CHIEF_LEVEL_MAP: Record<number, number> = {
  0: 11, // 유랑 - 거수/부거수만
  1: 11, // 정 - 정후/참모만
  2: 10, // 현 - 현후/승/위부터
  3: 9,  // 군 - 태수/장사/사마부터
  4: 8,  // 주 - 자사/별가/비장부터
  5: 7,  // 주 - 목/치중/편장군부터
  6: 6,  // 공국 - 공/상/대도독부터
  7: 5,  // 왕국 - 왕/상국/대장군부터
  8: 5   // 제국 - 황제/승상/대사마부터
};

/**
 * 국가 레벨에 따라 임명 가능한 최소 관직 레벨 반환
 */
export function getNationChiefLevel(nationLevel: number): number {
  return NATION_CHIEF_LEVEL_MAP[nationLevel] ?? 11;
}

// ============================================
// 관직 비트마스크 유틸리티
// ============================================

/**
 * 관직 비트마스크 생성
 * PHP doOfficerSet() 대응
 */
export function doOfficerSet(currentSet: number, officerLevel: number): number {
  return currentSet | (1 << officerLevel);
}

/**
 * 관직 비트마스크 체크
 * PHP isOfficerSet() 대응
 */
export function isOfficerSet(currentSet: number, officerLevel: number): boolean {
  return (currentSet & (1 << officerLevel)) !== 0;
}

/**
 * 관직 비트마스크 해제
 */
export function clearOfficerSet(currentSet: number, officerLevel: number): number {
  return currentSet & ~(1 << officerLevel);
}

// ============================================
// 투표 인터페이스
// ============================================

export interface VoteInfo {
  id: number;
  title: string;
  type: VoteType;
  status: VoteStatus;
  multipleOptions: number;
  opener: string | null;
  startDate: string;
  endDate: string | null;
  options: string[];
  nationId?: number;
  metadata?: VoteMetadata;
}

export interface VoteMetadata {
  /** 탄핵 대상 장수 ID */
  targetGeneralId?: number;
  /** 선출 후보자 목록 */
  candidates?: CandidateInfo[];
  /** 정책 변경 내용 */
  policyChange?: PolicyChangeInfo;
  /** 외교 관련 정보 */
  diplomacyInfo?: DiplomacyVoteInfo;
  /** 천도 대상 도시 */
  targetCityId?: number;
  /** 투표 통과 조건 (기본 50% 초과) */
  passThreshold?: number;
  /** 투표 필요 정족수 */
  quorum?: number;
}

export interface CandidateInfo {
  generalId: number;
  name: string;
  officerLevel: number;
  strength: number;
  intel: number;
  leadership: number;
}

export interface PolicyChangeInfo {
  type: 'tax_rate' | 'bill' | 'secret_limit' | 'block_war' | 'block_scout' | 'capital_move';
  currentValue: number | boolean;
  newValue: number | boolean;
  newPolicy?: string;         // 새 정책 ID
  newPolicyName?: string;     // 새 정책 이름
  targetCityId?: number;      // 천도 대상 도시 ID
}

export interface DiplomacyVoteInfo {
  targetNationId: number;
  targetNationName: string;
  diplomacyType: 'alliance' | 'non_aggression' | 'war_declaration' | 'peace';
}

// ============================================
// 투표 기록 인터페이스
// ============================================

export interface VoteRecord {
  voteId: number;
  generalId: number;
  nationId: number;
  selection: number[];
  votedAt: string;
}

export interface VoteResult {
  voteId: number;
  totalVoters: number;
  totalVotes?: number;  // Alias for totalVoters (backwards compatibility)
  votesCast: number;
  results: VoteOptionResult[];
  options?: Array<{ votes: number }>;  // Simplified options array
  status: VoteStatus;
  winner?: number;
}

export interface VoteOptionResult {
  optionIndex: number;
  optionText: string;
  voteCount: number;
  percentage: number;
}

// ============================================
// 탄핵 관련 인터페이스
// ============================================

export interface ImpeachmentRequest {
  sessionId: string;
  nationId: number;
  targetGeneralId: number;
  requesterId: number;
  reason: string;
}

export interface ImpeachmentVote extends VoteInfo {
  type: VoteType.IMPEACHMENT;
  metadata: {
    targetGeneralId: number;
    targetName: string;
    reason: string;
    requesterId: number;
    requesterName: string;
    passThreshold: number;
    quorum: number;
  };
}

// ============================================
// 관직 관련 인터페이스
// ============================================

export interface OfficerAppointment {
  sessionId: string;
  nationId: number;
  targetGeneralId: number;
  targetOfficerLevel: OfficerLevel;
  appointerId: number;
  cityId?: number;
}

export interface OfficerDismissal {
  sessionId: string;
  nationId: number;
  targetGeneralId: number;
  dismisserId: number;
  reason?: string;
}

export interface OfficerInfo {
  generalId: number;
  name: string;
  officerLevel: OfficerLevel;
  officerCity: number;
  strength: number;
  intel: number;
  leadership: number;
  npc: number;
}

// ============================================
// 관직명 매핑 (국가 레벨별)
// ============================================

export const OFFICER_TITLE_MAP: Record<number, Record<number, string>> = {
  // 기본 (국가 레벨 무관)
  0: {
    12: '두목',
    11: '부두목',
    4: '태수',
    3: '군사',
    2: '종사',
    1: '일반',
    0: '재야'
  },
  1: {
    12: '영주',
    11: '참모'
  },
  2: {
    12: '방백',
    11: '참모',
    10: '비장군',
    9: '부참모'
  },
  3: {
    12: '주자사',
    11: '주부',
    10: '편장군',
    9: '간의대부'
  },
  4: {
    12: '주목',
    11: '태사령',
    10: '아문장군',
    9: '낭중',
    8: '호군',
    7: '종사중랑'
  },
  5: {
    12: '공',
    11: '광록대부',
    10: '안국장군',
    9: '집금오',
    8: '파로장군',
    7: '소부'
  },
  6: {
    12: '왕',
    11: '광록훈',
    10: '좌장군',
    9: '상서령',
    8: '우장군',
    7: '중서령',
    6: '전장군',
    5: '비서령'
  },
  7: {
    12: '황제',
    11: '승상',
    10: '표기장군',
    9: '사공',
    8: '거기장군',
    7: '태위',
    6: '위장군',
    5: '사도'
  }
};

/**
 * 관직명 반환
 * PHP getOfficerLevelText() 대응
 */
export function getOfficerTitle(officerLevel: number, nationLevel: number = 0): string {
  // 도시 관직 (0-4)은 국가 레벨 무관
  if (officerLevel >= 0 && officerLevel <= 4) {
    return OFFICER_TITLE_MAP[0][officerLevel] ?? '무관';
  }
  
  // 수뇌 관직은 국가 레벨에 따라 다름
  const levelMap = OFFICER_TITLE_MAP[nationLevel] ?? OFFICER_TITLE_MAP[0];
  return levelMap[officerLevel] ?? OFFICER_TITLE_MAP[0][officerLevel] ?? '무관';
}

// ============================================
// 관직별 보너스 정보
// ============================================

export interface OfficerBonus {
  leadershipBonus: number;
  domesticBonus: {
    farming: number;
    commerce: number;
    tech: number;
    security: number;
  };
}

/**
 * 관직 레벨에 따른 통솔 보너스
 * PHP calcLeadershipBonus() 대응
 */
export function calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
  // 기본 보너스 테이블
  const baseBonus: Record<number, number> = {
    12: 15,  // 군주
    11: 10,  // 승상
    10: 8,   // 제1장군
    9: 8,    // 제1모사
    8: 6,    // 제2장군
    7: 6,    // 제2모사
    6: 4,    // 제3장군
    5: 4,    // 제3모사
    4: 3,    // 태수
    3: 2,    // 군사
    2: 1,    // 종사
    1: 0,    // 일반
    0: 0     // 재야
  };
  
  const bonus = baseBonus[officerLevel] ?? 0;
  
  // 국가 레벨에 따른 추가 보너스 (왕국 이상)
  if (nationLevel >= 6 && officerLevel >= 5) {
    return bonus + Math.floor(nationLevel / 2);
  }
  
  return bonus;
}

// ============================================
// 수뇌 능력치 요구사항
// ============================================

/** 수뇌 임명에 필요한 최소 능력치 (기본값) */
export const CHIEF_STAT_MIN = 70;

/**
 * 관직별 능력치 요구사항 체크
 * @param officerLevel 목표 관직 레벨
 * @param strength 무력
 * @param intel 지력
 * @param chiefStatMin 최소 능력치 (기본 70)
 */
export function checkOfficerStatRequirement(
  officerLevel: number,
  strength: number,
  intel: number,
  chiefStatMin: number = CHIEF_STAT_MIN
): { valid: boolean; reason?: string } {
  // 승상(11)은 능력치 요구 없음
  if (officerLevel === 11) {
    return { valid: true };
  }
  
  // 짝수 레벨(장군 계열)은 무력 요구
  if (officerLevel % 2 === 0 && officerLevel >= 6) {
    if (strength < chiefStatMin) {
      return { valid: false, reason: '무력이 부족합니다.' };
    }
  }
  
  // 홀수 레벨(모사 계열)은 지력 요구
  if (officerLevel % 2 === 1 && officerLevel >= 5) {
    if (intel < chiefStatMin) {
      return { valid: false, reason: '지력이 부족합니다.' };
    }
  }
  
  // 도시 태수(4)는 무력 요구
  if (officerLevel === 4) {
    if (strength < chiefStatMin) {
      return { valid: false, reason: '무력이 부족합니다.' };
    }
  }
  
  // 도시 군사(3)는 지력 요구
  if (officerLevel === 3) {
    if (intel < chiefStatMin) {
      return { valid: false, reason: '지력이 부족합니다.' };
    }
  }
  
  return { valid: true };
}


