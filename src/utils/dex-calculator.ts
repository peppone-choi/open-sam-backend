/**
 * 숙련도 (Dex/Proficiency) 계산 유틸리티
 * 
 * PHP 참조:
 * - core/hwe/func_converter.php: getDexLevelList(), getDexLevel(), getDexLog()
 * - core/hwe/sammo/General.php: addDex()
 */

/**
 * 숙련도 레벨 테이블
 * PHP getDexLevelList()와 동일
 * 
 * [경험치, 색상, 등급명]
 */
export const DEX_LEVEL_LIST: Array<[number, string, string]> = [
  [0, 'navy', 'F-'],
  [350, 'navy', 'F'],
  [1375, 'navy', 'F+'],
  [3500, 'skyblue', 'E-'],
  [7125, 'skyblue', 'E'],
  [12650, 'skyblue', 'E+'],
  [20475, 'seagreen', 'D-'],
  [31000, 'seagreen', 'D'],
  [44625, 'seagreen', 'D+'],
  [61750, 'teal', 'C-'],
  [82775, 'teal', 'C'],
  [108100, 'teal', 'C+'],
  [138125, 'limegreen', 'B-'],
  [173250, 'limegreen', 'B'],
  [213875, 'limegreen', 'B+'],
  [260400, 'darkorange', 'A-'],
  [313225, 'darkorange', 'A'],
  [372750, 'darkorange', 'A+'],
  [439375, 'tomato', 'S-'],
  [513500, 'tomato', 'S'],
  [595525, 'tomato', 'S+'],
  [685850, 'darkviolet', 'Z-'],
  [784875, 'darkviolet', 'Z'],
  [893000, 'darkviolet', 'Z+'],
  [1010625, 'gold', 'EX-'],
  [1138150, 'gold', 'EX'],
  [1275975, 'white', 'EX+'],
];

/**
 * 숙련도 경험치를 레벨 인덱스로 변환
 * PHP getDexLevel()와 동일
 * 
 * @param dex - 숙련도 경험치
 * @returns 레벨 인덱스 (0-26)
 */
export function getDexLevel(dex: number): number {
  if (dex < 0) {
    return 0;
  }

  let retVal = 0;
  for (let dexLevel = 0; dexLevel < DEX_LEVEL_LIST.length; dexLevel++) {
    const [dexKey] = DEX_LEVEL_LIST[dexLevel];
    if (dex < dexKey) {
      break;
    }
    retVal = dexLevel;
  }
  
  return retVal;
}

/**
 * 숙련도 경험치를 표시용 문자열로 변환
 * PHP getDexCall()와 유사
 * 
 * @param dex - 숙련도 경험치
 * @returns { color, name, level } 객체
 */
export function getDexDisplay(dex: number): { color: string; name: string; level: number } {
  if (dex < 0) {
    throw new Error('Invalid dex value');
  }

  let color = 'navy';
  let name = 'F-';
  let level = 0;

  for (let dexLevel = 0; dexLevel < DEX_LEVEL_LIST.length; dexLevel++) {
    const [dexKey, nextColor, nextName] = DEX_LEVEL_LIST[dexLevel];
    if (dex < dexKey) {
      break;
    }
    color = nextColor;
    name = nextName;
    level = dexLevel;
  }

  return { color, name, level };
}

/**
 * 두 숙련도 간 보너스 비율 계산
 * PHP getDexLog()와 동일
 * 
 * 공격자의 숙련도가 높으면 > 1.0
 * 방어자의 숙련도가 높으면 < 1.0
 * 
 * @param dex1 - 공격자 숙련도 경험치
 * @param dex2 - 방어자 숙련도 경험치
 * @returns 보너스 비율 (기본 1.0)
 */
export function getDexBonus(dex1: number, dex2: number): number {
  const level1 = getDexLevel(dex1);
  const level2 = getDexLevel(dex2);
  
  // PHP: $ratio = (getDexLevel($dex1) - getDexLevel($dex2)) / 55 + 1;
  const ratio = (level1 - level2) / 55 + 1;
  
  return ratio;
}

/**
 * 숙련도 경험치 계산 (병종별 가중치 적용)
 * PHP General::addDex()와 동일
 * 
 * @param baseExp - 기본 경험치
 * @param armType - 병종 타입 (0: 보병, 1: 궁병, 2: 기병, 3: 귀병, 4: 차병)
 * @param train - 훈련도 (0-100)
 * @param atmos - 사기 (0-100)
 * @param affectTrainAtmos - 훈련도/사기 영향 여부
 * @returns 최종 숙련도 경험치
 */
export function calculateDexExp(
  baseExp: number,
  armType: number,
  train: number = 100,
  atmos: number = 100,
  affectTrainAtmos: boolean = false
): number {
  let exp = baseExp;

  // 병종 타입 정규화: 성벽 타입(5)은 차병(4)로 처리
  if (armType === 5) {
    armType = 4;
  }

  // 음수 타입은 숙련도 없음
  if (armType < 0) {
    return 0;
  }

  // 귀병(3)과 차병(4)은 0.9배 가중치
  if (armType === 3 || armType === 4) {
    exp *= 0.9;
  }

  // 훈련도와 사기 영향 적용
  if (affectTrainAtmos) {
    exp *= (train + atmos) / 200;
  }

  return exp;
}

/**
 * 병종 타입별 숙련도 필드명 반환
 * 
 * @param armType - 병종 타입 (0-4)
 * @returns 숙련도 필드명 (dex0 ~ dex4)
 */
export function getDexFieldName(armType: number): string {
  // 성벽 타입(5)은 차병(4)로 처리
  if (armType === 5) {
    armType = 4;
  }

  // 음수는 기본값
  if (armType < 0) {
    armType = 0;
  }

  return `dex${armType}`;
}

/**
 * 최대 숙련도 레벨 경험치 반환
 * 
 * @returns 최대 숙련도 경험치 (EX+ 등급)
 */
export function getMaxDexExp(): number {
  return DEX_LEVEL_LIST[DEX_LEVEL_LIST.length - 1][0];
}

/**
 * 숙련도 정보를 모두 반환
 * 
 * @param dex - 숙련도 경험치
 * @returns 숙련도 정보 객체
 */
export function getDexInfo(dex: number): {
  exp: number;
  level: number;
  color: string;
  name: string;
  nextLevelExp: number | null;
  progress: number;
} {
  const level = getDexLevel(dex);
  const { color, name } = getDexDisplay(dex);
  
  const currentLevelExp = DEX_LEVEL_LIST[level]?.[0] ?? 0;
  const nextLevelExp = level < DEX_LEVEL_LIST.length - 1 
    ? DEX_LEVEL_LIST[level + 1]?.[0] ?? null
    : null;
  
  const progress = nextLevelExp !== null
    ? ((dex - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100
    : 100;

  return {
    exp: dex,
    level,
    color,
    name,
    nextLevelExp,
    progress
  };
}
