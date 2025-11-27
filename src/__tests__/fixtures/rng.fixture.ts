/**
 * Test Fixtures - RNG (Random Number Generator)
 * 
 * 테스트용 난수 생성기 유틸리티
 * 재현 가능한 테스트를 위한 시드 기반 RNG 제공
 */

export interface ITestRNG {
  nextRange(min: number, max: number): number;
  nextInt(max: number): number;
  nextFloat(): number;
  nextBool(probability?: number): boolean;
  choiceUsingWeight<T>(weights: Record<string, number>): string;
  choiceUsingWeightPair<T>(pairs: [T, number][]): [T, number];
}

/**
 * 시드 기반 의사 난수 생성기
 * 동일한 시드로 항상 동일한 결과를 생성
 */
export class SeededRNG implements ITestRNG {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  private next(): number {
    // Linear Congruential Generator (LCG)
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextFloat(): number {
    return this.next();
  }

  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  choiceUsingWeight<T>(weights: Record<string, number>): string {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (const [key, weight] of entries) {
      random -= weight;
      if (random <= 0) {
        return key;
      }
    }
    return entries[entries.length - 1][0];
  }

  choiceUsingWeightPair<T>(pairs: [T, number][]): [T, number] {
    const totalWeight = pairs.reduce((sum, [, w]) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (const pair of pairs) {
      random -= pair[1];
      if (random <= 0) {
        return pair;
      }
    }
    return pairs[pairs.length - 1];
  }

  /** 현재 시드 반환 (디버깅용) */
  getSeed(): number {
    return this.seed;
  }

  /** 시드 재설정 */
  reset(newSeed?: number): void {
    this.seed = newSeed ?? 12345;
  }
}

/**
 * 고정값 RNG - 항상 같은 값을 반환
 * 특정 결과를 보장해야 하는 테스트용
 */
export class FixedRNG implements ITestRNG {
  constructor(private fixedValue: number = 0.5) {}

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.fixedValue;
  }

  nextInt(max: number): number {
    return Math.floor(this.fixedValue * max);
  }

  nextFloat(): number {
    return this.fixedValue;
  }

  nextBool(probability: number = 0.5): boolean {
    return this.fixedValue < probability;
  }

  choiceUsingWeight<T>(weights: Record<string, number>): string {
    return Object.keys(weights)[0];
  }

  choiceUsingWeightPair<T>(pairs: [T, number][]): [T, number] {
    return pairs[0];
  }
}

/**
 * 순차 RNG - 미리 정의된 값을 순서대로 반환
 * 복잡한 시나리오 테스트용
 */
export class SequenceRNG implements ITestRNG {
  private index: number = 0;

  constructor(private values: number[]) {
    if (values.length === 0) {
      this.values = [0.5];
    }
  }

  private next(): number {
    const value = this.values[this.index % this.values.length];
    this.index++;
    return value;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextFloat(): number {
    return this.next();
  }

  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  choiceUsingWeight<T>(weights: Record<string, number>): string {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (const [key, weight] of entries) {
      random -= weight;
      if (random <= 0) {
        return key;
      }
    }
    return entries[entries.length - 1][0];
  }

  choiceUsingWeightPair<T>(pairs: [T, number][]): [T, number] {
    const totalWeight = pairs.reduce((sum, [, w]) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (const pair of pairs) {
      random -= pair[1];
      if (random <= 0) {
        return pair;
      }
    }
    return pairs[pairs.length - 1];
  }

  /** 인덱스 리셋 */
  reset(): void {
    this.index = 0;
  }
}

// 팩토리 함수들

/**
 * 시드 기반 테스트 RNG 생성
 */
export function createTestRNG(seed: number = 12345): SeededRNG {
  return new SeededRNG(seed);
}

/**
 * 시드 기반 RNG 생성 (별칭)
 */
export function createSeededRNG(seed: number): SeededRNG {
  return new SeededRNG(seed);
}

/**
 * 고정값 RNG 생성
 */
export function createFixedRNG(fixedValue: number): FixedRNG {
  return new FixedRNG(fixedValue);
}

/**
 * 순차 RNG 생성
 */
export function createSequenceRNG(values: number[]): SequenceRNG {
  return new SequenceRNG(values);
}

/**
 * Mock RNG (Jest용)
 * Jest mock 함수를 사용하여 호출 추적 가능
 */
export function createMockRNG(options: {
  nextRange?: number;
  nextInt?: number;
  nextFloat?: number;
  nextBool?: boolean;
  choice?: string;
} = {}): ITestRNG {
  return {
    nextRange: jest.fn((_min: number, _max: number) => options.nextRange ?? 0.5),
    nextInt: jest.fn((_max: number) => options.nextInt ?? 0),
    nextFloat: jest.fn(() => options.nextFloat ?? 0.5),
    nextBool: jest.fn((_prob?: number) => options.nextBool ?? true),
    choiceUsingWeight: jest.fn((_weights: Record<string, number>) => options.choice ?? 'default'),
    choiceUsingWeightPair: jest.fn((pairs: any[]) => pairs[0]),
  };
}

/**
 * RNG Presets - 특정 결과를 보장하는 RNG
 */
export const RNGPresets = {
  /** 항상 성공 (높은 값) */
  alwaysSuccess: () => createFixedRNG(0.99),
  
  /** 항상 실패 (낮은 값) */
  alwaysFail: () => createFixedRNG(0.01),
  
  /** 중간값 */
  average: () => createFixedRNG(0.5),
  
  /** 크리티컬 (매우 높음) */
  critical: () => createFixedRNG(0.001),
  
  /** 최소값 */
  minimum: () => createFixedRNG(0.0),
  
  /** 최대값 */
  maximum: () => createFixedRNG(0.999),
};

