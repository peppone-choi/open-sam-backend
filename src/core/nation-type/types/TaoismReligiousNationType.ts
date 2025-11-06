import { BaseNationType } from '../BaseNationType';

/**
 * TaoismReligiousNationType (오두미도)
 * 쌀수입↑ 인구↑ / 기술↓ 수성↓ 농상↓
 */
export class TaoismReligiousNationType extends BaseNationType {
  protected name: string = '오두미도';
  static pros: string = '쌀수입↑ 인구↑';
  static cons: string = '기술↓ 수성↓ 농상↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'rice') {
      return amount * 1.1;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }
}

