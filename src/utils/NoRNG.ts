/**
 * NoRNG - RNG 대용으로 사용하되 실제로는 에러 발생
 * 내부에 랜덤 값을 호출하지 않을 것이 확실할 때 사용
 */

import { RNG } from './RNG';
import { MustNotBeReachedException } from '../common/exceptions';

export class NoRNG implements RNG {
  static readonly MAX_RNG_SUPPORT_BIT = 53;
  static readonly MAX_INT = (1 << NoRNG.MAX_RNG_SUPPORT_BIT) - 1;

  static getMaxInt(): number {
    return NoRNG.MAX_INT;
  }

  getMaxInt(): number {
    return NoRNG.MAX_INT;
  }

  nextBytes(bytes: number): Buffer {
    throw new MustNotBeReachedException();
  }

  nextBits(bits: number): Buffer {
    throw new MustNotBeReachedException();
  }

  nextInt(max?: number | null): number {
    throw new MustNotBeReachedException();
  }

  nextFloat1(): number {
    throw new MustNotBeReachedException();
  }
}
