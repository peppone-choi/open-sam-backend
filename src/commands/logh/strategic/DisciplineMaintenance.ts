/**
 * 군기 유지 (軍紀維持, Discipline Maintenance)
 * 군기 유지도를 증가시켜 혼란 발생률 저하
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';

export class DisciplineMaintenanceCommand extends BaseLoghCommand {
  getName(): string {
    return 'discipline_maintenance';
  }

  getDisplayName(): string {
    return '군기 유지';
  }

  getDescription(): string {
    return '군기 유지도를 증가시켜 혼란 발생률 저하';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0; // 즉시 실행
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
    ];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return {
        success: false,
        message: '함대를 보유하지 않았습니다.',
      };
    }

    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 이미 최대치인지 확인
    if (fleet.training.discipline >= 100) {
      return {
        success: false,
        message: '군기 유지도가 이미 최대치입니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 군기 유지도 증가 (5~10 랜덤)
    const increase = Math.floor(Math.random() * 6) + 5;
    const beforeDiscipline = fleet.training.discipline;
    fleet.training.discipline = Math.min(100, fleet.training.discipline + increase);

    fleet.markModified('training');
    await fleet.save();
    await commander.save();

    return {
      success: true,
      message: `군기 유지 훈련을 실시했습니다. 군기 유지도 ${beforeDiscipline} → ${fleet.training.discipline}`,
      effects: [
        {
          type: 'training_improved',
          trainingType: 'discipline',
          before: beforeDiscipline,
          after: fleet.training.discipline,
          increase,
        },
      ],
    };
  }
}
