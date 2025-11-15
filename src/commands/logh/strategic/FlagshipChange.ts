/**
 * 기함 변경 (Flagship Change)
 * 기함 함종 변경 (보유 중인 함대의 함선으로 변경)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Fleet } from '../../../models/logh/Fleet.model';

export class FlagshipChangeCommand extends BaseLoghCommand {
  getName(): string {
    return 'flagship_change';
  }

  getDisplayName(): string {
    return '기함 변경';
  }

  getDescription(): string {
    return '기함 함종 변경';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 10;
  }

  getRequiredTurns(): number {
    return 120;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      )
    );

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    const newShipType = env?.shipType; // 새로운 기함의 함종
    const newFlagshipName = env?.flagshipName;

    if (!newShipType) {
      return {
        success: false,
        message: '새 기함의 함종을 지정해주세요.',
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

    // 함대 조회
    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId: commanderDoc.fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 함대에 해당 함종이 있는지 확인
    const shipInFleet = fleet.ships.find(s => s.type === newShipType && s.count > 0);
    
    if (!shipInFleet) {
      return {
        success: false,
        message: `함대에 ${newShipType} 함선이 없습니다.`,
      };
    }

    // 기함 변경
    const oldFlagship = commanderDoc.flagship;
    
    // 함종에 따른 화력 설정
    let firepower = 100;
    let flagshipType: 'battleship' | 'cruiser' | 'destroyer' | 'carrier' = 'cruiser';
    
    if (newShipType.includes('전함') || newShipType.includes('戦艦')) {
      firepower = 150;
      flagshipType = 'battleship';
    } else if (newShipType.includes('순양') || newShipType.includes('巡洋')) {
      firepower = 100;
      flagshipType = 'cruiser';
    } else if (newShipType.includes('구축') || newShipType.includes('駆逐')) {
      firepower = 70;
      flagshipType = 'destroyer';
    } else if (newShipType.includes('항모') || newShipType.includes('空母')) {
      firepower = 80;
      flagshipType = 'carrier';
    }

    commanderDoc.flagship = {
      name: newFlagshipName || `${commanderDoc.name}의 기함`,
      type: flagshipType,
      firepower,
    };

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await commanderDoc.save();
    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('flagship_change', durationMs, {
      newShipType,
      newFlagshipName,
    });

    return {
      success: true,
      message: `기함을 ${newShipType}으로 변경합니다.${oldFlagship ? ` (기존: ${oldFlagship.name})` : ''}`,
      effects: [
        {
          type: 'flagship_change',
          oldFlagship,
          newFlagship: commanderDoc.flagship,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
