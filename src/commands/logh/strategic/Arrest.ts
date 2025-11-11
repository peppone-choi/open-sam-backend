/**
 * 체포 (Arrest)
 * 특정 캐릭터 체포
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint } from '../../../utils/logh-rank-system';

export class ArrestCommand extends BaseLoghCommand {
  getName(): string {
    return 'arrest';
  }

  getDisplayName(): string {
    return '체포';
  }

  getDescription(): string {
    return '특정 캐릭터 체포';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 30;
  }

  getRequiredTurns(): number {
    return 30;
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

    const targetCommanderNo = env?.targetCommanderNo;
    if (!targetCommanderNo) {
      return { success: false, message: '체포할 대상을 지정해주세요.' };
    }

    const targetCommander = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: targetCommanderNo,
    });

    if (!targetCommander) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    if (targetCommander.faction !== commander.getFactionType()) {
      return { success: false, message: '같은 세력만 체포할 수 있습니다.' };
    }

    if (!canAppoint(commander.getRank(), targetCommander.getRankName(), targetCommander.faction)) {
      return { success: false, message: '자신보다 계급이 높은 사람은 체포할 수 없습니다.' };
    }

    targetCommander.status = 'imprisoned';
    targetCommander.fleetId = null;

    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}을(를) 체포했습니다.`,
      effects: [{ type: 'arrest', targetNo: targetCommanderNo }],
    };
  }
}
