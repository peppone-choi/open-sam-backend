/**
 * 설득 (Persuasion)
 * 소속 부대에 배치된 유닛의 반란 충성도 상승
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class PersuasionCommand extends BaseLoghCommand {
  getName(): string {
    return 'persuasion';
  }

  getDisplayName(): string {
    return '설득';
  }

  getDescription(): string {
    return '소속 부대에 배치된 유닛의 반란 충성도 상승';
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

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;
    const { Fleet } = await import('../../../models/logh/Fleet.model');

    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return { success: false, message: '함대를 보유하지 않았습니다.' };
    }

    const fleet = await Fleet.findOne({ session_id: commander.session_id, fleetId });
    if (!fleet) {
      return { success: false, message: '함대를 찾을 수 없습니다.' };
    }

    // 함대의 사기와 군기 상승
    fleet.morale = Math.min(100, fleet.morale + 15);
    fleet.training.discipline = Math.min(100, fleet.training.discipline + 10);

    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await fleet.save();
    await commander.save();

    return {
      success: true,
      message: `${fleet.name} 부대원들을 설득했습니다. 사기 및 군기 상승!`,
      effects: [
        { type: 'persuasion', fleetId, morale: fleet.morale, discipline: fleet.training.discipline },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
