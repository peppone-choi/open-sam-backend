/**
 * BaseNationType
 * 
 * 국가 타입의 기본 클래스
 * PHP BaseNation 클래스를 TypeScript로 포팅
 */

export abstract class BaseNationType {
  protected name: string = '-';
  protected info: string = '';
  static pros: string = '';
  static cons: string = '';

  /**
   * 국가 타입 이름 반환
   */
  getName(): string {
    return this.name;
  }

  /**
   * 국가 타입 정보 반환 (장점/단점)
   */
  getInfo(): string {
    const pros = (this.constructor as typeof BaseNationType).pros;
    const cons = (this.constructor as typeof BaseNationType).cons;
    return `${pros} ${cons}`.trim();
  }

  /**
   * 내정 계산 시 보정
   * @param turnType 내정 타입 (농업, 상업, 치안, 민심, 인구, 기술, 수성 등)
   * @param varType 변수 타입 (score: 성과, cost: 비용)
   * @param value 원래 값
   * @param aux 추가 파라미터
   * @returns 보정된 값
   */
  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number, aux?: any): number {
    // 기본 구현: 값 그대로 반환
    return value;
  }

  /**
   * 국가 수입 계산 시 보정
   * @param type 수입 타입 (gold: 금, rice: 쌀, pop: 인구)
   * @param amount 원래 수입
   * @returns 보정된 수입
   */
  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    // 기본 구현: 값 그대로 반환
    return amount;
  }

  /**
   * 전략 명령 지연 시간 보정
   * @param baseDelay 기본 지연 시간
   * @returns 보정된 지연 시간
   */
  onCalcStrategicDelay(baseDelay: number): number {
    // 기본 구현: 값 그대로 반환
    return baseDelay;
  }

  /**
   * 계략 성공률 보정
   * @param baseChance 기본 성공률 (0~1)
   * @returns 보정된 성공률
   */
  onCalcStratagemChance(baseChance: number): number {
    // 기본 구현: 값 그대로 반환
    return baseChance;
  }
}

