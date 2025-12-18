import { RNG } from './RNG';

export class RandUtil {
  private seed: number;
  private externalRng: RNG | null = null;

  constructor(seed?: number | string | RNG) {
    this.setSeed(seed);
  }

  setSeed(seed?: number | string | RNG): void {
    if (RandUtil.isRng(seed)) {
      this.externalRng = seed;
      this.seed = RandUtil.defaultSeed();
      return;
    }

    this.externalRng = null;
    this.seed = RandUtil.normalizeSeed(seed);
  }

  getSeed(): number {
    return this.seed;
  }

  private static isRng(candidate: any): candidate is RNG {
    return !!candidate && typeof candidate.nextFloat1 === 'function' && typeof candidate.nextInt === 'function';
  }

  private static normalizeSeed(seed?: number | string): number {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
      const normalized = Math.abs(Math.floor(seed)) % 233280;
      return normalized > 0 ? normalized : RandUtil.defaultSeed();
    }

    if (typeof seed === 'string') {
      return RandUtil.normalizeSeed(RandUtil.hashString(seed));
    }

    return RandUtil.defaultSeed();
  }

  private static hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  private static defaultSeed(): number {
    const fallback = Math.abs(Date.now() % 233280);
    return fallback > 0 ? fallback : 1;
  }

  
  next(): number {
    if (this.externalRng) {
      const value = this.externalRng.nextFloat1();
      // nextFloat1() may return 1.0 depending on implementation, clamp to [0, 1)
      return Math.min(Math.max(value, 0), 1 - Number.EPSILON);
    }
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }


  nextRange(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  nextRangeInt(min: number, max: number): number {
    return this.nextInt(min, max);
  }

  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  nextBool(probability: number = 0.5): boolean {
    return this.nextBoolean(probability);
  }
  
  choice<T>(arr: T[]): T {

    if (arr.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    return arr[this.nextInt(0, arr.length - 1)];
  }

  choiceUsingWeight<T extends string>(weights: Record<T, number>): T {
    const keys = Object.keys(weights) as T[];
    const values = Object.values(weights) as number[];
    
    const totalWeight = values.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let random = this.next() * totalWeight;
    
    for (let i = 0; i < keys.length; i++) {
      random -= values[i];
      if (random <= 0) {
        return keys[i];
      }
    }
    
    return keys[keys.length - 1];
  }

  /**
   * PHP RandUtil::choiceUsingWeightPair와 동일
   * [value, weight] 쌍의 배열에서 가중치 기반으로 선택
   * 
   * @param weightPairs - [[value1, weight1], [value2, weight2], ...] 또는 Map<any, [value, weight]>
   * @returns 선택된 값
   * 
   * @example
   * ```ts
   * const result = rng.choiceUsingWeightPair([
   *   ['apple', 10],
   *   ['banana', 5],
   *   ['orange', 3]
   * ]);
   * ```
   */
  choiceUsingWeightPair<T>(weightPairs: [T, number][] | Map<any, [T, number]>): T {
    // Map을 배열로 변환
    const pairs: [T, number][] = weightPairs instanceof Map 
      ? Array.from(weightPairs.values()) 
      : weightPairs;
    
    if (pairs.length === 0) {
      throw new Error('Cannot choose from empty weight pairs');
    }

    const totalWeight = pairs.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let random = this.next() * totalWeight;
    
    for (const [value, weight] of pairs) {
      random -= weight;
      if (random <= 0) {
        return value;
      }
    }
    
    return pairs[pairs.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  sample<T>(arr: T[], count: number): T[] {
    if (count > arr.length) {
      throw new Error('Sample size cannot be larger than array length');
    }
    const shuffled = this.shuffle(arr);
    return shuffled.slice(0, count);
  }

  weightedSample<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have same length');
    }
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  exponential(lambda: number = 1): number {
    return -Math.log(this.next()) / lambda;
  }

  binomial(n: number, p: number): number {
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (this.nextBoolean(p)) {
        successes++;
      }
    }
    return successes;
  }

  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    
    do {
      k++;
      p *= this.next();
    } while (p > L);
    
    return k - 1;
  }

  uuid(): string {
    const hex = '0123456789abcdef';
    let result = '';
    
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        result += '-';
      } else if (i === 14) {
        result += '4';
      } else if (i === 19) {
        result += hex[this.nextInt(8, 11)];
      } else {
        result += hex[this.nextInt(0, 15)];
      }
    }
    
    return result;
  }

  randomColor(): string {
    const r = this.nextInt(0, 255);
    const g = this.nextInt(0, 255);
    const b = this.nextInt(0, 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
