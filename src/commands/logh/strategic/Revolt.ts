/**
 * 반란 (Revolt)
 * 반란군에 합류하거나 독자적으로 반란 실행
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Fleet } from '../../../models/logh/Fleet.model';

export class RevoltCommand extends BaseLoghCommand {
  getName(): string {
    return 'revolt';
  }

  getDisplayName(): string {
    return '반란';
  }

  getDescription(): string {
    return '쿠데타 실행';
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

    // 함대 보유 필수
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '반란을 위해서는 함대가 필요합니다.'
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

    // 합류할 반란 주모자 지정 (선택)
    const rebellionLeaderNo = env?.rebellionLeaderNo;

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

    // 함대 조회
    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId: commanderDoc.fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    let message = '';
    let rebellionLeader = null;

    // 반란 주모자에게 합류하는 경우
    if (rebellionLeaderNo) {
      rebellionLeader = await LoghCommander.findOne({
        session_id: commander.session_id,
        no: rebellionLeaderNo,
      });

      if (!rebellionLeader || !rebellionLeader.customData?.rebellionLeader) {
        return {
          success: false,
          message: '해당 커맨더는 반란 주모자가 아닙니다.',
        };
      }

      if (rebellionLeader.faction !== commanderDoc.faction) {
        return {
          success: false,
          message: '같은 세력의 반란에만 합류할 수 있습니다.',
        };
      }

      // 반란군에 합류
      if (!rebellionLeader.customData.rebellionFollowers) {
        rebellionLeader.customData.rebellionFollowers = [];
      }
      rebellionLeader.customData.rebellionFollowers.push({
        no: commanderDoc.no,
        name: commanderDoc.name,
        fleetSize: fleet.totalShips,
        joinedAt: new Date(),
      });

      rebellionLeader.markModified('customData');
      await rebellionLeader.save();

      message = `${rebellionLeader.name}의 반란군에 합류했습니다!`;
    } else {
      // 독자적으로 반란 실행
      message = `독자적으로 반란을 일으켰습니다!`;
    }

    // 반란 상태 설정
    if (!commanderDoc.customData) {
      commanderDoc.customData = {};
    }
    commanderDoc.customData.inRebellion = true;
    commanderDoc.customData.rebellionJoinedAt = new Date();
    if (rebellionLeaderNo) {
      commanderDoc.customData.rebellionLeaderNo = rebellionLeaderNo;
    }

    // 사기 변화 (반란은 위험하지만 사기를 높일 수 있음)
    fleet.morale = Math.min(100, fleet.morale + 20);

    // 함대 이름 변경
    fleet.name = `${commanderDoc.name}의 반란군`;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await fleet.save();
    await commander.save();

    return {
      success: true,
      message,
      effects: [
        {
          type: 'revolt',
          commanderNo: commander.no,
          rebellionLeaderNo,
          fleetSize: fleet.totalShips,
          morale: fleet.morale,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
