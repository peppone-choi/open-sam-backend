/**
 * 육전 훈련 (陸戦訓練)
 * 육전 훈련도 증가
 * 훈련도 증가 시 숙련도 레벨도 자동 갱신
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';
import {
  updateFleetExperience,
  calculateTrainingIncrease,
  EXPERIENCE_LEVEL_NAMES,
} from '../../../services/logh/TrainingSystem';

export class GroundTrainingCommand extends BaseLoghCommand {
  getName(): string {
    return 'ground_training';
  }

  getDisplayName(): string {
    return '육전 훈련';
  }

  getDescription(): string {
    return '육전 훈련도 증가';
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
    if (fleet.training.ground >= 100) {
      return {
        success: false,
        message: '육전 훈련도가 이미 최대치입니다.',
      };
    }

    // Commander 스탯 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 훈련도 증가 계산 (커맨더 스탯에 따른 보너스 적용)
    const increase = calculateTrainingIncrease('ground', {
      command: commanderDoc?.stats?.command || 50,
      leadership: commanderDoc?.stats?.leadership || 50,
    });

    const beforeTraining = fleet.training.ground;
    fleet.training.ground = Math.min(100, fleet.training.ground + increase);

    // 숙련도 레벨 업데이트
    const { oldLevel, newLevel, levelChanged } = updateFleetExperience(fleet);

    fleet.markModified('training');
    await fleet.save();
    await commander.save();

    let message = `육전 훈련을 실시했습니다. 육전 훈련도 ${beforeTraining} → ${fleet.training.ground}`;

    const effects: any[] = [
      {
        type: 'training_improved',
        trainingType: 'ground',
        before: beforeTraining,
        after: fleet.training.ground,
        increase,
      },
    ];

    // 숙련도 레벨 변경 시 메시지 추가
    if (levelChanged) {
      const oldLevelName = EXPERIENCE_LEVEL_NAMES[oldLevel];
      const newLevelName = EXPERIENCE_LEVEL_NAMES[newLevel];
      message += ` 숙련도 레벨 상승! (${oldLevelName} → ${newLevelName})`;

      effects.push({
        type: 'experience_level_up',
        oldLevel,
        newLevel,
        oldLevelName,
        newLevelName,
      });
    }

    return {
      success: true,
      message,
      effects,
    };
  }
}
