import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class MeetingCommand extends BaseLoghCommand {
  getName() { return 'meeting'; }
  getDisplayName() { return '회견'; }
  getDescription() { return '동일 스포트에 체류하는 인물과 회견하여 우호도 상승'; }
  getCategory() { return 'admin' as const; }
  getRequiredCommandPoints() { return 10; }
  getRequiredTurns() { return 0; }
  getCPType() { return 'PCP' as const; }
  getConstraints(): IConstraint[] { return []; }

  async execute(context: ILoghCommandContext) {
    const { commander, env } = context;
    const targetNo = env?.targetCommanderNo;
    if (!targetNo) return { success: false, message: '회견할 대상을 지정하세요.' };

    const target = await LoghCommander.findOne({ session_id: commander.session_id, no: targetNo });
    if (!target) return { success: false, message: '대상을 찾을 수 없습니다.' };

    const commanderDoc = await LoghCommander.findOne({ session_id: commander.session_id, no: commander.no });
    if (!commanderDoc) return { success: false, message: '커맨더를 찾을 수 없습니다.' };

    if (!commanderDoc.customData) commanderDoc.customData = {};
    if (!commanderDoc.customData.friendships) commanderDoc.customData.friendships = {};
    
    const currentFriendship = commanderDoc.customData.friendships[targetNo] || 0;
    commanderDoc.customData.friendships[targetNo] = Math.min(100, currentFriendship + 10);

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `${target.name}과(와) 회견했습니다. 우호도: ${commanderDoc.customData.friendships[targetNo]}`,
      effects: [{ type: 'meeting', targetNo, friendship: commanderDoc.customData.friendships[targetNo] }],
    };
  }
}
