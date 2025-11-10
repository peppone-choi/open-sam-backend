/**
 * 항주 훈련 (航宙訓練)
 * 부대 항주 훈련도 증가
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';

export class SpaceTrainingCommand extends BaseLoghCommand {
  getName(): string {
    return 'space_training';
  }

  getDisplayName(): string {
    return '항주 훈련';
  }

  getDescription(): string {
    return '부대 항주 훈련도 증가';
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
    if (fleet.training.space >= 100) {
      return {
        success: false,
        message: '항주 훈련도가 이미 최대치입니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 훈련도 증가 (5~10 랜덤)
    const increase = Math.floor(Math.random() * 6) + 5;
    const beforeTraining = fleet.training.space;
    fleet.training.space = Math.min(100, fleet.training.space + increase);

    fleet.markModified('training');
    await fleet.save();
    await commander.save();

    return {
      success: true,
      message: `항주 훈련을 실시했습니다. 항주 훈련도 ${beforeTraining} → ${fleet.training.space}`,
      effects: [
        {
          type: 'training_improved',
          trainingType: 'space',
          before: beforeTraining,
          after: fleet.training.space,
          increase,
        },
      ],
    };
  }
}
