/**
 * 난수 생성 서비스
 * 
 * PHP의 mt_rand()와 동일한 결과를 보장하는 시드 기반 난수 생성기
 * 각 커맨드마다 고유한 시드를 사용하여 결정론적 난수 생성
 */

/**
 * 간단한 해시 함수 (문자열을 32비트 정수로 변환)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash);
}

/**
 * SplitMix32 난수 생성기 (시드 기반)
 * PHP mt_rand와 유사한 균등 분포 생성
 */
class SplitMix32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * 다음 난수 생성 (0 ~ 2^32-1)
   */
  private next(): number {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  }

  /**
   * [min, max] 범위의 정수 난수 (양 끝 포함)
   * PHP의 mt_rand(min, max)와 동일
   */
  randInt(min: number, max: number): number {
    if (min > max) {
      throw new Error(`최소값(${min})이 최대값(${max})보다 큽니다`);
    }
    const range = max - min + 1;
    const randomValue = this.next();
    return min + (randomValue % range);
  }

  /**
   * [min, max] 범위의 실수 난수
   */
  randFloat(min: number, max: number): number {
    const randomValue = this.next() / 0xffffffff;
    return min + randomValue * (max - min);
  }

  /**
   * 0~1 사이의 실수 난수
   */
  random(): number {
    return this.next() / 0xffffffff;
  }
}

/**
 * 난수 생성 서비스
 */
export class RNGService {
  /**
   * 커맨드 데이터로부터 시드 생성
   */
  static createSeed(
    commandId: string,
    generalId: string,
    turn: number,
    commandType: string
  ): number {
    const seedString = `${commandId}|${generalId}|${turn}|${commandType}`;
    return hashString(seedString);
  }

  /**
   * 시드로부터 RNG 인스턴스 생성
   */
  static fromSeed(seed: number): SplitMix32 {
    return new SplitMix32(seed);
  }

  /**
   * 커맨드 데이터로부터 RNG 인스턴스 생성
   */
  static fromCommand(
    commandId: string,
    generalId: string,
    turn: number,
    commandType: string
  ): SplitMix32 {
    const seed = this.createSeed(commandId, generalId, turn, commandType);
    return new SplitMix32(seed);
  }
}
