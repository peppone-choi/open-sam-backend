/**
 * 숙련도 등급 관련 유틸리티 함수
 * PHP: func_converter.php의 getDexLevelList() 함수와 동일
 */

export interface DexLevelInfo {
  amount: number;
  color: string;
  name: string;
}

/**
 * 숙련도 등급 목록 반환
 * [숙련도_최소값, 색상, 등급명]
 */
export function getDexLevelList(): DexLevelInfo[] {
  return [
    { amount: 0, color: 'navy', name: 'F-' },
    { amount: 350, color: 'navy', name: 'F' },
    { amount: 1375, color: 'navy', name: 'F+' },
    { amount: 3500, color: 'skyblue', name: 'E-' },
    { amount: 7125, color: 'skyblue', name: 'E' },
    { amount: 12650, color: 'skyblue', name: 'E+' },
    { amount: 20475, color: 'seagreen', name: 'D-' },
    { amount: 31000, color: 'seagreen', name: 'D' },
    { amount: 44625, color: 'seagreen', name: 'D+' },
    { amount: 61750, color: 'teal', name: 'C-' },
    { amount: 82775, color: 'teal', name: 'C' },
    { amount: 108100, color: 'teal', name: 'C+' },
    { amount: 138125, color: 'limegreen', name: 'B-' },
    { amount: 173250, color: 'limegreen', name: 'B' },
    { amount: 213875, color: 'limegreen', name: 'B+' },
    { amount: 260400, color: 'darkorange', name: 'A-' },
    { amount: 313225, color: 'darkorange', name: 'A' },
    { amount: 372750, color: 'darkorange', name: 'A+' },
    { amount: 439375, color: 'tomato', name: 'S-' },
    { amount: 513500, color: 'tomato', name: 'S' },
    { amount: 595525, color: 'tomato', name: 'S+' },
    { amount: 685850, color: 'darkviolet', name: 'Z-' },
    { amount: 784875, color: 'darkviolet', name: 'Z' },
    { amount: 893000, color: 'darkviolet', name: 'Z+' },
    { amount: 1010625, color: 'gold', name: 'EX-' },
    { amount: 1138150, color: 'gold', name: 'EX' },
    { amount: 1275975, color: 'white', name: 'EX+' },
  ];
}

/**
 * 숙련도 값에 해당하는 등급 정보 반환
 */
export function getDexLevel(dex: number): DexLevelInfo {
  if (dex < 0) {
    throw new Error(`올바르지 않은 수치: ${dex}`);
  }

  let color = '';
  let name = '';
  const dexLevelList = getDexLevelList();
  
  for (const dexLevel of dexLevelList) {
    if (dex < dexLevel.amount) {
      break;
    }
    color = dexLevel.color;
    name = dexLevel.name;
  }

  return {
    amount: dex,
    color,
    name
  };
}

