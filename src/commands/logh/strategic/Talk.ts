/**
 * 담화 (談話)
 * 특정 인물을 자신이 체류하는 호텔 객실에 초대해 담화. 담화 성과에 따라 초대객과의 우호도 및 영향력 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class TalkCommand extends BaseLoghCommand {
  getName(): string {
    return 'talk';
  }

  getDisplayName(): string {
    return '담화';
  }

  getDescription(): string {
    return '특정 인물을 자신이 체류하는 호텔 객실에 초대해 담화. 담화 성과에 따라 초대객과의 우호도 및 영향력 변화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 20;
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

    if (!targetNo) {
      return { success: false, message: '담화할 대상을 지정하세요.' };
    }

    const target = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: targetNo 
    });
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    const commanderDoc = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: commander.no 
    });
    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // 담화 실행
    const result = await SocialInteractionService.conductTalk(
      commander.session_id,
      commander.no,
      targetNo,
      commanderDoc.stats?.politics || 50,
      commanderDoc.stats?.leadership || 50
    );

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: result.success,
      message: `${target.name}와(과) ${result.message}`,
      effects: [{ 
        type: 'talk', 
        targetNo, 
        targetName: target.name,
        friendshipChange: result.friendshipChange 
      }],
    };
  }
}
