/**
 * 이동 명령
 * 유닛을 목표 위치로 이동
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { JosaUtil } from '../../func/josaUtil';
import { getCrewCombatTraits } from '../crews/CrewTypeCombat';

export class MoveCommand extends BattleCommand {
  readonly type = BattleCommandType.MOVE;
  readonly name = '이동';
  readonly description = '지정한 위치로 이동합니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, targetPosition, battleContext, rng } = ctx;
    const logs: string[] = [];

    // 위치 검증
    if (!targetPosition) {
      return {
        success: false,
        logs: [],
        failReason: '이동 목표 위치가 없습니다'
      };
    }

    // 병종별 이동력 확인
    const traits = getCrewCombatTraits(executor.unit.armType);
    const baseMovePoints = traits?.baseMovePoints ?? 7;

    // 지형에 따른 이동력 수정
    const terrainModifier = traits?.terrainModifiers[battleContext.terrain] ?? 1.0;
    const effectiveMovePoints = Math.round(baseMovePoints * terrainModifier);

    // 현재 위치와 목표 위치 거리 계산 (간단한 맨해튼 거리)
    const currentPos = executor.position ?? { x: 0, y: 0 };
    const distance = Math.abs(targetPosition.x - currentPos.x) + Math.abs(targetPosition.y - currentPos.y);

    // 이동 가능 여부 확인
    if (distance > effectiveMovePoints) {
      return {
        success: false,
        logs: [],
        failReason: `이동 거리가 너무 멉니다 (거리: ${distance}, 이동력: ${effectiveMovePoints})`
      };
    }

    // 이동 실행
    const oldPos = { ...currentPos };
    executor.position = { ...targetPosition };

    // 군량 소모 (이동 거리에 비례)
    const riceConsumed = Math.round(distance * 0.5 * (executor.hp / 1000));
    executor.rice = Math.max(0, executor.rice - riceConsumed);

    // 이동 중 매복 감지 확률 (향후 확장)
    const ambushDetected = rng.nextBool(0.1);

    // 로그 생성
    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} (${oldPos.x},${oldPos.y})에서 (${targetPosition.x},${targetPosition.y})로 이동했습니다.`);

    if (riceConsumed > 0) {
      logs.push(`군량 ${riceConsumed} 소모`);
    }

    return {
      success: true,
      logs,
      data: {
        oldPosition: oldPos,
        newPosition: targetPosition,
        distance,
        riceConsumed,
        ambushDetected
      }
    };
  }
}
