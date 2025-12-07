/**
 * 강의 (講義)
 * 수강 커맨드 실행 인물의 능력 파라미터 증가.
 * 실행 후 120G분 또는 실행 스포트 이탈까지 유효.
 * 사관학교에서만 실행 가능
 *
 * - 고위 장교가 교관으로 활동 시 명성 획득
 * - 같은 위치에서 수강 중인 캐릭터들의 능력 증가량 보너스
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';
import {
  STUDY_STATS,
  StudyStat,
  STAT_NAMES,
  calculateLectureFameGain,
} from '../../../services/logh/TrainingSystem';

// 강의 지속 시간 (턴 수, 120G분 ≈ 12턴)
const LECTURE_DURATION_TURNS = 12;

export class LectureCommand extends BaseLoghCommand {
  getName(): string {
    return 'lecture';
  }

  getDisplayName(): string {
    return '강의';
  }

  getDescription(): string {
    return '수강 커맨드 실행 인물의 능력 파라미터 증가. 실행 후 120G분 또는 실행 스포트 이탈까지 유효. 사관학교에서만 실행 가능';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
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

    // 강의할 능력치 지정
    const lectureType = env?.lectureType as StudyStat;

    if (!lectureType || !STUDY_STATS.includes(lectureType)) {
      const availableStats = STUDY_STATS.map((s) => STAT_NAMES[s]).join(', ');
      return {
        success: false,
        message: `강의할 능력치를 선택해야 합니다. (${availableStats})`,
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

    // 계급 확인 (너무 낮은 계급은 강의 불가)
    // rank: 1=원수, 2=상급대장, ..., 10=소위
    if (commanderDoc.rank > 7) {
      return {
        success: false,
        message: '중령 이상의 계급만 강의를 할 수 있습니다.',
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
        message: '기술력 50 이상의 행성(사관학교)에서만 강의할 수 있습니다.',
      };
    }

    // 해당 스탯이 일정 수준 이상인지 확인
    const statValue = commanderDoc.stats[lectureType];
    if (statValue < 60) {
      return {
        success: false,
        message: `${STAT_NAMES[lectureType]} 능력이 60 이상이어야 강의할 수 있습니다. (현재: ${statValue})`,
      };
    }

    // 명성 획득량 계산
    const fameGain = calculateLectureFameGain(commanderDoc.rank, commanderDoc.fame);
    const oldFame = commanderDoc.fame;
    commanderDoc.fame = oldFame + fameGain;

    // 강의 상태 설정 (customData에 저장)
    commanderDoc.customData = commanderDoc.customData || {};
    commanderDoc.customData.isLecturing = true;
    commanderDoc.customData.lectureStatType = lectureType;
    commanderDoc.customData.lectureStartTurn = env?.currentTurn || 0;
    commanderDoc.customData.lectureEndTurn = (env?.currentTurn || 0) + LECTURE_DURATION_TURNS;
    commanderDoc.customData.lectureLocation = {
      x: commanderDoc.position?.x,
      y: commanderDoc.position?.y,
      planetName: currentPlanet.name,
    };

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    const statName = STAT_NAMES[lectureType];

    return {
      success: true,
      message: `${currentPlanet.name}에서 ${statName} 강의를 시작했습니다. 명성 +${fameGain} (${oldFame} → ${commanderDoc.fame}). ${LECTURE_DURATION_TURNS}턴 동안 유효합니다.`,
      effects: [
        {
          type: 'lecture_started',
          lectureType,
          statName,
          location: currentPlanet.name,
          fameGain,
          oldFame,
          newFame: commanderDoc.fame,
          duration: LECTURE_DURATION_TURNS,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    const { commander, env } = context;

    // 강의 중인지 확인
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc?.customData?.isLecturing) {
      return;
    }

    const currentTurn = env?.currentTurn || 0;
    const lectureEndTurn = commanderDoc.customData.lectureEndTurn || 0;
    const lectureLocation = commanderDoc.customData.lectureLocation;

    // 강의 종료 조건 확인
    // 1. 지정된 턴 수 경과
    // 2. 위치 이동 (사관학교 이탈)
    const hasExpired = currentTurn >= lectureEndTurn;
    const hasMoved =
      lectureLocation &&
      (commanderDoc.position?.x !== lectureLocation.x || commanderDoc.position?.y !== lectureLocation.y);

    if (hasExpired || hasMoved) {
      // 강의 종료
      commanderDoc.customData.isLecturing = false;
      delete commanderDoc.customData.lectureStatType;
      delete commanderDoc.customData.lectureStartTurn;
      delete commanderDoc.customData.lectureEndTurn;
      delete commanderDoc.customData.lectureLocation;

      commanderDoc.markModified('customData');
      await commanderDoc.save();
    }
  }
}
