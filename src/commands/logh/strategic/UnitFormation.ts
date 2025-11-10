/**
 * 부대 결성 (部隊結成, Unit Formation)
 * 새로운 함대를 결성 (행성 창고에서 함선을 꺼내서 함대 생성)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { v4 as uuidv4 } from 'uuid';

export class UnitFormationCommand extends BaseLoghCommand {
  getName(): string {
    return 'unit_formation';
  }

  getDisplayName(): string {
    return '부대 결성';
  }

  getDescription(): string {
    return '부대 결성을 위해 유닛 편성';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 320;
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
        (input: ILoghCommandContext) => !input.commander.getFleetId(),
        '이미 함대를 보유하고 있습니다. 먼저 해산해주세요.'
      ),
    ];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터 가져오기
    const planetId = env?.planetId;
    const fleetName = env?.fleetName || `${commander.getVar('name')}의 함대`;
    const shipComposition = env?.shipComposition || []; // [{ type: '전함', count: 100 }, ...]

    if (!planetId) {
      return {
        success: false,
        message: '함대를 결성할 행성을 지정해주세요.',
      };
    }

    if (!shipComposition || shipComposition.length === 0) {
      return {
        success: false,
        message: '함선 편성을 지정해주세요.',
      };
    }

    // 행성 조회
    const planet = await Planet.findOne({
      session_id: commander.session_id,
      planetId,
    });

    if (!planet) {
      return {
        success: false,
        message: '행성을 찾을 수 없습니다.',
      };
    }

    // 아군 행성인지 확인
    if (planet.owner !== commander.getFactionType()) {
      return {
        success: false,
        message: '아군 행성에서만 함대를 결성할 수 있습니다.',
      };
    }

    // 총 함선 수 계산
    let totalShips = 0;
    for (const ship of shipComposition) {
      totalShips += ship.count;
    }

    // 행성 창고에 충분한 함선이 있는지 확인
    if (planet.warehouse.ships < totalShips) {
      return {
        success: false,
        message: `행성 창고에 충분한 함선이 없습니다. (필요: ${totalShips}, 보유: ${planet.warehouse.ships})`,
      };
    }

    // 새 함대 생성
    const fleetId = uuidv4();
    const newFleet = new Fleet({
      session_id: commander.session_id,
      fleetId,
      name: fleetName,
      commanderId: commander.no.toString(),
      commanderName: commander.getVar('name'),
      faction: commander.getFactionType(),
      ships: shipComposition.map((ship: any) => ({
        type: ship.type,
        count: ship.count,
        health: 100,
      })),
      totalShips,
      totalStrength: totalShips * 10, // 임시: 함선당 전투력 10
      supplies: 10000,
      fuel: 1000,
      morale: 70,
      training: {
        discipline: 50,
        space: 50,
        ground: 50,
        air: 50,
      },
      strategicPosition: {
        x: planet.gridCoordinates.x,
        y: planet.gridCoordinates.y,
      },
      formation: 'standard',
      status: 'docked',
      currentSystemId: planet.systemId,
      dockedPlanetId: planetId,
      movementSpeed: 1.0,
      isMoving: false,
      isInCombat: false,
    });

    // 행성 창고에서 함선 차감
    planet.warehouse.ships -= totalShips;

    // Commander에 함대 ID 설정
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (commanderDoc) {
      commanderDoc.fleetId = fleetId;
      await commanderDoc.save();
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await newFleet.save();
    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}에서 ${fleetName}을(를) 결성했습니다. (함선 ${totalShips}척)`,
      effects: [
        {
          type: 'fleet_created',
          fleetId,
          fleetName,
          totalShips,
          location: planet.name,
        },
      ],
    };
  }
}
