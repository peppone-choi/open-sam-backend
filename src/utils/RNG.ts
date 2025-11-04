/**
 * RNG (Random Number Generator) 인터페이스
 */

/**
 * RNG 인터페이스
 */
export interface RNG {
  /**
   * nextInt()가 반환 가능한 최댓값
   */
  getMaxInt(): number;

  /**
   * 지정된 바이트 수만큼 랜덤 바이트 생성
   * @param bytes 바이트 수
   * @returns Little Endian 형태로 채워진 binary 값
   */
  nextBytes(bytes: number): Buffer;

  /**
   * 지정된 비트 수만큼 랜덤 비트 생성
   * @param bits 비트 수
   * @returns 랜덤 비트
   */
  nextBits(bits: number): Buffer;

  /**
   * 랜덤 정수 생성
   * @param max 최대치(해당 값 포함), null이면 최대값
   * @returns 0과 최대치 사이의 임의의 정수
   */
  nextInt(max?: number | null): number;

  /**
   * [0.0, 1.0) 사이의 랜덤 실수 생성
   */
  nextFloat1(): number;
}



