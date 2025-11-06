import { BaseNationType } from '../BaseNationType';

/**
 * VirtueNationType (덕가)
 * 치안↑ 인구↑ 민심↑ / 쌀수입↓ 수성↓
 */
export class VirtueNationType extends BaseNationType {
  protected name: string = '덕가';
  static pros: string = '치안↑ 인구↑ 민심↑';
  static cons: string = '쌀수입↓ 수성↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '치안') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'rice') {
      return amount * 0.9;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }
}

