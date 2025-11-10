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
  '上級大将',   // 17: Senior Admiral
  '元帥',       // 18: Grand Admiral
];

/**
 * 동맹 계급 목록 (하위 → 상위)
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
  '大将',       // 17: Admiral (동맹은 上級大将 대신 大将)
  '元帥',       // 18: Grand Admiral
];

/**
 * 계급별 필요 공적 포인트
 */
export const RANK_ACHIEVEMENT_REQUIREMENTS: Record<number, number> = {
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
  17: 28000,  // 上級大将 / 大将
  18: 35000,  // 元帥
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
 * @param rank 계급명
 * @param faction 세력 ('empire' | 'alliance')
 * @returns 계급 인덱스 (0-18)
 */
export function getRankIndex(rank: string, faction: 'empire' | 'alliance'): number {
  const ranks = faction === 'empire' ? EMPIRE_RANKS : ALLIANCE_RANKS;
  const index = ranks.indexOf(rank);
  return index >= 0 ? index : 0;
}

/**
 * 계급명 조회
 * @param rankIndex 계급 인덱스 (0-18)
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
 * @returns 승진 가능 여부
 */
export function canPromote(
  currentRank: string,
  achievements: number,
  faction: 'empire' | 'alliance'
): boolean {
  const currentIndex = getRankIndex(currentRank, faction);
  
  // 이미 최고 계급이면 승진 불가
  if (currentIndex >= 18) {
    return false;
  }
  
  // 다음 계급에 필요한 공적 확인
  const requiredAchievements = RANK_ACHIEVEMENT_REQUIREMENTS[currentIndex + 1] || 999999;
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
  
  // 최고 계급이면 그대로 반환
  if (currentIndex >= 18) {
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
 * 계급별 기본 커맨드 포인트 조회
 * @param rank 계급명
 * @param faction 세력
 * @returns 기본 CP
 */
export function getBaseCommandPoints(rank: string, faction: 'empire' | 'alliance'): number {
  const rankIndex = getRankIndex(rank, faction);
  
  // 계급이 높을수록 많은 CP
  if (rankIndex >= 18) return 20; // 元帥
  if (rankIndex >= 17) return 18; // 上級大将 / 大将
  if (rankIndex >= 16) return 15; // 中将
  if (rankIndex >= 15) return 12; // 少将
  if (rankIndex >= 14) return 10; // 准将
  if (rankIndex >= 13) return 8;  // 大佐
  if (rankIndex >= 12) return 7;  // 中佐
  if (rankIndex >= 11) return 6;  // 少佐
  if (rankIndex >= 8) return 5;   // 소위~대위
  
  return 3; // 하급 병사/부사관
}

/**
 * 직책 임명 가능 여부 확인
 * @param commanderRank 임명하려는 사람의 계급
 * @param targetRank 임명 대상의 계급
 * @param faction 세력
 * @returns 임명 가능 여부
 */
export function canAppoint(
  commanderRank: string,
  targetRank: string,
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
  const requiredAchievements = RANK_ACHIEVEMENT_REQUIREMENTS[rankIndex] || 0;
  const nextRequiredAchievements = RANK_ACHIEVEMENT_REQUIREMENTS[rankIndex + 1] || null;
  const commandPoints = getBaseCommandPoints(rank, faction);
  
  return {
    rank,
    rankIndex,
    requiredAchievements,
    nextRequiredAchievements,
    commandPoints,
    isMaxRank: rankIndex >= 18,
  };
}
