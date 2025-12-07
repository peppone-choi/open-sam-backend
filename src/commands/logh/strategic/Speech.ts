/**
 * 연설 (演説)
 * 행성/요새 중앙광장에서 연설. 연설 성과에 따라 영향력과 해당 행성/요새 정부 지지율 증감
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';
import { SocialInteractionService } from '../../../services/logh/SocialInteractionService';

export class SpeechCommand extends BaseLoghCommand {
  getName(): string {
    return 'speech';
  }

  getDisplayName(): string {
    return '연설';
  }

  getDescription(): string {
    return '행성/요새 중앙광장에서 연설. 연설 성과에 따라 영향력과 해당 행성/요새 정부 지지율 증감';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'diplomatic';
  }

  getRequiredCommandPoints(): number {
    return 30;
  }

  getRequiredTurns(): number {
    return 0;
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
    const planetId = env?.planetId;

    if (!planetId) {
      return { success: false, message: '연설할 행성을 지정하세요.' };
    }

    const commanderDoc = await LoghCommander.findOne({ 
      session_id: commander.session_id, 
      no: commander.no 
    });
    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    const planet = await Planet.findOne({ 
      session_id: commander.session_id, 
      planetId 
    });
    if (!planet) {
      return { success: false, message: '행성을 찾을 수 없습니다.' };
    }

    // 연설 실행
    const result = await SocialInteractionService.deliverSpeech(
      commander.session_id,
      commander.no,
      planetId,
      commanderDoc.stats?.politics || 50,
      commanderDoc.stats?.leadership || 50
    );

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: result.success,
      message: result.message,
      effects: result.effects,
    };
  }
}
