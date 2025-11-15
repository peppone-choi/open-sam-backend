/**
 * 기함 구입 (Flagship Purchase)
 * 새 기함 구입. 평가 포인트 소비 필요
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';

// 기함 종류별 비용 및 성능
const FLAGSHIP_TYPES = {
  battleship: {
    name: '전함급 기함',
    cost: 5000, // 평가 포인트
    funds: 100000, // 개인 자금
    firepower: 150,
  },
  cruiser: {
    name: '순양함급 기함',
    cost: 3000,
    funds: 60000,
    firepower: 100,
  },
  destroyer: {
    name: '구축함급 기함',
    cost: 2000,
    funds: 40000,
    firepower: 70,
  },
  carrier: {
    name: '항모급 기함',
    cost: 4000,
    funds: 80000,
    firepower: 80,
  },
};

export class FlagshipPurchaseCommand extends BaseLoghCommand {
  getName(): string {
    return 'flagship_purchase';
  }

  getDisplayName(): string {
    return '기함 구입';
  }

  getDescription(): string {
    return '새 기함 구입. 평가 포인트 소비 필요';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 80;
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

    // 기함 종류 및 이름 지정
    const flagshipType = env?.flagshipType as keyof typeof FLAGSHIP_TYPES;
    const flagshipName = env?.flagshipName || '무명함';

    if (!flagshipType || !FLAGSHIP_TYPES[flagshipType]) {
      return {
        success: false,
        message: '기함 종류를 지정해주세요. (battleship, cruiser, destroyer, carrier)',
      };
    }

    const flagshipData = FLAGSHIP_TYPES[flagshipType];

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

    // 평가 포인트 확인
    if (commanderDoc.evaluationPoints < flagshipData.cost) {
      return {
        success: false,
        message: `평가 포인트가 부족합니다. (필요: ${flagshipData.cost}, 보유: ${commanderDoc.evaluationPoints})`,
      };
    }

    // 개인 자금 확인
    if ((commanderDoc.personalFunds || 0) < flagshipData.funds) {
      return {
        success: false,
        message: `개인 자금이 부족합니다. (필요: ${flagshipData.funds}, 보유: ${commanderDoc.personalFunds || 0})`,
      };
    }

    // 기존 기함이 있으면 교체
    const oldFlagship = commanderDoc.flagship;

    // 비용 지불
    commanderDoc.evaluationPoints -= flagshipData.cost;
    commanderDoc.personalFunds = (commanderDoc.personalFunds || 0) - flagshipData.funds;

    // 새 기함 설정
    commanderDoc.flagship = {
      name: flagshipName,
      type: flagshipType,
      firepower: flagshipData.firepower,
    };

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `${flagshipData.name} "${flagshipName}"을(를) 구입했습니다.${oldFlagship ? ` (기존: ${oldFlagship.name})` : ''}`,
      effects: [
        {
          type: 'flagship_purchase',
          flagshipName,
          flagshipType,
          firepower: flagshipData.firepower,
          cost: flagshipData.cost,
          oldFlagship,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
