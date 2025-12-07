/**
 * 야회 (夜会)
 * 특정 인물을 자신의 수도 저택에 초대해 야회. 야회 성과에 따라 영향력 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class SoireeCommand extends BaseLoghCommand {
  getName(): string {
    return 'soiree';
  }

  getDisplayName(): string {
    return '야회';
  }

  getDescription(): string {
    return '특정 인물을 자신의 수도 저택에 초대해 야회. 야회 성과에 따라 영향력 변화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 50;
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
    const inviteeNos: number[] = env?.inviteeNos || [];

    if (inviteeNos.length === 0) {
      return { success: false, message: '야회에 초대할 인물을 지정하세요.' };
    }

    if (inviteeNos.length > 10) {
      return { success: false, message: '야회 초대 인원은 최대 10명입니다.' };
    }

    const commanderDoc = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: commander.no 
    });
    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // 초대 대상 확인
    const invitees = await LoghCommander.find({
      session_id: commander.session_id,
      no: { $in: inviteeNos },
    });

    if (invitees.length === 0) {
      return { success: false, message: '유효한 초대 대상이 없습니다.' };
    }

    // 야회 실행
    const result = await SocialInteractionService.hostParty(
      commander.session_id,
      commander.no,
      invitees.map(i => i.no),
      commanderDoc.stats?.politics || 50,
      commanderDoc.fame || 0
    );

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    const inviteeNames = invitees.map(i => i.name).join(', ');

    return {
      success: result.success,
      message: result.message + ` (초대: ${inviteeNames})`,
      effects: result.effects,
    };
  }
}
