import { BaseNationType } from '../BaseNationType';

/**
 * LegalismNationType (법가)
 * 금수입↑ 치안↑ / 인구↓ 민심↓
 */
export class LegalismNationType extends BaseNationType {
  protected name: string = '법가';
  static pros: string = '금수입↑ 치안↑';
  static cons: string = '인구↓ 민심↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '치안') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'gold') {
      return amount * 1.1;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 0.8;
    }
    return amount;
  }
}

