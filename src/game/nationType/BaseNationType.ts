/**
 * 국가유형 베이스 클래스
 * PHP 대응: sammo/BaseNation.php
 */

export abstract class BaseNationType {
  /** 국가유형 ID (예: 'che_유가') */
  abstract get id(): string;

  /** 국가유형 이름 */
  abstract getName(): string;

  /** 장점 설명 */
  abstract getPros(): string;

  /** 단점 설명 */
  abstract getCons(): string;

  /** 상세 정보 */
  getInfo(): string {
    return '';
  }

  /**
   * 내정 계산 후크
   * @param turnType 턴 유형 (농업, 상업, 기술, 치안, 민심, 인구, 수비, 성벽)
   * @param varType 변수 유형 (score, cost)
   * @param value 원본 값
   * @param aux 추가 데이터
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }

  /**
   * 국가 수입 계산 후크
   * @param type 수입 유형 (gold, rice, pop)
   * @param amount 원본 수량
   */
  onCalcNationalIncome(type: string, amount: number): number {
    return amount;
  }

  /**
   * 전략 계산 후크
   * @param turnType 전략 유형
   * @param varType 변수 유형 (delay, globalDelay, success)
   * @param value 원본 값
   */
  onCalcStrategic(turnType: string, varType: string, value: number): number {
    return value;
  }
}
