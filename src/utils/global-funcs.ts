
export function getDomesticExpLevelBonus(...args: any[]): any { return 0; }
import { CriticalRatioDomestic as calcCriticalRatio } from './game-processing';

export function CriticalRatioDomestic(
  leadership: number,
  strength: number,
  intel: number,
  type: 'leadership' | 'strength' | 'intel'
): { success: number; fail: number } {
  return calcCriticalRatio(leadership, strength, intel, type);
}
import { CriticalScoreEx as calcCriticalScoreEx } from './game-processing';

export function CriticalScoreEx(
  rng: () => number,
  type: 'success' | 'fail'
): number {
  return calcCriticalScoreEx(rng, type);
}
export function updateMaxDomesticCritical(...args: any[]): any {}
export function getTechCost(...args: any[]): any { return 0; }
export function getAllNationStaticInfo(...args: any[]): any { return {}; }
