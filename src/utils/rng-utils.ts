/**
 * RNG Utilities
 * PHP func.php genGenericUniqueRNGFromGeneral 구현
 */

import seedrandom from 'seedrandom';
import type { IGeneral } from '../models/general.model';

export interface RandUtil {
  next(min?: number, max?: number): number;
}

/**
 * 장수 정보로부터 고유한 RNG 생성
 * PHP: genGenericUniqueRNGFromGeneral()
 */
export function genGenericUniqueRNGFromGeneral(
  general: IGeneral | any,
  actionName: string
): RandUtil {
  // 시드 생성: generalId + actionName + turntime
  const generalId = general._id?.toString() || general.general_id || general.no || '0';
  const turntime = general.turntime || general.turn_time || Date.now();
  const seed = `${generalId}_${actionName}_${turntime}`;
  
  const rng = seedrandom(seed);
  
  return {
    next(min?: number, max?: number): number {
      if (min === undefined && max === undefined) {
        // 0.0 ~ 1.0
        return rng();
      }
      
      if (max === undefined) {
        // 0 ~ min-1
        return Math.floor(rng() * min!);
      }
      
      // min ~ max
      return Math.floor(rng() * (max - min! + 1)) + min!;
    }
  };
}

/**
 * 일반 시드 기반 RNG 생성
 */
export function createSeededRNG(seed: string): RandUtil {
  const rng = seedrandom(seed);
  
  return {
    next(min?: number, max?: number): number {
      if (min === undefined && max === undefined) {
        return rng();
      }
      
      if (max === undefined) {
        return Math.floor(rng() * min!);
      }
      
      return Math.floor(rng() * (max - min! + 1)) + min!;
    }
  };
}
