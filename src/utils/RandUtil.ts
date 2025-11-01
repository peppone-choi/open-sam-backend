export class RandUtil {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  getSeed(): number {
    return this.seed;
  }

  next(): number {
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
