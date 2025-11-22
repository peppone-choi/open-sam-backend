/**
 * LOGH Realtime Movement Service
 * 실시간 함대 이동 처리 (전략 맵)
 */

import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { MapGrid } from '../../models/logh/MapGrid.model';
import { RealtimeCombatService } from './RealtimeCombat.service';
import { GalaxyValidationService } from './GalaxyValidation.service';

interface Position {
  x: number;
  y: number;
}

interface WarpOutcome {
  terrainType: string;
  hazardLevel: number;
  errorVector: Position;
  finalDestination: Position;
}

export class RealtimeMovementService {
  /**
   * A* 경로 탐색 (전략 맵)
   */
  static async findPath(
    sessionId: string,
    start: Position,
    end: Position
  ): Promise<Position[] | null> {
    const mapGrid = await MapGrid.findOne({ session_id: sessionId });
    if (!mapGrid) {
      throw new Error('Map grid not found');
    }

    // A* 구현 (기존과 동일)
    const openSet = new Set<string>();
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startKey = `${Math.floor(start.x)},${Math.floor(start.y)}`;
    const endKey = `${Math.floor(end.x)},${Math.floor(end.y)}`;

    openSet.add(startKey);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, end));

    while (openSet.size > 0) {
      let current: string | null = null;
      let lowestF = Infinity;

      for (const key of openSet) {
        const f = fScore.get(key) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = key;
        }
      }

      if (!current) break;

      if (current === endKey) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      closedSet.add(current);

      const [cx, cy] = current.split(',').map(Number);
      const currentPos = { x: cx, y: cy };

      const neighbors = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 },
      ];

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (
          neighbor.x < 0 ||
          neighbor.x >= 100 ||
          neighbor.y < 0 ||
          neighbor.y >= 50
        ) {
          continue;
        }

        if (mapGrid.grid[neighbor.y][neighbor.x] === 0) {
          continue;
        }

        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = (gScore.get(current) || 0) + 1;

        if (!openSet.has(neighborKey)) {
          openSet.add(neighborKey);
        } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, currentPos);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(
          neighborKey,
          tentativeGScore + this.heuristic(neighbor, end)
        );
      }
    }

    return null;
  }

  private static heuristic(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private static reconstructPath(
    cameFrom: Map<string, Position>,
    current: string
  ): Position[] {
    const path: Position[] = [];
    const [x, y] = current.split(',').map(Number);
    let currentPos: Position | undefined = { x, y };

    while (currentPos) {
      path.unshift(currentPos);
      const key = `${currentPos.x},${currentPos.y}`;
      currentPos = cameFrom.get(key);
    }

    return path;
  }

  private static applyWarpVariance(destination: Position, terrain: { terrainType: string; hazardLevel: number }): WarpOutcome {
    const maxOffset = terrain.hazardLevel > 0 ? terrain.hazardLevel : 0;
    const randomBetween = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const errorVector = {
      x: maxOffset > 0 ? randomBetween(-maxOffset, maxOffset) : 0,
      y: maxOffset > 0 ? randomBetween(-maxOffset, maxOffset) : 0,
    };

    const finalDestination = {
      x: Math.max(0, Math.min(99, destination.x + errorVector.x)),
      y: Math.max(0, Math.min(49, destination.y + errorVector.y)),
    };

    return {
      terrainType: terrain.terrainType,
      hazardLevel: terrain.hazardLevel,
      errorVector,
      finalDestination,
    };
  }

  /**
   * 함대 이동 명령 (전략 맵)
   */
  static async setFleetDestination(
    sessionId: string,
    fleetId: string,
    destination: Position
  ): Promise<{
    success: boolean;
    message: string;
    path?: Position[];
    warpOutcome?: WarpOutcome;
  }> {
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

    if (fleet.isInCombat) {
      return {
        success: false,
        message: '전투 중에는 이동할 수 없습니다.',
      };
    }

    const terrain = await GalaxyValidationService.assessTerrain(sessionId, destination);
    if (terrain.impassable) {
      return {
        success: false,
        message: `해당 좌표(${terrain.coordinates.x}, ${terrain.coordinates.y})는 ${terrain.terrainType} 지형으로 진입할 수 없습니다.`,
      };
    }

    let warpOutcome = this.applyWarpVariance(destination, terrain);
    const finalTerrain = await GalaxyValidationService.assessTerrain(
      sessionId,
      warpOutcome.finalDestination
    );
    if (finalTerrain.impassable) {
      warpOutcome = {
        terrainType: terrain.terrainType,
        hazardLevel: terrain.hazardLevel,
        errorVector: { x: 0, y: 0 },
        finalDestination: destination,
      };
    } else {
      warpOutcome = {
        ...warpOutcome,
        terrainType: finalTerrain.terrainType,
        hazardLevel: finalTerrain.hazardLevel,
      };
    }

    // 경로 탐색
    const path = await this.findPath(
      sessionId,
      fleet.strategicPosition,
      warpOutcome.finalDestination
    );

    if (!path || path.length === 0) {
      return {
        success: false,
        message: '경로를 찾을 수 없습니다.',
      };
    }

    fleet.destination = warpOutcome.finalDestination;
    fleet.movementPath = path;
    fleet.isMoving = true;
    fleet.status = 'moving';
    await fleet.save();

    return {
      success: true,
      message: '이동 명령이 설정되었습니다.',
      path,
      warpOutcome,
    };
  }

  /**
   * 실시간 함대 이동 업데이트
   * @param deltaTime 경과 시간 (초)
   */
  static async updateFleetMovement(
    sessionId: string,
    fleetId: string,
    deltaTime: number
  ): Promise<{
    newPosition: Position;
    reachedDestination: boolean;
    combatTriggered?: boolean;
    tacticalMapId?: string;
  }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet || !fleet.isMoving || !fleet.movementPath || fleet.movementPath.length === 0) {
      throw new Error('Fleet is not moving');
    }

    // 현재 경로의 다음 웨이포인트로 이동
    const nextWaypoint = fleet.movementPath[0];
    const currentPos = fleet.strategicPosition;

    // 방향 벡터 계산
    const dx = nextWaypoint.x - currentPos.x;
    const dy = nextWaypoint.y - currentPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 이동 거리 계산 (movementSpeed * deltaTime)
    const moveDistance = fleet.movementSpeed * deltaTime;

    if (distance <= moveDistance) {
      // 웨이포인트 도달
      fleet.strategicPosition = {
        x: nextWaypoint.x,
        y: nextWaypoint.y,
      };
      fleet.movementPath.shift(); // 웨이포인트 제거

      // 목적지 도달 여부
      const reachedDestination =
        fleet.movementPath.length === 0 ||
        (fleet.destination &&
          fleet.strategicPosition.x === fleet.destination.x &&
          fleet.strategicPosition.y === fleet.destination.y);

      if (reachedDestination) {
        fleet.isMoving = false;
        fleet.movementPath = [];
        fleet.destination = undefined;
        fleet.status = 'idle';
      }

      await fleet.save();

      // 도착 위치에서 적 함대 체크
      const combatCheck = await this.checkForCombat(
        sessionId,
        Math.floor(fleet.strategicPosition.x),
        Math.floor(fleet.strategicPosition.y)
      );

      if (combatCheck.shouldStartCombat) {
        // 전술 맵 생성 및 전투 시작
        const tacticalMap = await RealtimeCombatService.createTacticalMap(
          sessionId,
          Math.floor(fleet.strategicPosition.x),
          Math.floor(fleet.strategicPosition.y),
          combatCheck.fleetIds!
        );

        return {
          newPosition: fleet.strategicPosition,
          reachedDestination,
          combatTriggered: true,
          tacticalMapId: tacticalMap.tacticalMapId,
        };
      }

      return {
        newPosition: fleet.strategicPosition,
        reachedDestination,
      };
    } else {
      // 웨이포인트로 이동 중
      const ratio = moveDistance / distance;
      fleet.strategicPosition = {
        x: currentPos.x + dx * ratio,
        y: currentPos.y + dy * ratio,
      };

      await fleet.save();

      return {
        newPosition: fleet.strategicPosition,
        reachedDestination: false,
      };
    }
  }

  /**
   * 전투 발생 체크
   */
  private static async checkForCombat(
    sessionId: string,
    gridX: number,
    gridY: number
  ): Promise<{
    shouldStartCombat: boolean;
    fleetIds?: string[];
  }> {
    // 같은 그리드 셀에 있는 함대 조회
    const fleets = await Fleet.find({
      session_id: sessionId,
      'strategicPosition.x': { $gte: gridX, $lt: gridX + 1 },
      'strategicPosition.y': { $gte: gridY, $lt: gridY + 1 },
      status: { $ne: 'destroyed' },
    });

    if (fleets.length < 2) {
      return { shouldStartCombat: false };
    }

    // 다른 진영이 있는지 확인
    const factions = new Set(fleets.map((f) => f.faction));
    
    if (factions.size <= 1) {
      return { shouldStartCombat: false };
    }

    // 이미 전투 중인지 확인
    const activeCombat = await RealtimeCombatService.getActiveCombatAtPosition(
      sessionId,
      gridX,
      gridY
    );

    if (activeCombat) {
      // 이미 전투가 진행 중이면 새 함대를 전투에 추가
      return { shouldStartCombat: false };
    }

    return {
      shouldStartCombat: true,
      fleetIds: fleets.map((f) => f.fleetId),
    };
  }

  /**
   * 모든 이동 중인 함대 업데이트 (게임 루프에서 호출)
   */
  static async updateAllMovingFleets(
    sessionId: string,
    deltaTime: number
  ): Promise<void> {
    const movingFleets = await Fleet.find({
      session_id: sessionId,
      isMoving: true,
      isInCombat: false, // 전투 중이 아닌 함대만
    });

    for (const fleet of movingFleets) {
      try {
        await this.updateFleetMovement(sessionId, fleet.fleetId, deltaTime);
      } catch (error) {
        console.error(`Error updating fleet ${fleet.fleetId}:`, error);
      }
    }
  }

  /**
   * 함대 이동 취소
   */
  static async cancelMovement(
    sessionId: string,
    fleetId: string
  ): Promise<{ success: boolean; message: string }> {
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

    fleet.isMoving = false;
    fleet.movementPath = [];
    fleet.destination = undefined;
    fleet.status = 'idle';
    await fleet.save();

    return {
      success: true,
      message: '이동이 취소되었습니다.',
    };
  }
}
