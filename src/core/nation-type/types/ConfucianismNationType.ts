import { BaseNationType } from '../BaseNationType';

/**
 * ConfucianismNationType (유가)
 * 농상↑ 민심↑ / 쌀수입↓
 */
export class ConfucianismNationType extends BaseNationType {
  protected name: string = '유가';
  static pros: string = '농상↑ 민심↑';
  static cons: string = '쌀수입↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'rice') {
      return amount * 0.9;
    }
    return amount;
  }
}

