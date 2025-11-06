import { BaseNationType } from '../BaseNationType';

/**
 * BuddhismNationType (불가)
 * 민심↑ 수성↑ / 금수입↓
 */
export class BuddhismNationType extends BaseNationType {
  protected name: string = '불가';
  static pros: string = '민심↑ 수성↑';
  static cons: string = '금수입↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'gold') {
      return amount * 0.9;
    }
    return amount;
  }
}

