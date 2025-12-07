/**
 * 병기 연습 (War Game)
 * 시뮬레이터로 전술 훈련 수행. 사관학교에서만 실행 가능
 *
 * - 전술 시뮬레이션 승리 시 전술 스킬 획득
 * - 성공률은 지휘력, 지략, 기동력에 따라 결정
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';
import {
  calculateWargameSuccess,
  selectRandomTacticalSkill,
  TACTICAL_SKILL_NAMES,
  TacticalSkill,
} from '../../../services/logh/TrainingSystem';

export class WarGameCommand extends BaseLoghCommand {
  getName(): string {
    return 'war_game';
  }

  getDisplayName(): string {
    return '병기 연습';
  }

  getDescription(): string {
    return '시뮬레이터로 전술 훈련 수행. 사관학교에서만 실행 가능';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 100;
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
    const { commander } = context;

    // Commander 문서 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc) {
      return {
        success: false,
        message: '커맨더 정보를 찾을 수 없습니다.',
      };
    }

    // 현재 위치의 행성 조회
    const currentPlanet = await Planet.findOne({
      session_id: commander.session_id,
      'gridCoordinates.x': commanderDoc.position?.x,
      'gridCoordinates.y': commanderDoc.position?.y,
    });

    // 사관학교 확인 (기술력이 높은 행성에서 가능)
    if (!currentPlanet || currentPlanet.stats.technology < 50) {
      return {
        success: false,
        message: '기술력 50 이상의 행성(사관학교)에서만 병기 연습이 가능합니다.',
      };
    }

    // 현재 보유 중인 전술 스킬 목록
    const currentSkills: string[] = commanderDoc.customData?.tacticalSkills || [];

    // 시뮬레이션 실행
    const { success: simSuccess, score } = calculateWargameSuccess({
      command: commanderDoc.stats.command,
      intelligence: commanderDoc.stats.intelligence,
      maneuver: commanderDoc.stats.maneuver,
    });

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 결과 처리
    const effects: any[] = [];
    let message: string;

    if (simSuccess) {
      // 시뮬레이션 승리 - 전술 스킬 획득 기회
      const newSkill = selectRandomTacticalSkill(currentSkills);

      if (newSkill) {
        // 새 스킬 획득
        commanderDoc.customData = commanderDoc.customData || {};
        commanderDoc.customData.tacticalSkills = [...currentSkills, newSkill];

        const skillName = TACTICAL_SKILL_NAMES[newSkill];
        message = `병기 연습 시뮬레이션 승리! (점수: ${score}점) 새로운 전술 스킬 '${skillName}'을(를) 습득했습니다!`;

        effects.push({
          type: 'skill_acquired',
          skillId: newSkill,
          skillName,
          score,
        });
      } else {
        // 모든 스킬 보유 중
        message = `병기 연습 시뮬레이션 승리! (점수: ${score}점) 이미 모든 전술 스킬을 보유 중입니다.`;

        // 대신 평가 포인트 증가
        commanderDoc.evaluation = (commanderDoc.evaluation || 0) + score * 10;

        effects.push({
          type: 'wargame_victory',
          score,
          evaluationGain: score * 10,
        });
      }
    } else {
      // 시뮬레이션 패배
      message = `병기 연습 시뮬레이션 결과: 패배 (점수: ${score}점). 다음 기회에 다시 도전하세요.`;

      // 패배해도 약간의 경험치 획득
      commanderDoc.evaluation = (commanderDoc.evaluation || 0) + Math.floor(score / 2);

      effects.push({
        type: 'wargame_defeat',
        score,
        evaluationGain: Math.floor(score / 2),
      });
    }

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message,
      effects,
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 턴 종료 시 특별한 처리 없음
  }
}
