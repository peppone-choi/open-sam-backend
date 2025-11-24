import { ARM_TYPE } from '../const/GameUnitConst';

// [requiredExp, color, gradeName]
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

export type DexField = 'dex1' | 'dex2' | 'dex3' | 'dex4' | 'dex5';

// PHP getDexLevel(): return index of last threshold <= dex
export function getDexLevel(dex: number): number {
  if (dex < 0) {
    return 0;
  }
  let ret = 0;
  for (let i = 0; i < DEX_LEVEL_LIST.length; i += 1) {
    const [threshold] = DEX_LEVEL_LIST[i];
    if (dex < threshold) {
      break;
    }
    ret = i;
  }
  return ret;
}

// PHP getDexLog(): (level1 - level2) / 55 + 1
export function getDexBonus(dex1: number, dex2: number): number {
  const level1 = getDexLevel(dex1);
  const level2 = getDexLevel(dex2);
  return (level1 - level2) / 55 + 1;
}

// Map armType to dex1..dex5 (castle shares siege)
export function getDexFieldNameFromArmType(armType: number): DexField {
  if (armType === ARM_TYPE.CASTLE) {
    return 'dex5';
  }
  switch (armType) {
    case ARM_TYPE.FOOTMAN:
      return 'dex1';
    case ARM_TYPE.ARCHER:
      return 'dex2';
    case ARM_TYPE.CAVALRY:
      return 'dex3';
    case ARM_TYPE.WIZARD:
      return 'dex4';
    case ARM_TYPE.SIEGE:
      return 'dex5';
    default:
      // Unknown / misc -> treat as infantry
      return 'dex1';
  }
}

// Core dex EXP calculation, mirroring PHP General::addDex
export function calculateDexExp(
  baseExp: number,
  armType: number,
  train: number = 100,
  atmos: number = 100,
  affectTrainAtmos: boolean = false,
): number {
  let exp = baseExp;

  if (armType === ARM_TYPE.CASTLE) {
    armType = ARM_TYPE.SIEGE;
  }

  if (armType < 0) {
    return 0;
  }

  if (armType === ARM_TYPE.WIZARD || armType === ARM_TYPE.SIEGE) {
    exp *= 0.9;
  }

  if (affectTrainAtmos) {
    exp *= (train + atmos) / 200;
  }

  return exp;
}

// Convenience helper for UI / debugging
export function getDexInfo(dex: number): {
  exp: number;
  level: number;
  color: string;
  name: string;
  nextLevelExp: number | null;
  progress: number; // 0-100 within current level
} {
  const safeDex = Math.max(0, dex);
  const level = getDexLevel(safeDex);

  const [currentLevelExp, color, name] = DEX_LEVEL_LIST[level] ?? [0, 'navy', 'F-'];
  const isMax = level >= DEX_LEVEL_LIST.length - 1;
  const nextLevelExp = isMax ? null : DEX_LEVEL_LIST[level + 1][0];

  let progress = 100;
  if (!isMax && nextLevelExp !== null) {
    const span = nextLevelExp - currentLevelExp;
    progress = span > 0 ? ((safeDex - currentLevelExp) / span) * 100 : 0;
    if (!Number.isFinite(progress)) {
      progress = 0;
    }
  }

  // Clamp for safety
  progress = Math.max(0, Math.min(100, progress));

  return {
    exp: safeDex,
    level,
    color,
    name,
    nextLevelExp,
    progress,
  };
}
