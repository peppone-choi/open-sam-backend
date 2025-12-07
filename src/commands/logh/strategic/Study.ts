/**
 * 수강 (Study)
 * 능력 파라미터 증가. 사관학교에서만 실행 가능
 *
 * 학습 가능 스탯:
 * - leadership: 통솔력
 * - politics: 정치력
 * - operations: 운영/분석력
 * - intelligence: 지략
 * - command: 지휘력
 * - maneuver: 기동력
 * - attack: 공격력
 * - defense: 방어력
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';
import {
  STUDY_STATS,
  StudyStat,
  STAT_NAMES,
  calculateStudyIncrease,
} from '../../../services/logh/TrainingSystem';

export class StudyCommand extends BaseLoghCommand {
  getName(): string {
    return 'study';
  }

  getDisplayName(): string {
    return '수강';
  }

  getDescription(): string {
    return '능력 파라미터 증가. 사관학교에서만 실행 가능';
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
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 학습할 능력치 지정
    const studyType = env?.studyType as StudyStat;

    if (!studyType || !STUDY_STATS.includes(studyType)) {
      const availableStats = STUDY_STATS.map((s) => STAT_NAMES[s]).join(', ');
      return {
        success: false,
        message: `학습할 능력치를 선택해야 합니다. (${availableStats})`,
      };
    }

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
        message: '기술력 50 이상의 행성(사관학교)에서만 수강할 수 있습니다.',
      };
    }

    // 현재 행성에 강의 중인 교관이 있는지 확인
    const instructor = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: { $ne: commander.no }, // 자기 자신 제외
      'position.x': commanderDoc.position?.x,
      'position.y': commanderDoc.position?.y,
      'customData.isLecturing': true,
      'customData.lectureStatType': studyType,
    });

    const hasInstructor = !!instructor;
    const instructorSkill = instructor ? instructor.stats[studyType] : 0;

    // 능력치 증가량 계산
    const oldValue = commanderDoc.stats[studyType];
    const increase = calculateStudyIncrease(oldValue, hasInstructor, instructorSkill);
    const newValue = Math.min(100, oldValue + increase);
    commanderDoc.stats[studyType] = newValue;

    // 평가 포인트 증가
    commanderDoc.evaluation = (commanderDoc.evaluation || 0) + increase * 100;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('stats');
    await commanderDoc.save();
    await commander.save();

    const statName = STAT_NAMES[studyType];
    let message = `${currentPlanet.name}에서 ${statName} 능력을 수강했습니다. (${oldValue} → ${newValue})`;

    if (hasInstructor && instructor) {
      message += ` [교관: ${instructor.name}의 지도로 효과 상승]`;
    }

    return {
      success: true,
      message,
      effects: [
        {
          type: 'study',
          studyType,
          statName,
          oldValue,
          newValue,
          increase,
          location: currentPlanet.name,
          instructor: instructor?.name || null,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 턴 종료 시 특별한 처리 없음
  }
}
