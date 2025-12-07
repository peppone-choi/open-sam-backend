/**
 * 수렵 (狩猟)
 * 특정 인물을 자신의 봉토 행성 저택에 초대해 수렵. 수렵 결과에 따라 영향력과 초대객과의 우호도 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class HuntingCommand extends BaseLoghCommand {
  getName(): string {
    return 'hunting';
  }

  getDisplayName(): string {
    return '수렵';
  }

  getDescription(): string {
    return '특정 인물을 자신의 봉토 행성 저택에 초대해 수렵. 수렵 결과에 따라 영향력과 초대객과의 우호도 변화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 40;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
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
      return { success: false, message: '수렵에 초대할 인물을 지정하세요.' };
    }

    if (inviteeNos.length > 5) {
      return { success: false, message: '수렵 초대 인원은 최대 5명입니다.' };
    }

    const commanderDoc = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: commander.no 
    });
    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // TODO: 봉토(영지) 소유 여부 확인
    // 현재는 제약 없이 실행

    // 초대 대상 확인
    const invitees = await LoghCommander.find({
      session_id: commander.session_id,
      no: { $in: inviteeNos },
    });

    if (invitees.length === 0) {
      return { success: false, message: '유효한 초대 대상이 없습니다.' };
    }

    // 수렵 실행
    const result = await SocialInteractionService.hostHunting(
      commander.session_id,
      commander.no,
      invitees.map(i => i.no),
      commanderDoc.stats?.command || 50,
      commanderDoc.stats?.maneuver || 50
    );

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    const inviteeNames = invitees.map(i => i.name).join(', ');

    return {
      success: result.success,
      message: result.message + ` (참가자: ${inviteeNames})`,
      effects: result.effects,
    };
  }
}
