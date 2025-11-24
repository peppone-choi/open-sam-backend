/**
 * [전술] 출격 (出撃, Sortie)
 * 행성/요새에서 함대 출격
 * 
 * 기능:
 * - 정박(docked) 상태에서 전술 맵으로 출격
 * - 출격 시 초기 위치 설정
 * - 보급품/연료 보충 후 출격
 * - 출격 준비 시간 필요
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { TacticalMap } from '../../../models/logh/TacticalMap.model';

export class SortieTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'sortie';
  }

  getDisplayName(): string {
    return '출격';
  }

  getDescription(): string {
    return '행성이나 요새에서 함대를 출격시킵니다. 보급 후 전술 맵에 배치됩니다.';
  }

  getShortcut(): string {
    return 'o';
  }

  getExecutionDelay(): number {
    return 10; // 10 게임시간 (25초) - 출격 준비 시간
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 출격 위치 계산 (행성/요새 근처)
   */
  private calculateSortiePosition(
    planetPosition: { x: number; y: number },
    faction: string,
    tacticalSize: { width: number; height: number }
  ): { x: number; y: number } {
    // 행성은 전술 맵 중앙에 위치한다고 가정
    const centerX = tacticalSize.width / 2;
    const centerY = tacticalSize.height / 2;

    // 진영별로 출격 위치 다르게
    let offsetX = 0;
    let offsetY = 0;

    if (faction === 'empire') {
      offsetX = -1500; // 왼쪽에서 출격
      offsetY = (Math.random() - 0.5) * 1000;
    } else if (faction === 'alliance') {
      offsetX = 1500; // 오른쪽에서 출격
      offsetY = (Math.random() - 0.5) * 1000;
    }

    return {
      x: centerX + offsetX,
      y: centerY + offsetY,
    };
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, tacticalMapId } = params;

    // 함대 조회
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 정박 중인지 확인
    if (fleet.status !== 'docked') {
      return {
        success: false,
        message: '행성/요새에 정박 중인 함대만 출격할 수 있습니다.',
      };
    }

    // 정박 중인 행성 확인
    if (!fleet.dockedPlanetId) {
      return {
        success: false,
        message: '정박 위치를 찾을 수 없습니다.',
      };
    }

    const planet = await Planet.findOne({
      session_id: sessionId,
      planetId: fleet.dockedPlanetId,
    });

    if (!planet) {
      return {
        success: false,
        message: '정박 중인 행성을 찾을 수 없습니다.',
      };
    }

    // 전술 맵 확인 또는 생성
    let tacticalMap;
    if (tacticalMapId) {
      tacticalMap = await TacticalMap.findOne({
        session_id: sessionId,
        tacticalMapId,
      });
    } else {
      // 해당 전략 그리드의 전술 맵 찾기
      tacticalMap = await TacticalMap.findOne({
        session_id: sessionId,
        'strategicGridPosition.x': planet.gridCoordinates.x,
        'strategicGridPosition.y': planet.gridCoordinates.y,
        status: 'active',
      });
    }

    if (!tacticalMap) {
      return {
        success: false,
        message: '출격할 전술 맵이 없습니다. 전투가 발생한 그리드에서만 출격 가능합니다.',
      };
    }

    // 보급 보충 (행성의 창고에서)
    const supplyAmount = Math.min(1000, planet.warehouse.supplies);
    fleet.supplies = Math.min(fleet.supplies + supplyAmount, 10000);
    fleet.fuel = 100; // 연료 완충
    planet.warehouse.supplies = Math.max(0, planet.warehouse.supplies - supplyAmount);

    // 출격 위치 계산
    const sortiePosition = this.calculateSortiePosition(
      { x: planet.gridCoordinates.x, y: planet.gridCoordinates.y },
      fleet.faction,
      tacticalMap.tacticalSize
    );

    // 함대 상태 업데이트
    fleet.status = 'combat';
    fleet.isInCombat = true;
    fleet.tacticalMapId = tacticalMap.tacticalMapId;
    fleet.tacticalPosition = {
      x: sortiePosition.x,
      y: sortiePosition.y,
      velocity: { x: 0, y: 0 },
      heading: fleet.faction === 'empire' ? 0 : 180,
    };
    fleet.dockedPlanetId = undefined;
    fleet.formation = 'standard';

    // 전술 맵에 함대 추가
    if (!tacticalMap.participatingFleetIds.includes(fleetId)) {
      tacticalMap.participatingFleetIds.push(fleetId);
      
      if (fleet.faction === 'empire') {
        tacticalMap.factions.empire.push(fleetId);
      } else if (fleet.faction === 'alliance') {
        tacticalMap.factions.alliance.push(fleetId);
      }

      await tacticalMap.save();
    }

    // 로그 기록
    if (!fleet.customData) fleet.customData = {};
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'sortie',
      fromPlanet: planet.name,
      tacticalMapId: tacticalMap.tacticalMapId,
      position: sortiePosition,
      suppliesGained: supplyAmount,
    });

    await fleet.save();
    await planet.save();

    return {
      success: true,
      message: `함대 "${fleet.name}"가 ${planet.name}에서 출격했습니다. (보급 +${supplyAmount})`,
    };
  }
}
