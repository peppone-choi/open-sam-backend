/**
 * 자금 투입 (Fund Investment)
 * 사적 계좌에서 자금 투입하여 행성 개발 또는 충성도 향상
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class FundInvestmentCommand extends BaseLoghCommand {
  getName(): string {
    return 'fund_investment';
  }

  getDisplayName(): string {
    return '자금 투입';
  }

  getDescription(): string {
    return '사적 계좌에서 자금 투입. 지방자금고/신임박스/지지박스';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터 가져오기
    const planetId = env?.planetId;
    const amount = env?.amount || 0;
    const investmentType = env?.investmentType || 'loyalty'; // 'loyalty', 'industry', 'technology'

    if (!planetId) {
      return {
        success: false,
        message: '투자할 행성을 지정해주세요.',
      };
    }

    if (amount <= 0) {
      return {
        success: false,
        message: '투자 금액은 0보다 커야 합니다.',
      };
    }

    // Commander 문서 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc) {
      return {
        success: false,
        message: '커맨더 정보를 찾을 수 없습니다.',
      };
    }

    // 개인 자금 확인
    if ((commanderDoc.personalFunds || 0) < amount) {
      return {
        success: false,
        message: `개인 자금이 부족합니다. (필요: ${amount}, 보유: ${commanderDoc.personalFunds || 0})`,
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

    // 개인 자금 차감
    commanderDoc.personalFunds = (commanderDoc.personalFunds || 0) - amount;

    let effect = '';
    let effectValue = 0;

    // 투자 유형에 따른 처리
    switch (investmentType) {
      case 'loyalty':
        // 충성도 향상 (금액의 0.01% 만큼)
        effectValue = Math.min(100, planet.stats.loyalty + amount * 0.0001);
        planet.stats.loyalty = effectValue;
        effect = '충성도';
        break;

      case 'industry':
        // 공업력 향상
        effectValue = Math.min(100, planet.stats.industry + amount * 0.00005);
        planet.stats.industry = effectValue;
        effect = '공업력';
        break;

      case 'technology':
        // 기술력 향상
        effectValue = Math.min(100, planet.stats.technology + amount * 0.00005);
        planet.stats.technology = effectValue;
        effect = '기술력';
        break;

      case 'treasury':
        // 행성 재정 직접 투입
        if (!planet.economy) {
          planet.economy = { taxRate: 50, treasury: 10000, income: 1000 };
        }
        planet.economy.treasury += amount;
        effectValue = planet.economy.treasury;
        effect = '재정';
        break;

      default:
        return {
          success: false,
          message: '잘못된 투자 유형입니다.',
        };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    planet.markModified('stats');
    planet.markModified('economy');
    await planet.save();
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}에 ${amount} 크레딧을 투자하여 ${effect}을(를) 향상시켰습니다.`,
      effects: [
        {
          type: 'fund_investment',
          planetId,
          planetName: planet.name,
          amount,
          investmentType,
          effect,
          effectValue,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
