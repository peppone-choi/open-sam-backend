/**
 * LiteHashDRBG - SHA512 기반 결정적 랜덤 넘버 제너레이터
 * Reseed를 하지 않는 단순한 형태
 */

import * as crypto from 'crypto';
import { RNG } from './RNG';

export class LiteHashDRBG implements RNG {
  // NOTE: JavaScript 버전과 일치
  static readonly MAX_RNG_SUPPORT_BIT = 53;
  static readonly MAX_INT = (1 << LiteHashDRBG.MAX_RNG_SUPPORT_BIT) - 1;
  static readonly BUFFER_BYTE_SIZE = 512 / 8; // SHA512

  private buffer: Buffer;
  private bufferIdx: number;
  private stateIdx: number;
  private seed: string;

  private static readonly INT_BIT_MASK_MAP: Record<number, number> = {
    0x1: 1,
    0x3: 2,
    0x7: 3,
    0xf: 4,
    0x1f: 5,
    0x3f: 6,
    0x7f: 7,
    0xff: 8,
    0x1ff: 9,
    0x3ff: 10,
    0x7ff: 11,
    0xfff: 12,
    0x1fff: 13,
    0x3fff: 14,
    0x7fff: 15,
    0xffff: 16,
    0x1ffff: 17,
    0x3ffff: 18,
    0x7ffff: 19,
    0xfffff: 20,
    0x1fffff: 21,
    0x3fffff: 22,
    0x7fffff: 23,
    0xffffff: 24,
    0x1ffffff: 25,
    0x3ffffff: 26,
    0x7ffffff: 27,
    0xfffffff: 28,
    0x1fffffff: 29,
    0x3fffffff: 30,
    0x7fffffff: 31,
    0xffffffff: 32,
    0x1ffffffff: 33,
    0x3ffffffff: 34,
    0x7ffffffff: 35,
    0xfffffffff: 36,
    0x1fffffffff: 37,
    0x3fffffffff: 38,
    0x7fffffffff: 39,
    0xffffffffff: 40,
    0x1ffffffffff: 41,
    0x3ffffffffff: 42,
    0x7ffffffffff: 43,
    0xfffffffffff: 44,
    0x1fffffffffff: 45,
    0x3fffffffffff: 46,
    0x7fffffffffff: 47,
    0xffffffffffff: 48,
    0x1ffffffffffff: 49,
    0x3ffffffffffff: 50,
    0x7ffffffffffff: 51,
    0xfffffffffffff: 52,
    0x1fffffffffffff: 53,
  };

  constructor(seed: string, stateIdx: number = 0, bufferIdx: number = 0) {
    if (bufferIdx < 0) {
      throw new Error(`bufferIdx ${bufferIdx} < 0`);
    }
    if (bufferIdx >= LiteHashDRBG.BUFFER_BYTE_SIZE) {
      throw new Error(`bufferIdx ${bufferIdx} >= ${LiteHashDRBG.BUFFER_BYTE_SIZE}`);
    }
    if (stateIdx < 0) {
      throw new Error(`stateIdx ${stateIdx} < 0`);
    }

    this.seed = seed;
    this.stateIdx = stateIdx;
    this.genNextBlock();
    this.bufferIdx = bufferIdx;
  }

  static getMaxInt(): number {
    return LiteHashDRBG.MAX_INT;
  }

  getMaxInt(): number {
    return LiteHashDRBG.MAX_INT;
  }

  private genNextBlock(): void {
    const hq = Buffer.concat([
      Buffer.from(this.seed, 'utf8'),
      Buffer.allocUnsafe(4),
    ]);
    hq.writeUInt32LE(this.stateIdx, hq.length - 4);
    
    this.buffer = crypto.createHash('sha512').update(hq).digest();
    this.bufferIdx = 0;
    this.stateIdx += 1;
  }

  nextBytes(bytes: number): Buffer {
    if (bytes <= 0) {
      throw new Error(`${bytes} <= 0`);
    }

    if (this.bufferIdx + bytes <= LiteHashDRBG.BUFFER_BYTE_SIZE) {
      const result = this.buffer.slice(this.bufferIdx, this.bufferIdx + bytes);
      this.bufferIdx += bytes;
      if (this.bufferIdx === LiteHashDRBG.BUFFER_BYTE_SIZE) {
        this.genNextBlock();
      }
      return result;
    }

    const result: Buffer[] = [this.buffer.slice(this.bufferIdx)];
    let remain = bytes - (LiteHashDRBG.BUFFER_BYTE_SIZE - this.bufferIdx);

    while (remain > LiteHashDRBG.BUFFER_BYTE_SIZE) {
      this.genNextBlock();
      result.push(this.buffer);
      remain -= LiteHashDRBG.BUFFER_BYTE_SIZE;
    }

    this.genNextBlock();
    if (remain === 0) {
      return Buffer.concat(result);
    }

    result.push(this.buffer.slice(0, remain));
    this.bufferIdx = remain;
    return Buffer.concat(result);
  }

  nextBits(bits: number): Buffer {
    const bytes = Math.ceil(bits / 8);
    const headBits = bits & 0x7;

    const buffer = this.nextBytes(bytes);
    if (headBits === 0) {
      return buffer;
    }

    // 마지막 바이트의 상위 비트를 마스킹
    const lastByte = buffer[buffer.length - 1];
    buffer[buffer.length - 1] = lastByte & (0xff >> (8 - headBits));
    return buffer;
  }

  private static parseU64(value: Buffer): number {
    // Little Endian 64-bit unsigned integer
    return value.readUInt32LE(0) + (value.readUInt32LE(4) * 0x100000000);
  }

  private _nextInt(bits: number): number {
    const buffer = Buffer.concat([
      this.nextBits(bits),
      Buffer.alloc(7), // 7바이트 패딩
    ]);
    return LiteHashDRBG.parseU64(buffer);
  }

  nextInt(max?: number | null): number {
    if (max === undefined || max === LiteHashDRBG.MAX_INT) {
      const buffer = Buffer.concat([
        this.nextBits(LiteHashDRBG.MAX_RNG_SUPPORT_BIT),
        Buffer.alloc(1),
      ]);
      return LiteHashDRBG.parseU64(buffer);
    }

    if (max > LiteHashDRBG.MAX_INT) {
      throw new Error('Over Max Int');
    } else if (max === 0) {
      return 0;
    } else if (max < 0) {
      return -this.nextInt(-max);
    }

    const mask = LiteHashDRBG.calcBitMask(max);
    const bits = LiteHashDRBG.INT_BIT_MASK_MAP[mask];

    let n = this._nextInt(bits);
    while (n > max) {
      n = this._nextInt(bits);
    }

    return n;
  }

  nextFloat1(): number {
    const max = 1 << LiteHashDRBG.MAX_RNG_SUPPORT_BIT;
    while (true) {
      const buffer = Buffer.concat([
        this.nextBits(LiteHashDRBG.MAX_RNG_SUPPORT_BIT + 1),
        Buffer.alloc(1),
      ]);
      const nInt = LiteHashDRBG.parseU64(buffer);
      if (nInt <= max) {
        return nInt / max;
      }
    }
  }

  private static calcBitMask(n: number): number {
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    n |= n >> 32;
    return n;
  }

  static build(seed: string, idx: number = 0): LiteHashDRBG {
    return new LiteHashDRBG(seed, idx);
  }
}
