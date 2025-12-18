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

  /**
   * 정수 범위 내 난수 생성
   */
  nextRangeInt(min: number, max: number): number;

  /**
   * 확률 기반 boolean 반환
   */
  nextBool(probability?: number): boolean;

  /**
   * 배열에서 랜덤 선택
   */
  choice<T>(arr: T[]): T;

  /**
   * 가중치 쌍에서 선택
   * [[value, weight], ...] 형태의 배열에서 가중치 기반 선택
   */
  choiceUsingWeightPair<T>(weightPairs: [T, number][]): T;
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

  nextRangeInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  nextBool(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  choice<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  choiceUsingWeightPair<T>(weightPairs: [T, number][]): T {
    if (weightPairs.length === 0) {
      throw new Error('Cannot choose from empty weight pairs');
    }

    const totalWeight = weightPairs.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let random = Math.random() * totalWeight;
    
    for (const [value, weight] of weightPairs) {
      random -= weight;
      if (random <= 0) {
        return value;
      }
    }
    
    return weightPairs[weightPairs.length - 1][0];
  }
}

/**
 * 기본 RandUtil 인스턴스
 */
export const defaultRand = new DefaultRandUtil();

// RandUtil 클래스 re-export
export { RandUtil as RandUtilClass } from './RandUtil';
