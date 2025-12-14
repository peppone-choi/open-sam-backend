export class SeedRandom {
  private state: number;

  constructor(seed: string | number = Date.now()) {
    let hash = 2166136261;
    const seedStr = seed.toString();
    for (let i = 0; i < seedStr.length; i += 1) {
      hash ^= seedStr.charCodeAt(i);
      hash *= 16777619;
      hash >>>= 0;
    }
    this.state = hash || 0xdeadbeef;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) % 0x100000000) / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * PHP RandUtil::nextRangeInt 포팅
   * min ~ max 범위의 정수 반환 (양 끝 포함)
   */
  nextRangeInt(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next());
  }

  pick<T>(list: T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
}
