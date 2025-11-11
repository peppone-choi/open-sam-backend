/**
 * 지원 (Volunteer)
 * 정치가를 은퇴하고 군인이 됨. 계급은 소좌, 기함은 전함으로 변경
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class VolunteerCommand extends BaseLoghCommand {
  getName(): string {
    return 'volunteer';
  }

  getDisplayName(): string {
    return '지원';
  }

  getDescription(): string {
    return '정치가를 은퇴하고 군인이 됨. 계급은 소좌, 기함은 전함으로 변경';
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
    const { commander, env } = context;

    const { LoghCommander } = await import('../../../models/logh/Commander.model');
    const commanderDoc = await LoghCommander.findOne({ session_id: commander.session_id, no: commander.no });
    if (!commanderDoc) return { success: false, message: '커맨더를 찾을 수 없습니다.' };

    if (!commanderDoc.customData?.retired) {
      return { success: false, message: '퇴역한 상태가 아닙니다.' };
    }

    delete commanderDoc.customData.retired;
    delete commanderDoc.customData.retiredAt;
    commanderDoc.setRankByName('이등병');
    commanderDoc.jobPosition = null;

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `군에 재입대했습니다. 현역으로 복귀합니다.`,
      effects: [{ type: 'volunteer' }],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
