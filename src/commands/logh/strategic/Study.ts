/**
 * 수강 (Study)
 * 능력 파라미터 증가. 사관학교에서만 실행 가능
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';

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

    // 학습할 능력치 지정
    const studyType = env?.studyType as 'command' | 'tactics' | 'strategy' | 'politics';

    if (!studyType || !['command', 'tactics', 'strategy', 'politics'].includes(studyType)) {
      return {
        success: false,
        message: '학습할 능력치를 지정해주세요. (command, tactics, strategy, politics)',
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
      'gridCoordinates.x': commanderDoc.position.x,
      'gridCoordinates.y': commanderDoc.position.y,
    });

    // 사관학교 확인 (기술력이 높은 행성에서 가능)
    if (!currentPlanet || currentPlanet.stats.technology < 50) {
      return {
        success: false,
        message: '기술력 50 이상의 행성(사관학교)에서만 수강할 수 있습니다.',
      };
    }

    // 능력치 증가
    const oldValue = commanderDoc.stats[studyType];
    const increase = Math.floor(Math.random() * 3) + 1; // 1~3 증가
    commanderDoc.stats[studyType] = Math.min(100, oldValue + increase);

    // 평가 포인트 증가
    commanderDoc.evaluationPoints += increase * 100;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('stats');
    await commanderDoc.save();
    await commander.save();

    const statNames = {
      command: '지휘',
      tactics: '전술',
      strategy: '전략',
      politics: '정치',
    };

    return {
      success: true,
      message: `${currentPlanet.name}에서 ${statNames[studyType]} 능력을 수강했습니다. (${oldValue} → ${commanderDoc.stats[studyType]})`,
      effects: [
        {
          type: 'study',
          studyType,
          oldValue,
          newValue: commanderDoc.stats[studyType],
          increase,
          location: currentPlanet.name,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
