/**
 * 밀담 (密談 / Secret Meeting)
 * 밀실 대화. 로그에 남지 않으며 신뢰도가 크게 상승
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class SecretMeetingCommand extends BaseLoghCommand {
  getName(): string {
    return 'secret_meeting';
  }

  getDisplayName(): string {
    return '밀담';
  }

  getDescription(): string {
    return '밀실에서 비밀 대화. 로그에 남지 않으며 신뢰도가 크게 상승합니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 25;
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
      return { success: false, message: '밀담할 대상을 지정하세요.' };
    }

    const target = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: targetNo 
    });
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 같은 진영 확인 (선택적)
    const commanderDoc = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: commander.no 
    });
    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // 밀담 실행
    const result = await SocialInteractionService.conductSecretMeeting(
      commander.session_id,
      commander.no,
      targetNo,
      commanderDoc.stats?.intelligence || 50
    );

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    // 밀담은 공개 메시지에 상세 내용을 표시하지 않음
    return {
      success: result.success,
      message: `${target.name}와(과) 밀담을 나누었습니다.`,
      effects: [{ 
        type: 'secret_meeting', 
        targetNo, 
        // 실제 효과는 숨김 (로그에 안 남음)
        hidden: true 
      }],
    };
  }
}







