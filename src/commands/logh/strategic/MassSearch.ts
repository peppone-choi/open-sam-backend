/**
 * 일제 수색 (Mass Search)
 * 특정 지역 대규모 수색 - 적 함대, 시설, 스파이, 수배자 발견
 * 헌병대 활동의 핵심 기능
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class MassSearchCommand extends BaseLoghCommand {
  getName(): string {
    return 'mass_search';
  }

  getDisplayName(): string {
    return '일제 수색';
  }

  getDescription(): string {
    return '특정 지역 대규모 수색 (적 함대, 스파이, 수배자 발견)';
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
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 수색 대상: 특정 행성 또는 좌표 지정
    const targetPlanetId = env?.targetPlanetId;
    const searchX = env?.searchX;
    const searchY = env?.searchY;
    const searchRadius = env?.searchRadius || 5; // 기본 반경 5칸

    // 행성 지정 또는 좌표 지정 필요
    if (!targetPlanetId && (searchX === undefined || searchY === undefined)) {
      return {
        success: false,
        message: '수색할 행성 또는 좌표를 지정해주세요.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    const effects: any[] = [];
    let resultMessage = '';

    // 행성 내 수색 (스파이/수배자 탐색)
    if (targetPlanetId) {
      const targetPlanet = await Planet.findOne({
        session_id: commander.session_id,
        planetId: targetPlanetId,
      });

      if (!targetPlanet) {
        return { success: false, message: '대상 행성을 찾을 수 없습니다.' };
      }

      // 자기 세력 소유 행성만 수색 가능
      if (targetPlanet.owner !== commander.getFactionType()) {
        return { success: false, message: '자기 세력 소유의 행성만 수색 가능합니다.' };
      }

      // 스파이 탐색 (적 세력 소속이면서 해당 행성에 침투한 캐릭터)
      const spiesFound = await this.searchForSpies(commander.session_id, targetPlanet, commander.getFactionType());

      // 수배자 탐색 (customData에 wanted 플래그가 있는 캐릭터)
      const wantedFound = await this.searchForWanted(commander.session_id, targetPlanet);

      effects.push({
        type: 'planet_search',
        planetId: targetPlanetId,
        planetName: targetPlanet.name,
        spiesFound,
        wantedFound,
      });

      resultMessage = `${targetPlanet.name}에서 일제 수색을 실시했습니다. 스파이 ${spiesFound.length}명, 수배자 ${wantedFound.length}명 발견.`;
    }

    // 좌표 기반 수색 (적 함대/행성 탐색)
    if (searchX !== undefined && searchY !== undefined) {
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

      effects.push({
        type: 'area_search',
        searchArea: { x: searchX, y: searchY, radius: searchRadius },
        fleetsFound: fleetInfo,
        planetsFound: planetInfo,
      });

      if (!resultMessage) {
        resultMessage = `좌표 (${searchX}, ${searchY}) 반경 ${searchRadius}칸 수색 완료. 적 함대 ${fleetInfo.length}개, 행성 ${planetInfo.length}개 발견.`;
      }
    }

    await commander.save();

    // 소요 시간 등록 (정찰은 시간이 걸림)
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('mass_search', durationMs, { effects });

    return {
      success: true,
      message: resultMessage,
      effects,
    };
  }

  /**
   * 스파이 탐색 - 적 세력 소속이면서 해당 행성에 침투한 캐릭터 찾기
   */
  private async searchForSpies(
    sessionId: string,
    planet: any,
    myFaction: string
  ): Promise<Array<{ no: number; name: string; faction: string }>> {
    // 탐지 확률: 기본 30%, 행성 치안도에 따라 보정
    const baseDetectionRate = 0.3;
    const securityBonus = (planet.stats.security || 50) / 200; // 치안 50일 때 +25%
    const detectionRate = Math.min(0.8, baseDetectionRate + securityBonus);

    // 적 세력이면서 customData에 infiltration 기록이 있는 캐릭터 탐색
    const potentialSpies = await LoghCommander.find({
      session_id: sessionId,
      faction: { $ne: myFaction },
      status: 'active',
      'customData.infiltration.planetId': planet.planetId,
    });

    const detectedSpies: Array<{ no: number; name: string; faction: string }> = [];

    for (const spy of potentialSpies) {
      if (Math.random() < detectionRate) {
        detectedSpies.push({
          no: spy.no,
          name: spy.name,
          faction: spy.faction,
        });

        // 발견된 스파이에게 detected 플래그 추가
        spy.customData = spy.customData || {};
        spy.customData.detected = true;
        spy.customData.detectedAt = new Date();
        spy.markModified('customData');
        await spy.save();
      }
    }

    return detectedSpies;
  }

  /**
   * 수배자 탐색 - wanted 플래그가 있는 캐릭터 찾기
   */
  private async searchForWanted(
    sessionId: string,
    planet: any
  ): Promise<Array<{ no: number; name: string; crime: string }>> {
    // 수배자 탐색: 같은 행성에 위치하면서 wanted 플래그가 있는 캐릭터
    const wantedCommanders = await LoghCommander.find({
      session_id: sessionId,
      status: 'active',
      'customData.wanted': true,
      'customData.location.planetId': planet.planetId,
    });

    const foundWanted: Array<{ no: number; name: string; crime: string }> = [];

    // 탐지 확률: 기본 40%, 행성 치안도에 따라 보정
    const baseDetectionRate = 0.4;
    const securityBonus = (planet.stats.security || 50) / 200;
    const detectionRate = Math.min(0.9, baseDetectionRate + securityBonus);

    for (const wanted of wantedCommanders) {
      if (Math.random() < detectionRate) {
        foundWanted.push({
          no: wanted.no,
          name: wanted.name,
          crime: wanted.customData?.wantedReason || '미상',
        });

        // 발견된 수배자에게 detected 플래그 추가
        wanted.customData = wanted.customData || {};
        wanted.customData.detected = true;
        wanted.customData.detectedAt = new Date();
        wanted.markModified('customData');
        await wanted.save();
      }
    }

    return foundWanted;
  }
}
