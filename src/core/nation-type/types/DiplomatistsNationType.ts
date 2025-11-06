import { BaseNationType } from '../BaseNationType';

/**
 * DiplomatistsNationType (종횡가)
 * 전략↑ 수성↑ / 금수입↓ 농상↓
 */
export class DiplomatistsNationType extends BaseNationType {
  protected name: string = '종횡가';
  static pros: string = '전략↑ 수성↑';
  static cons: string = '금수입↓ 농상↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '농업' || turnType === '상업') {
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

  onCalcStrategicDelay(baseDelay: number): number {
    // 전략 명령 지연 시간 단축 (75%로)
    return baseDelay * 0.75;
  }
}

