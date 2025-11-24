/**
 * Random Utility Type
 * PHP RandUtil 인터페이스 구현
 */

export interface RandUtil {
  /**
   * 난수 생성
   * - 인자 없음: 0.0 ~ 1.0 사이 float
   * - 인자 1개 (max): 0 ~ max-1 사이 integer
   * - 인자 2개 (min, max): min ~ max 사이 integer
   */
  next(min?: number, max?: number): number;
}

/**
 * 기본 Math.random 기반 RandUtil 구현
 */
export class DefaultRandUtil implements RandUtil {
  next(min?: number, max?: number): number {
    if (min === undefined && max === undefined) {
      // 0.0 ~ 1.0
      return Math.random();
    }
    
    if (max === undefined) {
      // 0 ~ min-1
      return Math.floor(Math.random() * min!);
    }
    
    // min ~ max
    return Math.floor(Math.random() * (max - min! + 1)) + min!;
  }
}

/**
 * 기본 RandUtil 인스턴스
 */
export const defaultRand = new DefaultRandUtil();
