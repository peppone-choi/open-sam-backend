import { EventEmitter } from 'events';
import { GalaxyGrid, IGalaxyGrid, GridTerrain, GRID_CONSTANTS } from '../../models/gin7/GalaxyGrid';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

/**
 * 3D 그리드 셀 타입
 */
export type GridCellType = 'EMPTY' | 'STAR_SYSTEM' | 'NEBULA' | 'ASTEROID' | 'IMPASSABLE' | 'BLACK_HOLE' | 'CORRIDOR';

/**
 * 3D 그리드 좌표
 */
export interface GridCoordinate {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D 그리드 셀 인터페이스
 */
export interface GridCell {
  x: number;
  y: number;
  z: number;
  type: GridCellType;
  systemId?: string;
  occupants: string[];  // Unit IDs
  factions: string[];   // Faction IDs present
  terrain: GridTerrain;
  modifiers: {
    movementCost: number;
    detectionRange: number;
    combatModifier: number;
    warpDisruption: number;  // 워프 방해 계수
  };
  metadata: Record<string, any>;
}

/**
 * 인접 그리드 방향
 */
export type AdjacentDirection = 
  | 'north' | 'south' | 'east' | 'west'      // 2D 기본
  | 'northeast' | 'northwest' | 'southeast' | 'southwest'  // 2D 대각선
  | 'up' | 'down'                            // 3D 수직
  | 'up_north' | 'up_south' | 'up_east' | 'up_west'  // 3D 대각선 상
  | 'down_north' | 'down_south' | 'down_east' | 'down_west';  // 3D 대각선 하

/**
 * 그리드 이벤트
 */
export const SPACE_GRID_EVENTS = {
  UNIT_ENTERED_GRID: 'GIN7:UNIT_ENTERED_GRID',
  UNIT_LEFT_GRID: 'GIN7:UNIT_LEFT_GRID',
  GRID_COMBAT_TRIGGERED: 'GIN7:GRID_COMBAT_TRIGGERED',
  GRID_CAPACITY_WARNING: 'GIN7:GRID_CAPACITY_WARNING',
  GRID_TERRAIN_CHANGED: 'GIN7:GRID_TERRAIN_CHANGED',
} as const;

/**
 * 3D 그리드 상수
 */
export const SPACE_GRID_CONSTANTS = {
  GRID_SIZE_X: 100,
  GRID_SIZE_Y: 100,
  GRID_SIZE_Z: 10,        // Z축 레벨 (0-9)
  MAX_UNITS_PER_GRID: 300,
  MAX_FACTIONS_PER_GRID: 2,
  
  // 지형별 이동 비용
  TERRAIN_MOVEMENT_COSTS: {
    normal: 1.0,
    nebula: 1.5,
    asteroid_field: 2.0,
    corridor: 0.8,        // 복도는 빠르게
    black_hole: Infinity, // 진입 불가
  } as const,
  
  // 지형별 탐지 수정치
  TERRAIN_DETECTION_MODIFIERS: {
    normal: 1.0,
    nebula: 0.5,          // 성운에서 탐지 어려움
    asteroid_field: 0.7,
    corridor: 1.2,        // 복도에서 탐지 용이
    black_hole: 0,
  } as const,
  
  // 지형별 워프 방해 계수
  TERRAIN_WARP_DISRUPTION: {
    normal: 0,
    nebula: 0.3,          // 성운에서 워프 불안정
    asteroid_field: 0.2,
    corridor: -0.1,       // 복도에서 워프 안정
    black_hole: 1.0,      // 완전 차단
  } as const,
} as const;

/**
 * 방향별 오프셋 매핑
 */
const DIRECTION_OFFSETS: Record<AdjacentDirection, GridCoordinate> = {
  north: { x: 0, y: -1, z: 0 },
  south: { x: 0, y: 1, z: 0 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  northeast: { x: 1, y: -1, z: 0 },
  northwest: { x: -1, y: -1, z: 0 },
  southeast: { x: 1, y: 1, z: 0 },
  southwest: { x: -1, y: 1, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  down: { x: 0, y: 0, z: -1 },
  up_north: { x: 0, y: -1, z: 1 },
  up_south: { x: 0, y: 1, z: 1 },
  up_east: { x: 1, y: 0, z: 1 },
  up_west: { x: -1, y: 0, z: 1 },
  down_north: { x: 0, y: -1, z: -1 },
  down_south: { x: 0, y: 1, z: -1 },
  down_east: { x: 1, y: 0, z: -1 },
  down_west: { x: -1, y: 0, z: -1 },
};

/**
 * SpaceGridService
 * 
 * 3D 공간 그리드 관리 서비스
 * - 그리드 셀 상태 관리
 * - 유닛 추적
 * - 인접 그리드 조회
 * - 지형 효과 계산
 */
export class SpaceGridService extends EventEmitter {
  private static instance: SpaceGridService;
  
  // 메모리 캐시: sessionId -> (key: `${x},${y},${z}`) -> GridCell
  private gridCache: Map<string, Map<string, GridCell>> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): SpaceGridService {
    if (!SpaceGridService.instance) {
      SpaceGridService.instance = new SpaceGridService();
    }
    return SpaceGridService.instance;
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    logger.info('[SpaceGridService] Initialized');
  }

  /**
   * 서비스 종료
   */
  public async shutdown(): Promise<void> {
    this.gridCache.clear();
    logger.info('[SpaceGridService] Shutdown');
  }

  // ============================================================
  // 그리드 셀 관리
  // ============================================================

  /**
   * 그리드 좌표 키 생성
   */
  private getGridKey(x: number, y: number, z: number = 0): string {
    return `${x},${y},${z}`;
  }

  /**
   * 좌표 유효성 검증
   */
  public validateCoordinates(x: number, y: number, z: number = 0): boolean {
    return (
      x >= 0 && x < SPACE_GRID_CONSTANTS.GRID_SIZE_X &&
      y >= 0 && y < SPACE_GRID_CONSTANTS.GRID_SIZE_Y &&
      z >= 0 && z < SPACE_GRID_CONSTANTS.GRID_SIZE_Z
    );
  }

  /**
   * 그리드 셀 가져오기 (없으면 생성)
   */
  public async getOrCreateGridCell(
    sessionId: string,
    x: number,
    y: number,
    z: number = 0
  ): Promise<GridCell> {
    if (!this.validateCoordinates(x, y, z)) {
      throw new Error(`Invalid coordinates: (${x}, ${y}, ${z})`);
    }

    const key = this.getGridKey(x, y, z);
    
    // 캐시 확인
    let sessionCache = this.gridCache.get(sessionId);
    if (!sessionCache) {
      sessionCache = new Map();
      this.gridCache.set(sessionId, sessionCache);
    }

    let cell = sessionCache.get(key);
    if (cell) {
      return cell;
    }

    // DB에서 로드 (z=0일 경우 기존 GalaxyGrid 사용)
    if (z === 0) {
      const dbGrid = await GalaxyGrid.findOne({ sessionId, x, y });
      if (dbGrid) {
        cell = this.dbGridToCell(dbGrid, z);
        sessionCache.set(key, cell);
        return cell;
      }
    }

    // 새 셀 생성
    cell = this.createEmptyCell(x, y, z);
    sessionCache.set(key, cell);
    return cell;
  }

  /**
   * 빈 그리드 셀 생성
   */
  private createEmptyCell(x: number, y: number, z: number): GridCell {
    return {
      x,
      y,
      z,
      type: 'EMPTY',
      occupants: [],
      factions: [],
      terrain: 'normal',
      modifiers: {
        movementCost: 1.0,
        detectionRange: 1.0,
        combatModifier: 1.0,
        warpDisruption: 0,
      },
      metadata: {},
    };
  }

  /**
   * DB Grid를 GridCell로 변환
   */
  private dbGridToCell(dbGrid: IGalaxyGrid, z: number): GridCell {
    const terrainType = this.mapTerrainToType(dbGrid.terrain);
    return {
      x: dbGrid.x,
      y: dbGrid.y,
      z,
      type: terrainType,
      systemId: dbGrid.starSystemIds?.[0],
      occupants: dbGrid.occupants || [],
      factions: dbGrid.ownerFactions || [],
      terrain: dbGrid.terrain,
      modifiers: {
        movementCost: dbGrid.terrainModifiers?.movementCost ?? 1.0,
        detectionRange: dbGrid.terrainModifiers?.detectionRange ?? 1.0,
        combatModifier: dbGrid.terrainModifiers?.combatModifier ?? 1.0,
        warpDisruption: SPACE_GRID_CONSTANTS.TERRAIN_WARP_DISRUPTION[dbGrid.terrain] ?? 0,
      },
      metadata: dbGrid.data || {},
    };
  }

  /**
   * 지형을 GridCellType으로 매핑
   */
  private mapTerrainToType(terrain: GridTerrain): GridCellType {
    switch (terrain) {
      case 'nebula': return 'NEBULA';
      case 'asteroid_field': return 'ASTEROID';
      case 'black_hole': return 'BLACK_HOLE';
      case 'corridor': return 'CORRIDOR';
      default: return 'EMPTY';
    }
  }

  /**
   * 그리드 셀 타입 설정
   */
  public async setGridCellType(
    sessionId: string,
    x: number,
    y: number,
    z: number,
    type: GridCellType,
    systemId?: string
  ): Promise<GridCell> {
    const cell = await this.getOrCreateGridCell(sessionId, x, y, z);
    cell.type = type;
    if (systemId) {
      cell.systemId = systemId;
    }
    
    // 지형 수정치 업데이트
    this.updateCellModifiers(cell);
    
    // DB 동기화 (z=0인 경우)
    if (z === 0) {
      await this.syncCellToDb(sessionId, cell);
    }

    this.emitGridEvent(SPACE_GRID_EVENTS.GRID_TERRAIN_CHANGED, {
      sessionId,
      x, y, z,
      type,
      systemId,
    });

    return cell;
  }

  /**
   * 셀 수정치 업데이트
   */
  private updateCellModifiers(cell: GridCell): void {
    const terrain = cell.terrain;
    cell.modifiers.movementCost = SPACE_GRID_CONSTANTS.TERRAIN_MOVEMENT_COSTS[terrain] ?? 1.0;
    cell.modifiers.detectionRange = SPACE_GRID_CONSTANTS.TERRAIN_DETECTION_MODIFIERS[terrain] ?? 1.0;
    cell.modifiers.warpDisruption = SPACE_GRID_CONSTANTS.TERRAIN_WARP_DISRUPTION[terrain] ?? 0;
  }

  /**
   * 셀을 DB에 동기화
   */
  private async syncCellToDb(sessionId: string, cell: GridCell): Promise<void> {
    await GalaxyGrid.findOneAndUpdate(
      { sessionId, x: cell.x, y: cell.y },
      {
        $set: {
          terrain: cell.terrain,
          occupants: cell.occupants,
          ownerFactions: cell.factions,
          terrainModifiers: {
            movementCost: cell.modifiers.movementCost,
            detectionRange: cell.modifiers.detectionRange,
            combatModifier: cell.modifiers.combatModifier,
          },
          data: cell.metadata,
        },
        $setOnInsert: {
          sessionId,
          x: cell.x,
          y: cell.y,
          starSystemIds: cell.systemId ? [cell.systemId] : [],
          exploredBy: [],
        },
      },
      { upsert: true }
    );
  }

  // ============================================================
  // 유닛 추적
  // ============================================================

  /**
   * 그리드에 유닛 추가
   */
  public async addUnitToGrid(
    sessionId: string,
    x: number,
    y: number,
    z: number,
    unitId: string,
    factionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const cell = await this.getOrCreateGridCell(sessionId, x, y, z);

    // 용량 체크
    if (cell.occupants.length >= SPACE_GRID_CONSTANTS.MAX_UNITS_PER_GRID) {
      return { 
        success: false, 
        error: `Grid (${x},${y},${z}) is full (max ${SPACE_GRID_CONSTANTS.MAX_UNITS_PER_GRID} units)` 
      };
    }

    // 진영 수 체크
    const uniqueFactions = new Set([...cell.factions, factionId]);
    if (!cell.factions.includes(factionId) && uniqueFactions.size > SPACE_GRID_CONSTANTS.MAX_FACTIONS_PER_GRID) {
      return { 
        success: false, 
        error: `Grid (${x},${y},${z}) already has max factions (${SPACE_GRID_CONSTANTS.MAX_FACTIONS_PER_GRID})` 
      };
    }

    // 유닛 추가
    if (!cell.occupants.includes(unitId)) {
      cell.occupants.push(unitId);
    }
    if (!cell.factions.includes(factionId)) {
      cell.factions.push(factionId);
    }

    // DB 동기화
    if (z === 0) {
      await GalaxyGrid.addUnitToGrid(sessionId, x, y, unitId, factionId);
    }

    // 용량 경고
    if (cell.occupants.length > SPACE_GRID_CONSTANTS.MAX_UNITS_PER_GRID * 0.8) {
      this.emitGridEvent(SPACE_GRID_EVENTS.GRID_CAPACITY_WARNING, {
        sessionId, x, y, z,
        currentUnits: cell.occupants.length,
        maxUnits: SPACE_GRID_CONSTANTS.MAX_UNITS_PER_GRID,
      });
    }

    // 전투 트리거 체크
    if (cell.factions.length > 1) {
      this.emitGridEvent(SPACE_GRID_EVENTS.GRID_COMBAT_TRIGGERED, {
        sessionId, x, y, z,
        factions: cell.factions,
        unitCount: cell.occupants.length,
      });
    }

    this.emitGridEvent(SPACE_GRID_EVENTS.UNIT_ENTERED_GRID, {
      sessionId, x, y, z,
      unitId, factionId,
      totalUnits: cell.occupants.length,
    });

    logger.debug(`[SpaceGridService] Unit ${unitId} entered grid (${x},${y},${z})`);
    return { success: true };
  }

  /**
   * 그리드에서 유닛 제거
   */
  public async removeUnitFromGrid(
    sessionId: string,
    x: number,
    y: number,
    z: number,
    unitId: string,
    factionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = this.getGridKey(x, y, z);
    const sessionCache = this.gridCache.get(sessionId);
    const cell = sessionCache?.get(key);

    if (!cell) {
      return { success: false, error: 'Grid cell not found' };
    }

    // 유닛 제거
    cell.occupants = cell.occupants.filter(id => id !== unitId);

    // 해당 진영의 다른 유닛이 없으면 진영도 제거
    // (실제로는 모든 유닛의 진영을 확인해야 하지만, 간소화)
    const factionUnitsRemain = cell.occupants.length > 0;
    if (!factionUnitsRemain) {
      cell.factions = cell.factions.filter(id => id !== factionId);
    }

    // DB 동기화
    if (z === 0) {
      await GalaxyGrid.removeUnitFromGrid(sessionId, x, y, unitId, factionId);
    }

    this.emitGridEvent(SPACE_GRID_EVENTS.UNIT_LEFT_GRID, {
      sessionId, x, y, z,
      unitId, factionId,
      totalUnits: cell.occupants.length,
    });

    logger.debug(`[SpaceGridService] Unit ${unitId} left grid (${x},${y},${z})`);
    return { success: true };
  }

  /**
   * 그리드 내 유닛 목록 조회
   */
  public async getUnitsInGrid(
    sessionId: string,
    x: number,
    y: number,
    z: number = 0
  ): Promise<string[]> {
    const cell = await this.getOrCreateGridCell(sessionId, x, y, z);
    return [...cell.occupants];
  }

  /**
   * 그리드 내 진영 목록 조회
   */
  public async getFactionsInGrid(
    sessionId: string,
    x: number,
    y: number,
    z: number = 0
  ): Promise<string[]> {
    const cell = await this.getOrCreateGridCell(sessionId, x, y, z);
    return [...cell.factions];
  }

  // ============================================================
  // 인접 그리드 조회
  // ============================================================

  /**
   * 인접 그리드 조회 (특정 방향)
   */
  public getAdjacentCoordinate(
    x: number,
    y: number,
    z: number,
    direction: AdjacentDirection
  ): GridCoordinate | null {
    const offset = DIRECTION_OFFSETS[direction];
    const newX = x + offset.x;
    const newY = y + offset.y;
    const newZ = z + offset.z;

    if (!this.validateCoordinates(newX, newY, newZ)) {
      return null;
    }

    return { x: newX, y: newY, z: newZ };
  }

  /**
   * 모든 인접 그리드 좌표 조회 (2D - 8방향)
   */
  public getAdjacentCoordinates2D(x: number, y: number, z: number = 0): GridCoordinate[] {
    const directions: AdjacentDirection[] = [
      'north', 'south', 'east', 'west',
      'northeast', 'northwest', 'southeast', 'southwest'
    ];

    return directions
      .map(dir => this.getAdjacentCoordinate(x, y, z, dir))
      .filter((coord): coord is GridCoordinate => coord !== null);
  }

  /**
   * 모든 인접 그리드 좌표 조회 (3D - 26방향)
   */
  public getAdjacentCoordinates3D(x: number, y: number, z: number): GridCoordinate[] {
    const coords: GridCoordinate[] = [];
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          
          const newX = x + dx;
          const newY = y + dy;
          const newZ = z + dz;
          
          if (this.validateCoordinates(newX, newY, newZ)) {
            coords.push({ x: newX, y: newY, z: newZ });
          }
        }
      }
    }

    return coords;
  }

  /**
   * 인접 그리드 셀 조회
   */
  public async getAdjacentCells(
    sessionId: string,
    x: number,
    y: number,
    z: number,
    is3D: boolean = false
  ): Promise<GridCell[]> {
    const coords = is3D 
      ? this.getAdjacentCoordinates3D(x, y, z)
      : this.getAdjacentCoordinates2D(x, y, z);

    const cells: GridCell[] = [];
    for (const coord of coords) {
      const cell = await this.getOrCreateGridCell(sessionId, coord.x, coord.y, coord.z);
      cells.push(cell);
    }

    return cells;
  }

  /**
   * 특정 범위 내 모든 그리드 셀 조회
   */
  public async getCellsInRange(
    sessionId: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    range: number
  ): Promise<GridCell[]> {
    const cells: GridCell[] = [];

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        for (let dz = -range; dz <= range; dz++) {
          const x = centerX + dx;
          const y = centerY + dy;
          const z = centerZ + dz;

          if (this.validateCoordinates(x, y, z)) {
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance <= range) {
              const cell = await this.getOrCreateGridCell(sessionId, x, y, z);
              cells.push(cell);
            }
          }
        }
      }
    }

    return cells;
  }

  // ============================================================
  // 거리 및 경로 계산
  // ============================================================

  /**
   * 두 그리드 간 맨해튼 거리
   */
  public calculateManhattanDistance(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(z2 - z1);
  }

  /**
   * 두 그리드 간 유클리드 거리
   */
  public calculateEuclideanDistance(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 두 그리드 간 체비쇼프 거리 (대각선 이동 포함)
   */
  public calculateChebyshevDistance(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    return Math.max(
      Math.abs(x2 - x1),
      Math.abs(y2 - y1),
      Math.abs(z2 - z1)
    );
  }

  /**
   * 이동 비용 계산 (지형 고려)
   */
  public async calculateMovementCost(
    sessionId: string,
    fromX: number, fromY: number, fromZ: number,
    toX: number, toY: number, toZ: number
  ): Promise<number> {
    const destinationCell = await this.getOrCreateGridCell(sessionId, toX, toY, toZ);
    const baseDistance = this.calculateEuclideanDistance(fromX, fromY, fromZ, toX, toY, toZ);
    return baseDistance * destinationCell.modifiers.movementCost;
  }

  // ============================================================
  // 이벤트 발송
  // ============================================================

  private emitGridEvent(eventName: string, payload: any): void {
    this.emit(eventName, payload);
    
    const socketManager = getSocketManager();
    if (socketManager && payload.sessionId) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }

  // ============================================================
  // 캐시 관리
  // ============================================================

  /**
   * 세션 캐시 클리어
   */
  public clearSessionCache(sessionId: string): void {
    this.gridCache.delete(sessionId);
    logger.info(`[SpaceGridService] Cleared cache for session ${sessionId}`);
  }

  /**
   * 전체 캐시 통계
   */
  public getCacheStats(): { sessions: number; totalCells: number } {
    let totalCells = 0;
    for (const cache of this.gridCache.values()) {
      totalCells += cache.size;
    }
    return {
      sessions: this.gridCache.size,
      totalCells,
    };
  }
}

// 싱글톤 getter
export function getSpaceGridService(): SpaceGridService {
  return SpaceGridService.getInstance();
}







