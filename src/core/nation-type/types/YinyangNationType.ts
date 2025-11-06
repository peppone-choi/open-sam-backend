import { BaseNationType } from '../BaseNationType';

/**
 * YinyangNationType (음양가)
 * 농상↑ 인구↑ / 기술↓ 전략↓
 */
export class YinyangNationType extends BaseNationType {
  protected name: string = '음양가';
  static pros: string = '농상↑ 인구↑';
  static cons: string = '기술↓ 전략↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }

  onCalcStrategicDelay(baseDelay: number): number {
    // 전략 명령 지연 시간 증가 (133%로)
    return baseDelay * 1.33;
  }
}

