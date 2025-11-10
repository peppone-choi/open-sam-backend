/**
 * 반의 (Rebellion Intention)
 * 쿠데타의 주모자가 됨 - 반란 깃발을 들어 다른 커맨더를 모집
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { getRankIndex } from '../../../utils/logh-rank-system';

export class RebellionIntentionCommand extends BaseLoghCommand {
  getName(): string {
    return 'rebellion_intention';
  }

  getDisplayName(): string {
    return '반의';
  }

  getDescription(): string {
    return '쿠데타의 주모자가 됨';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 640;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 고위 계급만 가능
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          const rankIndex = getRankIndex(input.commander.getRank(), input.commander.getFactionType());
          return rankIndex >= 15; // 少将(15) 이상
        },
        '반란은 少将 이상의 계급에서만 가능합니다.'
      )
    );

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

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

    // 이미 반란 상태인지 확인
    if (commanderDoc.customData?.rebellionLeader) {
      return {
        success: false,
        message: '이미 반란을 일으켰습니다.',
      };
    }

    // 반란 깃발 설정
    if (!commanderDoc.customData) {
      commanderDoc.customData = {};
    }
    
    commanderDoc.customData.rebellionLeader = true;
    commanderDoc.customData.rebellionStartDate = new Date();
    commanderDoc.customData.rebellionFollowers = []; // 반란에 가담한 커맨더들

    // 직책 변경
    commanderDoc.jobPosition = '반란군 총사령관';

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `${commanderDoc.name}이(가) 반란의 깃발을 들었습니다! 다른 커맨더들이 합류할 수 있습니다.`,
      effects: [
        {
          type: 'rebellion_intention',
          commanderNo: commander.no,
          commanderName: commanderDoc.name,
          faction: commanderDoc.faction,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
