import { BaseNationType } from '../BaseNationType';

/**
 * TaoismNationType (도가)
 * 인구↑ / 기술↓ 치안↓
 */
export class TaoismNationType extends BaseNationType {
  protected name: string = '도가';
  static pros: string = '인구↑';
  static cons: string = '기술↓ 치안↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '치안') {
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
}

