/**
 * 로비 (Lobby)
 * 사재를 사용하여 특정 인물에게 인사 청탁 등의 로비 활동
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class LobbyCommand extends BaseLoghCommand {
  getName(): string {
    return 'lobby';
  }

  getDisplayName(): string {
    return '로비';
  }

  getDescription(): string {
    return '사재를 사용하여 특정 인물에게 로비 활동을 합니다. 성공 시 우호도가 크게 상승합니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 30;
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
    const targetNo = env?.targetCommanderNo;
    const amount = env?.amount;
    const purpose = env?.purpose || '일반 로비';

    if (!targetNo) {
      return { success: false, message: '로비 대상을 지정하세요.' };
    }

    if (!amount || amount <= 0) {
      return { success: false, message: '로비 자금을 지정하세요.' };
    }

    if (amount < 500) {
      return { success: false, message: '최소 로비 자금은 500입니다.' };
    }

    const target = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: targetNo 
    });
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 자기 자신에게 로비 불가
    if (targetNo === commander.no) {
      return { success: false, message: '자기 자신에게는 로비할 수 없습니다.' };
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

    // 로비 실행
    const result = await SocialInteractionService.lobby(
      commander.session_id,
      commander.no,
      targetNo,
      amount,
      purpose
    );

    // 실패해도 자금은 소모되므로 CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: result.success,
      message: `${target.name}에게 로비 시도: ${result.message}`,
      effects: result.effects,
    };
  }
}







