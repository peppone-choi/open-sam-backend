/**
 * 장수 성격 시스템 - 기본 클래스
 * PHP core/hwe/sammo/ActionPersonality/*.php 기반
 * 
 * 성격은 장수의 기본 성향을 나타내며, 스탯 및 내정에 영향을 줍니다.
 */

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 스탯 계산 컨텍스트
 */
export interface IStatCalcContext {
  statName: string;
  baseValue: number;
  aux?: any;
}

/**
 * 내정 계산 컨텍스트
 */
export interface IDomesticCalcContext {
  turnType: string;    // '농업', '상업', '징병', '모병' 등
  varType: string;     // 'score', 'cost', 'success'
  baseValue: number;
  aux?: any;
}

// ============================================================================
// 성격 기본 클래스
// ============================================================================

/**
 * 성격 기본 클래스
 * 모든 성격은 이 클래스를 상속
 */
export abstract class PersonalityBase {
  /** 성격 고유 ID */
  abstract readonly id: number;

  /** 성격 이름 */
  abstract readonly name: string;

  /** 성격 설명 */
  abstract readonly info: string;

  /**
   * 스탯 계산 시 호출
   * @param ctx 스탯 계산 컨텍스트
   * @returns 수정된 값
   */
  onCalcStat(ctx: IStatCalcContext): number {
    return ctx.baseValue;
  }

  /**
   * 내정 계산 시 호출
   * @param ctx 내정 계산 컨텍스트
   * @returns 수정된 값
   */
  onCalcDomestic(ctx: IDomesticCalcContext): number {
    return ctx.baseValue;
  }

  /**
   * 성격 정보를 JSON으로 반환
   */
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      info: this.info,
    };
  }

  /**
   * 디버그용 문자열
   */
  toString(): string {
    return `[성격] ${this.name}: ${this.info}`;
  }
}










