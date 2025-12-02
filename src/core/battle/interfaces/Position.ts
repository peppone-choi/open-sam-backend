/**
 * 통합 Position 시스템
 * 삼국지(그리드) + 은하영웅전설(연속) 좌표 통합
 */

// ============================================================================
// 기본 위치 인터페이스
// ============================================================================

/**
 * 기본 2D 위치 (공통)
 */
export interface IPosition2D {
  x: number;
  y: number;
}

/**
 * 3D 위치 (높이 포함, 삼국지 지형용)
 */
export interface IPosition3D extends IPosition2D {
  z: number;
}

/**
 * 속도 벡터 (은영전 실시간 이동용)
 */
export interface IVelocity2D extends IPosition2D {
  // x: 초당 x축 이동량
  // y: 초당 y축 이동량
}

// ============================================================================
// 위치 타입 (게임별)
// ============================================================================

/**
 * 그리드 위치 (정수 좌표, 삼국지용)
 * - 전투 맵: 40x40 그리드
 * - 전략 맵: 가변 크기
 */
export interface IGridPosition extends IPosition2D {
  readonly type: 'grid';
  x: number; // 정수 (0-39 for 40x40 map)
  y: number; // 정수 (0-39 for 40x40 map)
}

/**
 * 그리드 3D 위치 (높이 포함, 삼국지 공성전용)
 */
export interface IGridPosition3D extends IPosition3D {
  readonly type: 'grid3d';
  x: number; // 정수
  y: number; // 정수
  z: number; // 높이 레벨 (HeightLevel enum 참조)
}

/**
 * 연속 위치 (실수 좌표, 은영전용)
 * - 전술 맵: 10000x10000 연속 좌표
 * - 전략 맵: 100x50 그리드 (별도 strategicPosition으로 관리)
 */
export interface IContinuousPosition extends IPosition2D {
  readonly type: 'continuous';
  x: number; // 실수 (0.0-10000.0)
  y: number; // 실수 (0.0-10000.0)
}

/**
 * 실시간 이동 위치 (속도, 방향 포함)
 */
export interface IMovingPosition extends IContinuousPosition {
  velocity: IVelocity2D;
  heading: number; // 방향 (0-360도, 0=오른쪽, 90=위)
}

// ============================================================================
// 통합 위치 타입
// ============================================================================

/**
 * 모든 2D 위치 타입의 유니온
 */
export type Position2D = IGridPosition | IContinuousPosition;

/**
 * 모든 위치 타입의 유니온
 */
export type Position = IGridPosition | IGridPosition3D | IContinuousPosition | IMovingPosition;

// ============================================================================
// 타입 가드
// ============================================================================

export function isGridPosition(pos: Position | IPosition2D): pos is IGridPosition {
  return 'type' in pos && pos.type === 'grid';
}

export function isGridPosition3D(pos: Position | IPosition2D): pos is IGridPosition3D {
  return 'type' in pos && pos.type === 'grid3d';
}

export function isContinuousPosition(pos: Position | IPosition2D): pos is IContinuousPosition {
  return 'type' in pos && pos.type === 'continuous';
}

export function isMovingPosition(pos: Position | IPosition2D): pos is IMovingPosition {
  return isContinuousPosition(pos) && 'velocity' in pos && 'heading' in pos;
}

// ============================================================================
// 위치 변환 유틸리티
// ============================================================================

/**
 * 맵 크기 설정
 */
export interface IMapSize {
  width: number;
  height: number;
}

/**
 * 좌표 변환 옵션
 */
export interface IConversionOptions {
  gridSize: IMapSize;     // 그리드 크기 (예: 40x40)
  worldSize: IMapSize;    // 월드 크기 (예: 10000x10000)
  centerInCell?: boolean; // 셀 중앙에 배치할지 여부
}

/**
 * 기본 변환 설정
 */
export const DEFAULT_SAMGUKJI_OPTIONS: IConversionOptions = {
  gridSize: { width: 40, height: 40 },
  worldSize: { width: 1600, height: 1600 },
  centerInCell: true,
};

export const DEFAULT_LOGH_OPTIONS: IConversionOptions = {
  gridSize: { width: 100, height: 50 },     // 전략 그리드
  worldSize: { width: 10000, height: 10000 }, // 전술 맵
  centerInCell: true,
};

/**
 * 위치 변환 유틸리티 클래스
 */
export class PositionConverter {
  /**
   * 그리드 → 연속 좌표 변환
   */
  static gridToContinuous(
    grid: IGridPosition | IGridPosition3D,
    options: IConversionOptions = DEFAULT_LOGH_OPTIONS
  ): IContinuousPosition {
    const scaleX = options.worldSize.width / options.gridSize.width;
    const scaleY = options.worldSize.height / options.gridSize.height;
    const offset = options.centerInCell ? 0.5 : 0;

    return {
      type: 'continuous',
      x: (grid.x + offset) * scaleX,
      y: (grid.y + offset) * scaleY,
    };
  }

  /**
   * 연속 → 그리드 좌표 변환
   */
  static continuousToGrid(
    continuous: IContinuousPosition | IMovingPosition,
    options: IConversionOptions = DEFAULT_LOGH_OPTIONS
  ): IGridPosition {
    const scaleX = options.worldSize.width / options.gridSize.width;
    const scaleY = options.worldSize.height / options.gridSize.height;

    return {
      type: 'grid',
      x: Math.floor(continuous.x / scaleX),
      y: Math.floor(continuous.y / scaleY),
    };
  }

  /**
   * 유클리드 거리 계산 (연속 좌표용)
   */
  static euclideanDistance(a: IPosition2D, b: IPosition2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 맨해튼 거리 계산 (그리드 좌표용)
   */
  static manhattanDistance(a: IPosition2D, b: IPosition2D): number {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }

  /**
   * 체비셰프 거리 계산 (대각선 1칸 이동용)
   */
  static chebyshevDistance(a: IPosition2D, b: IPosition2D): number {
    return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  }

  /**
   * 두 위치 사이 방향 각도 계산 (라디안)
   */
  static angle(from: IPosition2D, to: IPosition2D): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  /**
   * 두 위치 사이 방향 각도 계산 (도)
   */
  static angleDegrees(from: IPosition2D, to: IPosition2D): number {
    return this.angle(from, to) * (180 / Math.PI);
  }

  /**
   * 방향 벡터 정규화 (단위 벡터)
   */
  static normalize(vector: IPosition2D): IPosition2D {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (length === 0) return { x: 0, y: 0 };
    return {
      x: vector.x / length,
      y: vector.y / length,
    };
  }

  /**
   * 두 위치 사이의 방향 벡터 (정규화됨)
   */
  static direction(from: IPosition2D, to: IPosition2D): IPosition2D {
    return this.normalize({
      x: to.x - from.x,
      y: to.y - from.y,
    });
  }

  /**
   * 위치 이동 (deltaTime 기반)
   */
  static move(
    position: IContinuousPosition,
    velocity: IVelocity2D,
    deltaTime: number
  ): IContinuousPosition {
    return {
      type: 'continuous',
      x: position.x + velocity.x * deltaTime,
      y: position.y + velocity.y * deltaTime,
    };
  }

  /**
   * 목표 지점을 향한 속도 벡터 생성
   */
  static velocityTowards(
    from: IPosition2D,
    to: IPosition2D,
    speed: number
  ): IVelocity2D {
    const dir = this.direction(from, to);
    return {
      x: dir.x * speed,
      y: dir.y * speed,
    };
  }

  /**
   * 위치가 경계 내에 있는지 확인
   */
  static isInBounds(pos: IPosition2D, bounds: IMapSize): boolean {
    return pos.x >= 0 && pos.x < bounds.width && pos.y >= 0 && pos.y < bounds.height;
  }

  /**
   * 위치를 경계 내로 클램핑
   */
  static clamp(pos: IPosition2D, bounds: IMapSize): IPosition2D {
    return {
      x: Math.max(0, Math.min(bounds.width - 1, pos.x)),
      y: Math.max(0, Math.min(bounds.height - 1, pos.y)),
    };
  }

  /**
   * 그리드 위치 생성 헬퍼
   */
  static createGrid(x: number, y: number): IGridPosition {
    return { type: 'grid', x: Math.floor(x), y: Math.floor(y) };
  }

  /**
   * 연속 위치 생성 헬퍼
   */
  static createContinuous(x: number, y: number): IContinuousPosition {
    return { type: 'continuous', x, y };
  }

  /**
   * 이동 위치 생성 헬퍼
   */
  static createMoving(
    x: number,
    y: number,
    vx: number = 0,
    vy: number = 0,
    heading: number = 0
  ): IMovingPosition {
    return {
      type: 'continuous',
      x,
      y,
      velocity: { x: vx, y: vy },
      heading,
    };
  }
}

// ============================================================================
// 경로 탐색 관련
// ============================================================================

/**
 * 경로 노드 (A* 등에서 사용)
 */
export interface IPathNode {
  position: IGridPosition;
  g: number; // 시작점부터의 비용
  h: number; // 휴리스틱 (목표까지 예상 비용)
  f: number; // g + h
  parent?: IPathNode;
}

/**
 * 경로 (그리드 위치 배열)
 */
export type GridPath = IGridPosition[];

/**
 * 경로 (연속 위치 배열)
 */
export type ContinuousPath = IContinuousPosition[];

/**
 * 통합 경로 타입
 */
export type Path = GridPath | ContinuousPath;




