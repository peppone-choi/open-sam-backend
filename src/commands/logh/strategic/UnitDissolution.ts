/**
 * 부대 해산 (部隊解散, Unit Dissolution)
 * 행성/요새에 정박 중인 부대를 해산하고 함선을 행성 창고로 반환
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class UnitDissolutionCommand extends BaseLoghCommand {
  getName(): string {
    return 'unit_dissolution';
  }

  getDisplayName(): string {
    return '부대 해산';
  }

  getDescription(): string {
    return '행성/요새에 주류 중인 부대 해산';
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

    // 함대 조회
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

    // 정박 중인지 확인
    if (fleet.status !== 'docked' || !fleet.dockedPlanetId) {
      return {
        success: false,
        message: '행성에 정박 중일 때만 해산할 수 있습니다.',
      };
    }

    // 전투 중인지 확인
    if (fleet.isInCombat) {
      return {
        success: false,
        message: '전투 중에는 함대를 해산할 수 없습니다.',
      };
    }

    // 정박 중인 행성 조회
    const planet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: fleet.dockedPlanetId,
    });

    if (!planet) {
      return {
        success: false,
        message: '정박 중인 행성을 찾을 수 없습니다.',
      };
    }

    // 함선을 행성 창고로 반환
    const totalShips = fleet.totalShips;
    planet.warehouse.ships += totalShips;

    // Commander의 fleetId 제거
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (commanderDoc) {
      commanderDoc.fleetId = null;
      await commanderDoc.save();
    }

    // 함대 삭제
    const fleetName = fleet.name;
    await Fleet.deleteOne({ _id: fleet._id });

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${fleetName}을(를) 해산했습니다. ${planet.name}에 함선 ${totalShips}척을 반환했습니다.`,
      effects: [
        {
          type: 'fleet_dissolved',
          fleetId,
          fleetName,
          totalShips,
          location: planet.name,
        },
      ],
    };
  }
}
