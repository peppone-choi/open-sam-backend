import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class JoinCommand extends BaseLoghCommand {
  getName() { return 'join'; }
  getDisplayName() { return '참가'; }
  getDescription() { return '참가 교섭에 동의한 쿠데타에 참가'; }
  getCategory() { return 'admin' as const; }
  getRequiredCommandPoints() { return 160; }
  getRequiredTurns() { return 0; }
  getCPType() { return 'PCP' as const; }
  getConstraints(): IConstraint[] { return []; }

  async execute(context: ILoghCommandContext) {
    const { commander, env } = context;
    const leaderNo = env?.rebellionLeaderNo;
    if (!leaderNo) return { success: false, message: '참가할 쿠데타 주모자를 지정하세요.' };

    const leader = await LoghCommander.findOne({ session_id: commander.session_id, no: leaderNo });
    if (!leader || !leader.customData?.rebellionLeader) {
      return { success: false, message: '쿠데타 주모자가 아닙니다.' };
    }

    const commanderDoc = await LoghCommander.findOne({ session_id: commander.session_id, no: commander.no });
    if (!commanderDoc) return { success: false, message: '커맨더를 찾을 수 없습니다.' };

    if (!leader.customData.rebellionFollowers) leader.customData.rebellionFollowers = [];
    leader.customData.rebellionFollowers.push({
      no: commanderDoc.no,
      name: commanderDoc.name,
      joinedAt: new Date(),
    });

    if (!commanderDoc.customData) commanderDoc.customData = {};
    commanderDoc.customData.joinedRebellion = true;
    commanderDoc.customData.rebellionLeaderNo = leaderNo;

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    leader.markModified('customData');
    commanderDoc.markModified('customData');
    await leader.save();
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `${leader.name}의 쿠데타에 참가했습니다.`,
      effects: [{ type: 'join_rebellion', leaderNo }],
    };
  }
}
