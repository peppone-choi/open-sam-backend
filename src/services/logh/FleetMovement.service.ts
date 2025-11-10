/**
 * LOGH Fleet Movement Service
 * 100x50 그리드 맵에서 함대 이동 처리
 */

import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { MapGrid } from '../../models/logh/MapGrid.model';
import { FleetCombatService } from './FleetCombat.service';

interface GridPosition {
  x: number;
  y: number;
}

export class FleetMovementService {
  /**
   * A* 경로 탐색 알고리즘
   */
  static async findPath(
    sessionId: string,
    start: GridPosition,
    end: GridPosition,
    maxDistance: number
  ): Promise<GridPosition[] | null> {
    // 맵 그리드 가져오기
    const mapGrid = await MapGrid.findOne({ session_id: sessionId });
    if (!mapGrid) {
      throw new Error('Map grid not found');
    }

    // A* 알고리즘 구현
    const openSet = new Set<string>();
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, GridPosition>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startKey = `${start.x},${start.y}`;
    const endKey = `${end.x},${end.y}`;

    openSet.add(startKey);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, end));

    while (openSet.size > 0) {
      // fScore가 가장 낮은 노드 선택
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

      // 목표 도달
      if (current === endKey) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      closedSet.add(current);

      const [cx, cy] = current.split(',').map(Number);
      const currentPos = { x: cx, y: cy };

      // 이웃 노드 탐색 (상하좌우)
      const neighbors = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 },
      ];

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // 범위 체크
        if (
          neighbor.x < 0 ||
          neighbor.x >= 100 ||
          neighbor.y < 0 ||
          neighbor.y >= 50
        ) {
          continue;
        }

        // 항행 불가능 영역 체크
        if (mapGrid.grid[neighbor.y][neighbor.x] === 0) {
          continue;
        }

        // 이미 처리된 노드
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = (gScore.get(current) || 0) + 1;

        // 최대 거리 체크
        if (tentativeGScore > maxDistance) {
          continue;
        }

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

    return null; // 경로 없음
  }

  /**
   * 휴리스틱 함수 (맨해튼 거리)
   */
  private static heuristic(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * 경로 재구성
   */
  private static reconstructPath(
    cameFrom: Map<string, GridPosition>,
    current: string
  ): GridPosition[] {
    const path: GridPosition[] = [];
    const [x, y] = current.split(',').map(Number);
    let currentPos: GridPosition | undefined = { x, y };

    while (currentPos) {
      path.unshift(currentPos);
      const key = `${currentPos.x},${currentPos.y}`;
      currentPos = cameFrom.get(key);
    }

    return path;
  }

  /**
   * 함대 이동 명령
   */
  static async moveFleet(
    sessionId: string,
    fleetId: string,
    destination: GridPosition
  ): Promise<{
    success: boolean;
    message: string;
    path?: GridPosition[];
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

    // 전투 중이면 이동 불가
    if (fleet.isInCombat) {
      return {
        success: false,
        message: '전투 중에는 이동할 수 없습니다.',
      };
    }

    // 목적지 유효성 검사
    if (
      destination.x < 0 ||
      destination.x >= 100 ||
      destination.y < 0 ||
      destination.y >= 49
    ) {
      return {
        success: false,
        message: '유효하지 않은 목적지입니다.',
      };
    }

    // 경로 탐색
    const path = await this.findPath(
      sessionId,
      fleet.gridPosition,
      destination,
      fleet.movementRange || 3
    );

    if (!path || path.length === 0) {
      return {
        success: false,
        message: '경로를 찾을 수 없거나 이동 거리가 너무 멉니다.',
      };
    }

    // 이동 설정
    fleet.destination = destination;
    fleet.movementPath = path;
    fleet.isMoving = true;
    fleet.status = 'moving';
    await fleet.save();

    return {
      success: true,
      message: '이동 명령이 설정되었습니다.',
      path,
    };
  }

  /**
   * 함대 즉시 이동 (턴 처리 시 호출)
   */
  static async executeMovement(
    sessionId: string,
    fleetId: string
  ): Promise<{
    success: boolean;
    message: string;
    newPosition?: GridPosition;
    reachedDestination?: boolean;
  }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet || !fleet.isMoving || !fleet.movementPath || fleet.movementPath.length === 0) {
      return {
        success: false,
        message: '이동 중인 함대가 아닙니다.',
      };
    }

    // 다음 위치로 이동 (경로의 첫 번째 지점 제거하고 다음 지점으로)
    const nextPosition = fleet.movementPath[1] || fleet.movementPath[0];
    
    fleet.gridPosition = {
      x: nextPosition.x,
      y: nextPosition.y,
    };

    // 경로에서 현재 위치 제거
    fleet.movementPath.shift();

    // 목적지 도착 여부 확인
    const reachedDestination = 
      fleet.movementPath.length === 0 ||
      (fleet.destination &&
        fleet.gridPosition.x === fleet.destination.x &&
        fleet.gridPosition.y === fleet.destination.y);

    if (reachedDestination) {
      fleet.isMoving = false;
      fleet.movementPath = [];
      fleet.destination = undefined;
      fleet.status = 'idle';
    }

    await fleet.save();

    // 도착 위치에서 전투 체크
    const combatCheck = await FleetCombatService.checkForAutoCombat(
      sessionId,
      fleet.gridPosition.x,
      fleet.gridPosition.y
    );

    if (combatCheck.hasCombat) {
      // 자동 전투 발생
      fleet.status = 'combat';
      fleet.isInCombat = true;
      await fleet.save();

      return {
        success: true,
        message: '이동 중 적 함대와 조우! 전투가 발생했습니다.',
        newPosition: fleet.gridPosition,
        reachedDestination,
      };
    }

    return {
      success: true,
      message: reachedDestination ? '목적지에 도착했습니다.' : '이동 중...',
      newPosition: fleet.gridPosition,
      reachedDestination,
    };
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

  /**
   * 이동 가능한 범위 계산 (턴당 이동 범위 내의 모든 좌표)
   */
  static async getMovementRange(
    sessionId: string,
    fleetId: string
  ): Promise<{
    success: boolean;
    range?: GridPosition[];
  }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return { success: false };
    }

    const mapGrid = await MapGrid.findOne({ session_id: sessionId });
    if (!mapGrid) {
      return { success: false };
    }

    const range: GridPosition[] = [];
    const maxRange = fleet.movementRange || 3;
    const { x, y } = fleet.gridPosition;

    // BFS로 이동 가능 범위 탐색
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      for (let dy = -maxRange; dy <= maxRange; dy++) {
        const nx = x + dx;
        const ny = y + dy;

        // 맨해튼 거리 체크
        if (Math.abs(dx) + Math.abs(dy) > maxRange) continue;

        // 범위 체크
        if (nx < 0 || nx >= 100 || ny < 0 || ny >= 50) continue;

        // 항행 가능 체크
        if (mapGrid.grid[ny][nx] === 1) {
          range.push({ x: nx, y: ny });
        }
      }
    }

    return {
      success: true,
      range,
    };
  }
}
