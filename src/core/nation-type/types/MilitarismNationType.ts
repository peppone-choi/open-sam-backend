import { BaseNationType } from '../BaseNationType';

/**
 * MilitarismNationType (병가)
 * 기술↑ 수성↑ / 인구↓ 민심↓
 */
export class MilitarismNationType extends BaseNationType {
  protected name: string = '병가';
  static pros: string = '기술↑ 수성↑';
  static cons: string = '인구↓ 민심↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'pop' && amount > 0) {
      return amount * 0.8;
    }
    return amount;
  }
}

