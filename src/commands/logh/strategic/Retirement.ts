/**
 * 퇴역 (Retirement)
 * 군을 물러나 정치가가 됨. 퇴역 후 30G일간 지원 커맨드 사용 불가
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class RetirementCommand extends BaseLoghCommand {
  getName(): string {
    return 'retirement';
  }

  getDisplayName(): string {
    return '퇴역';
  }

  getDescription(): string {
    return '군을 물러나 정치가가 됨. 퇴역 후 30G일간 지원 커맨드 사용 불가';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;
    const { LoghCommander } = await import('../../../models/logh/Commander.model');
    const { Fleet } = await import('../../../models/logh/Fleet.model');

    const commanderDoc = await LoghCommander.findOne({ session_id: commander.session_id, no: commander.no });
    if (!commanderDoc) return { success: false, message: '커맨더를 찾을 수 없습니다.' };

    if (commanderDoc.fleetId) {
      const fleet = await Fleet.findOne({ session_id: commander.session_id, fleetId: commanderDoc.fleetId });
      if (fleet) {
        fleet.commanderId = undefined;
        fleet.commanderName = '무소속';
        await fleet.save();
      }
      commanderDoc.fleetId = null;
    }

    const oldRank = commanderDoc.rank;
    commanderDoc.setRankByName('이등병');
    commanderDoc.jobPosition = '정치가';
    if (!commanderDoc.customData) commanderDoc.customData = {};
    commanderDoc.customData.retired = true;
    commanderDoc.customData.retiredAt = new Date();

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `군을 퇴역하고 정치가가 되었습니다. (${oldRank} → 정치가)`,
      effects: [{ type: 'retirement', oldRank }],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
