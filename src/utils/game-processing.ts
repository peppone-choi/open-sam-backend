/**
 * 게임 프로세싱 유틸리티 함수들
 * PHP 원본: func_process.php, func_gamerule.php
 */

/**
 * 내정 커맨드 성공 확률 계산
 * PHP: CriticalRatioDomestic
 */
export function CriticalRatioDomestic(
  leadership: number,
  strength: number,
  intel: number,
  type: 'leadership' | 'strength' | 'intel'
): { success: number; fail: number } {
  const avg = (leadership + strength + intel) / 3;

  let ratio: number;
  switch (type) {
    case 'leadership':
      ratio = avg / leadership;
      break;
    case 'strength':
      ratio = avg / strength;
      break;
    case 'intel':
      ratio = avg / intel;
      break;
    default:
      throw new Error('Invalid type');
  }

  ratio = Math.min(ratio, 1.2);

  let fail = Math.pow(ratio / 1.2, 1.4) - 0.3;
  let success = Math.pow(ratio / 1.2, 1.5) - 0.25;

  fail = Math.max(0, Math.min(0.5, fail));
  success = Math.max(0, Math.min(0.5, success));

  return { success, fail };
}

/**
 * 통솔 보너스 계산
 * PHP: calcLeadershipBonus
 */
export function calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
  if (officerLevel === 12) {
    return nationLevel * 2;
  } else if (officerLevel >= 5) {
    return nationLevel;
  } else {
    return 0;
  }
}

/**
 * 성공/실패 확률에 따른 보너스 계산
 * PHP: CriticalScoreEx
 */
export function CriticalScoreEx(rng: () => number, type: 'success' | 'fail'): number {
  if (type === 'success') {
    return 2.2 + rng() * (3.0 - 2.2);
  }
  if (type === 'fail') {
    return 0.2 + rng() * (0.4 - 0.2);
  }
  return 1;
}

/**
 * 국가 레벨 목록
 * PHP: getNationLevelList
 */
export function getNationLevelList(): Array<[string, number, number]> {
  return [
    [0, '방랑군', 2, 0],
    [1, '호족', 2, 1],
    [2, '군벌', 4, 2],
    [3, '주자사', 4, 5],
    [4, '주목', 6, 8],
    [5, '공', 6, 11],
    [6, '왕', 8, 16],
    [7, '황제', 8, 21],
  ];
}

/**
 * 도시 레벨 목록
 * PHP: getCityLevelList
 */
export function getCityLevelList(): Record<number, string> {
  return {
    1: '수',
    2: '진',
    3: '관',
    4: '이',
    5: '소',
    6: '중',
    7: '대',
    8: '특'
  };
}


