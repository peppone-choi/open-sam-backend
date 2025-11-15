/**
 * 일제 수색 (Mass Search)
 * 특정 지역 대규모 수색 - 적 함대 및 시설 발견
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class MassSearchCommand extends BaseLoghCommand {
  getName(): string {
    return 'mass_search';
  }

  getDisplayName(): string {
    return '일제 수색';
  }

  getDescription(): string {
    return '특정 지역 대규모 수색';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 40;
  }

  getRequiredTurns(): number {
    return 60;
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

    // 수색 지역 지정 (그리드 좌표 또는 반경)
    const searchX = env?.searchX;
    const searchY = env?.searchY;
    const searchRadius = env?.searchRadius || 5; // 기본 반경 5칸

    if (searchX === undefined || searchY === undefined) {
      return {
        success: false,
        message: '수색할 좌표를 지정해주세요.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 지정 영역 내 적 함대 탐색
    const enemyFleets = await Fleet.find({
      session_id: commander.session_id,
      faction: { $ne: commander.getFactionType() },
      'strategicPosition.x': {
        $gte: searchX - searchRadius,
        $lte: searchX + searchRadius,
      },
      'strategicPosition.y': {
        $gte: searchY - searchRadius,
        $lte: searchY + searchRadius,
      },
    });

    // 지정 영역 내 행성 탐색
    const planets = await Planet.find({
      session_id: commander.session_id,
      'gridCoordinates.x': {
        $gte: searchX - searchRadius,
        $lte: searchX + searchRadius,
      },
      'gridCoordinates.y': {
        $gte: searchY - searchRadius,
        $lte: searchY + searchRadius,
      },
    });

    // 적 함대 정보
    const fleetInfo = enemyFleets.map(fleet => ({
      name: fleet.name,
      faction: fleet.faction,
      position: fleet.strategicPosition,
      totalShips: fleet.totalShips,
      status: fleet.status,
    }));

    // 행성 정보
    const planetInfo = planets.map(planet => ({
      name: planet.name,
      owner: planet.owner,
      position: planet.gridCoordinates,
      population: planet.stats.population,
      defense: planet.stats.defense,
      isFortress: planet.isFortress,
    }));

    await commander.save();

    // 소요 시간 등록 (정찰은 시간이 걸림)
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('mass_search', durationMs, {
      searchArea: { x: searchX, y: searchY, radius: searchRadius },
      fleetsFound: fleetInfo.length,
      planetsFound: planetInfo.length,
    });

    return {
      success: true,
      message: `좌표 (${searchX}, ${searchY}) 반경 ${searchRadius}칸 수색을 시작했습니다.`,
      effects: [
        {
          type: 'mass_search',
          searchArea: { x: searchX, y: searchY, radius: searchRadius },
          fleetsFound: fleetInfo,
          planetsFound: planetInfo,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
