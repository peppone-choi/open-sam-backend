/**
 * LOGH 계급 시스템
 * 은하영웅전설의 계급 및 직책 관리
 */

/**
 * 제국 계급 목록 (하위 → 상위)
 */
export const EMPIRE_RANKS = [
  '이등병',     // 0: Private 2nd Class
  '일등병',     // 1: Private 1st Class
  '상등병',     // 2: Private Superior
  '병장',       // 3: Corporal
  '하사',       // 4: Sergeant
  '중사',       // 5: Staff Sergeant
  '상사',       // 6: Master Sergeant
  '준위',       // 7: Warrant Officer
  '소위',       // 8: Ensign
  '중위',       // 9: Lieutenant
  '대위',       // 10: Lieutenant Commander
  '소좌',       // 11: Commander (少佐)
  '중좌',       // 12: Captain (中佐)
  '대좌',       // 13: Captain (大佐)
  '准将',       // 14: Commodore
  '少将',       // 15: Rear Admiral
  '中将',       // 16: Vice Admiral
  '大将',       // 17: Admiral
  '上級大将',   // 18: Senior Admiral
  '元帥',       // 19: Grand Admiral
];

/**
 * 동맹 계급 목록 (하위 → 상위)
 * 동맹은 상급대장이 없음 (대장 -> 원수)
 */
export const ALLIANCE_RANKS = [
  '이등병',     // 0: Private 2nd Class
  '일등병',     // 1: Private 1st Class
  '상등병',     // 2: Private Superior
  '병장',       // 3: Corporal
  '하사',       // 4: Sergeant
  '중사',       // 5: Staff Sergeant
  '상사',       // 6: Master Sergeant
  '준위',       // 7: Warrant Officer
  '소위',       // 8: Ensign
  '중위',       // 9: Lieutenant
  '대위',       // 10: Lieutenant Commander
  '소좌',       // 11: Commander (少佐)
  '중좌',       // 12: Captain (中佐)
  '대좌',       // 13: Captain (大佐)
  '准将',       // 14: Commodore
  '少将',       // 15: Rear Admiral
  '中将',       // 16: Vice Admiral
  '大将',       // 17: Admiral  
  '元帥',       // 18: Grand Admiral
];    

/**
 * 계급별 필요 공적 포인트 (제국)
 */
export const EMPIRE_REQUIREMENTS: Record<number, number> = {
  0: 0,       // 이등병
  1: 100,     // 일등병
  2: 300,     // 상등병
  3: 600,     // 병장
  4: 1000,    // 하사
  5: 1500,    // 중사
  6: 2100,    // 상사
  7: 2800,    // 준위
  8: 3600,    // 소위
  9: 4500,    // 중위
  10: 5500,   // 대위
  11: 6600,   // 소좌
  12: 8000,   // 중좌
  13: 10000,  // 대좌
  14: 13000,  // 准将
  15: 17000,  // 少将
  16: 22000,  // 中将
  17: 28000,  // 大将
  18: 35000,  // 上級大将
  19: 45000,  // 元帥
};

/**
 * 계급별 필요 공적 포인트 (동맹)
 * 상급대장이 없으므로 원수 요구치가 당겨지거나 조정됨
 */
export const ALLIANCE_REQUIREMENTS: Record<number, number> = {
  0: 0,       // 이등병
  1: 100,     // 일등병
  2: 300,     // 상등병
  3: 600,     // 병장
  4: 1000,    // 하사
  5: 1500,    // 중사
  6: 2100,    // 상사
  7: 2800,    // 준위
  8: 3600,    // 소위
  9: 4500,    // 중위
  10: 5500,   // 대위
  11: 6600,   // 소좌
  12: 8000,   // 중좌
  13: 10000,  // 대좌
  14: 13000,  // 准将
  15: 17000,  // 少将
  16: 22000,  // 中将
  17: 28000,  // 大将
  18: 40000,  // 元帥 (제국 원수보다는 낮지만 상급대장보다는 높게 설정)
};

/**
 * 계급별 인원 제한 (메뉴얼 1671행)
 */
export const RANK_LIMITS: Record<string, Record<number, number>> = {
  empire: {
    19: 5,  // 元帥
    18: 5,  // 上級大将
    17: 10, // 大将
    16: 20, // 中将
    15: 40, // 少将
    14: 80, // 准将
  },
  alliance: {
    18: 5,  // 元帥
    17: 10, // 大将
    16: 20, // 中将
    15: 40, // 少将
    14: 80, // 准将
  }
};

/**
 * 직책 목록
 */
export const POSITIONS = {
  // 군사 직책
  FLEET_COMMANDER: '함대사령관',
  VICE_COMMANDER: '부사령관',
  CHIEF_OF_STAFF: '참모장',
  OPERATIONS_OFFICER: '작전참모',
  INTELLIGENCE_OFFICER: '정보참모',
  LOGISTICS_OFFICER: '보급참모',
  
  // 행정 직책
  PRIME_MINISTER: '수상',
  DEFENSE_MINISTER: '국방장관',
  FINANCE_MINISTER: '재무장관',
  FOREIGN_MINISTER: '외무장관',
  
  // 특수 직책
  SUPREME_COMMANDER: '최고사령관',
  INSPECTOR_GENERAL: '감찰관',
};

/**
 * 계급 인덱스 조회
 * @param rank 계급명 또는 계급 인덱스
 * @param faction 세력 ('empire' | 'alliance')
 * @returns 계급 인덱스
 */
export function getRankIndex(rank: string | number, faction: 'empire' | 'alliance'): number {
  // 이미 숫자면 그대로 반환
  if (typeof rank === 'number') {
    return rank;
  }
  const ranks = faction === 'empire' ? EMPIRE_RANKS : ALLIANCE_RANKS;
  const index = ranks.indexOf(rank);
  return index >= 0 ? index : 0;
}

/**
 * 계급명 조회
 * @param rankIndex 계급 인덱스
 * @param faction 세력 ('empire' | 'alliance')
 * @returns 계급명
 */
export function getRankName(rankIndex: number, faction: 'empire' | 'alliance'): string {
  const ranks = faction === 'empire' ? EMPIRE_RANKS : ALLIANCE_RANKS;
  return ranks[rankIndex] || ranks[0];
}

/**
 * 승진 가능 여부 확인
 * @param currentRank 현재 계급명
 * @param achievements 공적 포인트
 * @param faction 세력
 * @param currentRankCount 해당 계급의 현재 인원 수 (상위 계급 승진 시 필요)
 * @returns 승진 가능 여부
 */
export function canPromote(
  currentRank: string,
  achievements: number,
  faction: 'empire' | 'alliance',
  currentRankCount: number = 0
): boolean {
  const currentIndex = getRankIndex(currentRank, faction);
  const nextIndex = currentIndex + 1;
  const maxIndex = faction === 'empire' ? 19 : 18;
  
  // 이미 최고 계급이면 승진 불가
  if (currentIndex >= maxIndex) {
    return false;
  }
  
  // 다음 계급에 필요한 공적 확인
  const requirements = faction === 'empire' ? EMPIRE_REQUIREMENTS : ALLIANCE_REQUIREMENTS;
  const requiredAchievements = requirements[nextIndex] || 999999;
  
  if (achievements < requiredAchievements) {
    return false;
  }

  // 상위 계급 인원 제한 체크 (대좌(13) 이상 승진 시 적용)
  if (nextIndex >= 14) {
    const limit = RANK_LIMITS[faction][nextIndex];
    if (limit && currentRankCount >= limit) {
      return false;
    }
  }

  return true;
}

/**
 * 자동 승진 여부 확인 (대령 이하)
 * 메뉴얼 1656행: 대령 이하 자동 승진
 * @param currentRank 현재 계급
 * @param faction 세력
 * @param achievements 공적 포인트
 * @param isFirstInLadder 해당 계급 래더 1위 여부
 */
export function checkAutomaticPromotion(
  currentRank: string,
  faction: 'empire' | 'alliance',
  achievements: number,
  isFirstInLadder: boolean
): boolean {
  const currentIndex = getRankIndex(currentRank, faction);
  
  // 대령(13) 이하만 자동 승진 대상
  if (currentIndex > 13) return false;
  
  // 래더 1위이면서 필요 공적을 만족해야 함
  if (!isFirstInLadder) return false;
  
  const requirements = faction === 'empire' ? EMPIRE_REQUIREMENTS : ALLIANCE_REQUIREMENTS;
  const requiredAchievements = requirements[currentIndex + 1] || 999999;
  return achievements >= requiredAchievements;
}

/**
 * 승진 실행
 * @param currentRank 현재 계급명
 * @param faction 세력
 * @returns 새로운 계급명
 */
export function promote(currentRank: string, faction: 'empire' | 'alliance'): string {
  const currentIndex = getRankIndex(currentRank, faction);
  const maxIndex = faction === 'empire' ? 19 : 18;
  
  // 최고 계급이면 그대로 반환
  if (currentIndex >= maxIndex) {
    return currentRank;
  }
  
  return getRankName(currentIndex + 1, faction);
}

/**
 * 강등 실행
 * @param currentRank 현재 계급명
 * @param faction 세력
 * @param levels 강등할 계급 수 (기본 1)
 * @returns 새로운 계급명
 */
export function demote(
  currentRank: string,
  faction: 'empire' | 'alliance',
  levels: number = 1
): string {
  const currentIndex = getRankIndex(currentRank, faction);
  
  // 최하위 계급이면 그대로 반환
  if (currentIndex <= 0) {
    return currentRank;
  }
  
  const newIndex = Math.max(0, currentIndex - levels);
  return getRankName(newIndex, faction);
}

/**
 * 계급별 기본 커맨드 포인트 조회 (초기값)
 * @param rank 계급명
 * @param faction 세력
 * @returns 기본 CP
 */
export function getBaseCommandPoints(rank: string, faction: 'empire' | 'alliance'): number {
  const rankIndex = getRankIndex(rank, faction);
  
  if (faction === 'empire') {
    // 제국군 (총 20단계)
    if (rankIndex >= 19) return 20; // 元帥
    if (rankIndex >= 18) return 18; // 上級大将
    if (rankIndex >= 17) return 18; // 大将
    if (rankIndex >= 16) return 15; // 中将
    if (rankIndex >= 15) return 12; // 少将
    if (rankIndex >= 14) return 10; // 准将
  } else {
    // 동맹군 (총 19단계)
    if (rankIndex >= 18) return 20; // 元帥
    if (rankIndex >= 17) return 18; // 大将
    if (rankIndex >= 16) return 15; // 中将
    if (rankIndex >= 15) return 12; // 少将
    if (rankIndex >= 14) return 10; // 准将
  }
  
  // 공통 (대좌 이하)
  if (rankIndex >= 13) return 8;  // 大佐
  if (rankIndex >= 12) return 7;  // 中佐
  if (rankIndex >= 11) return 6;  // 少佐
  if (rankIndex >= 8) return 5;   // 소위~대위
  
  return 3; // 하급 병사/부사관
}

/**
 * 직책 임명 가능 여부 확인
 * @param commanderRank 임명하려는 사람의 계급 (문자열 또는 숫자)
 * @param targetRank 임명 대상의 계급 (문자열 또는 숫자)
 * @param faction 세력
 * @returns 임명 가능 여부
 */
export function canAppoint(
  commanderRank: string | number,
  targetRank: string | number,
  faction: 'empire' | 'alliance'
): boolean {
  const commanderIndex = getRankIndex(commanderRank, faction);
  const targetIndex = getRankIndex(targetRank, faction);
  
  // 자신보다 계급이 높거나 같은 사람은 임명 불가
  return commanderIndex > targetIndex;
}

/**
 * 공적 포인트 획득
 * @param baseAmount 기본 공적량
 * @param multiplier 배수 (전투 승리 등)
 * @returns 획득 공적
 */
export function calculateAchievementGain(baseAmount: number, multiplier: number = 1): number {
  return Math.floor(baseAmount * multiplier);
}

/**
 * 계급 정보 조회
 * @param rank 계급명
 * @param faction 세력
 * @returns 계급 정보
 */
export function getRankInfo(rank: string, faction: 'empire' | 'alliance') {
  const rankIndex = getRankIndex(rank, faction);
  const requirements = faction === 'empire' ? EMPIRE_REQUIREMENTS : ALLIANCE_REQUIREMENTS;
  const requiredAchievements = requirements[rankIndex] || 0;
  const nextRequiredAchievements = requirements[rankIndex + 1] || null;
  const commandPoints = getBaseCommandPoints(rank, faction);
  const maxIndex = faction === 'empire' ? 19 : 18;
  
  return {
    rank,
    rankIndex,
    requiredAchievements,
    nextRequiredAchievements,
    commandPoints,
    isMaxRank: rankIndex >= maxIndex,
  };
}
