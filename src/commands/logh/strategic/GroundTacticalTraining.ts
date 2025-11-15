/**
 * 육전 전술 훈련 (Ground Tactical Training)
 * 육전 전술 스킬 습득
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class GroundTacticalTrainingCommand extends BaseLoghCommand {
  getName(): string {
    return 'ground_tactical_training';
  }

  getDisplayName(): string {
    return '육전 전술 훈련';
  }

  getDescription(): string {
    return '육전 전술 스킬 습득';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
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

    const oldAttack = commanderDoc.stats.attack;
    commanderDoc.stats.attack = Math.min(100, oldAttack + 3);
    if (!commanderDoc.customData) commanderDoc.customData = {};
    if (!commanderDoc.customData.tacticalSkills) commanderDoc.customData.tacticalSkills = [];
    if (!commanderDoc.customData.tacticalSkills.includes('ground_combat')) {
      commanderDoc.customData.tacticalSkills.push('ground_combat');
    }

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    commanderDoc.markModified('stats');
    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `육전 전술 훈련 완료! 공격력: ${oldAttack} → ${commanderDoc.stats.attack}`,
      effects: [{ type: 'ground_tactical_training', oldAttack, newAttack: commanderDoc.stats.attack }],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
