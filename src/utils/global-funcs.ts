
export function getDomesticExpLevelBonus(...args: any[]): any { return 0; }
import { CriticalRatioDomestic as calcCriticalRatio } from './game-processing';

/**
 * 내정 커맨드 성공 확률 계산 (통무지정매 5대 능력치 시스템)
 */
export function CriticalRatioDomestic(
  leadership: number,
  strength: number,
  intel: number,
  type: 'leadership' | 'strength' | 'intel' | 'politics' | 'charm',
  politics?: number,
  charm?: number
): { success: number; fail: number } {
  return calcCriticalRatio(leadership, strength, intel, type, politics, charm);
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
