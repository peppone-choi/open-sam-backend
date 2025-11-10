/**
 * 납입률 변경 (納入率変更, Tax Rate)
 * 각 행성/요새로부터 납입되는 세금 비율 변경
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';

export class TaxRateCommand extends BaseLoghCommand {
  getName(): string {
    return 'tax_rate';
  }

  getDisplayName(): string {
    return '납입률 변경';
  }

  getDescription(): string {
    return '각 행성/요새로부터 납입되는 세금 비율 변경';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 320;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터 가져오기
    const planetId = env?.planetId;
    const newTaxRate = env?.taxRate;

    if (!planetId) {
      return {
        success: false,
        message: '세율을 변경할 행성을 지정해주세요.',
      };
    }

    if (newTaxRate === undefined || newTaxRate < 0 || newTaxRate > 100) {
      return {
        success: false,
        message: '세율은 0~100 사이여야 합니다.',
      };
    }

    // 행성 조회
    const planet = await Planet.findOne({
      session_id: commander.session_id,
      planetId,
    });

    if (!planet) {
      return {
        success: false,
        message: '행성을 찾을 수 없습니다.',
      };
    }

    // 아군 행성인지 확인
    if (planet.owner !== commander.getFactionType()) {
      return {
        success: false,
        message: '아군 행성의 세율만 변경할 수 있습니다.',
      };
    }

    // economy 객체가 없으면 초기화
    if (!planet.economy) {
      planet.economy = {
        taxRate: 50,
        treasury: 10000,
        income: 1000,
      };
    }

    // 세율 변경
    const oldTaxRate = planet.economy.taxRate;
    planet.economy.taxRate = newTaxRate;

    // 세율 변경에 따른 충성도 영향
    const taxDiff = newTaxRate - oldTaxRate;
    if (taxDiff > 0) {
      // 세율 증가 -> 충성도 감소
      planet.stats.loyalty = Math.max(0, planet.stats.loyalty - taxDiff * 0.5);
    } else if (taxDiff < 0) {
      // 세율 감소 -> 충성도 증가
      planet.stats.loyalty = Math.min(100, planet.stats.loyalty + Math.abs(taxDiff) * 0.3);
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    planet.markModified('economy');
    planet.markModified('stats');
    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}의 세율을 ${oldTaxRate}%에서 ${newTaxRate}%로 변경했습니다.`,
      effects: [
        {
          type: 'tax_rate_changed',
          planetId,
          planetName: planet.name,
          oldTaxRate,
          newTaxRate,
          loyaltyChange: taxDiff > 0 ? -taxDiff * 0.5 : Math.abs(taxDiff) * 0.3,
        },
      ],
    };
  }
}
