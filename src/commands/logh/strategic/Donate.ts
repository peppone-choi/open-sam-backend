/**
 * 자금 투입 (寄付 / Donate)
 * 사재를 털어 공공 사업 지원. 명성/공적치 환산
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class DonateCommand extends BaseLoghCommand {
  getName(): string {
    return 'donate';
  }

  getDisplayName(): string {
    return '자금 투입';
  }

  getDescription(): string {
    return '사재를 공공 사업에 기부하여 명성과 공적치를 얻습니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 10;
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
    const amount = env?.amount;

    if (!amount || amount <= 0) {
      return { success: false, message: '기부할 금액을 지정하세요.' };
    }

    if (amount < 100) {
      return { success: false, message: '최소 기부 금액은 100입니다.' };
    }

    // 현재 사재 확인
    const currentFunds = await SocialInteractionService.getPersonalFunds(
      commander.session_id,
      commander.no
    );

    if (currentFunds < amount) {
      return { 
        success: false, 
        message: `사재가 부족합니다. (보유: ${currentFunds}, 필요: ${amount})` 
      };
    }

    // 기부 실행
    const result = await SocialInteractionService.donate(
      commander.session_id,
      commander.no,
      amount
    );

    if (result.success) {
      commander.consumeCommandPoints(this.getRequiredCommandPoints());
      await commander.save();
    }

    return {
      success: result.success,
      message: result.message,
      effects: result.effects,
    };
  }
}












