import { BaseNationType } from '../BaseNationType';

/**
 * TaipingNationType (태평도)
 * 인구↑ 민심↑ / 기술↓ 수성↓
 */
export class TaipingNationType extends BaseNationType {
  protected name: string = '태평도';
  static pros: string = '인구↑ 민심↑';
  static cons: string = '기술↓ 수성↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '수성' || turnType === '방어') {
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

