import { BaseNationType } from '../BaseNationType';

/**
 * BanditsNationType (도적)
 * 계략↑ / 금수입↓ 치안↓ 민심↓
 */
export class BanditsNationType extends BaseNationType {
  protected name: string = '도적';
  static pros: string = '계략↑';
  static cons: string = '금수입↓ 치안↓ 민심↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '치안') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  onCalcNationalIncome(type: 'gold' | 'rice' | 'pop', amount: number): number {
    if (type === 'gold') {
      return amount * 0.9;
    }
    return amount;
  }

  onCalcStratagemChance(baseChance: number): number {
    // 계략 성공률 10% 증가
    return Math.min(1.0, baseChance + 0.1);
  }
}

