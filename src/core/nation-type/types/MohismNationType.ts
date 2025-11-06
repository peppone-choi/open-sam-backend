import { BaseNationType } from '../BaseNationType';

/**
 * MohismNationType (묵가)
 * 수성↑ / 기술↓
 */
export class MohismNationType extends BaseNationType {
  protected name: string = '묵가';
  static pros: string = '수성↑';
  static cons: string = '기술↓';

  onCalcDomestic(turnType: string, varType: 'score' | 'cost', value: number): number {
    if (turnType === '수성' || turnType === '방어') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }
}

