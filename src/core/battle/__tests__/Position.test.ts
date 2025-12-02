/**
 * Position System Tests
 * 통합 좌표 시스템 단위 테스트
 */

import {
  IPosition2D,
  IGridPosition,
  IContinuousPosition,
  IMovingPosition,
  PositionConverter,
  isGridPosition,
  isContinuousPosition,
  isMovingPosition,
  DEFAULT_SAMGUKJI_OPTIONS,
  DEFAULT_LOGH_OPTIONS,
} from '../interfaces/Position';

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Position Type Guards', () => {
  describe('isGridPosition', () => {
    it('should return true for grid position', () => {
      const pos: IGridPosition = { type: 'grid', x: 10, y: 20 };
      expect(isGridPosition(pos)).toBe(true);
    });

    it('should return false for continuous position', () => {
      const pos: IContinuousPosition = { type: 'continuous', x: 100.5, y: 200.5 };
      expect(isGridPosition(pos)).toBe(false);
    });

    it('should return false for plain position without type', () => {
      const pos: IPosition2D = { x: 10, y: 20 };
      expect(isGridPosition(pos)).toBe(false);
    });
  });

  describe('isContinuousPosition', () => {
    it('should return true for continuous position', () => {
      const pos: IContinuousPosition = { type: 'continuous', x: 100.5, y: 200.5 };
      expect(isContinuousPosition(pos)).toBe(true);
    });

    it('should return false for grid position', () => {
      const pos: IGridPosition = { type: 'grid', x: 10, y: 20 };
      expect(isContinuousPosition(pos)).toBe(false);
    });
  });

  describe('isMovingPosition', () => {
    it('should return true for moving position', () => {
      const pos: IMovingPosition = {
        type: 'continuous',
        x: 100,
        y: 200,
        velocity: { x: 10, y: 5 },
        heading: 45,
      };
      expect(isMovingPosition(pos)).toBe(true);
    });

    it('should return false for static continuous position', () => {
      const pos: IContinuousPosition = { type: 'continuous', x: 100, y: 200 };
      expect(isMovingPosition(pos)).toBe(false);
    });
  });
});

// ============================================================================
// Position Converter Tests
// ============================================================================

describe('PositionConverter', () => {
  describe('gridToContinuous', () => {
    it('should convert grid to continuous with default LOGH options', () => {
      const grid: IGridPosition = { type: 'grid', x: 50, y: 25 };
      const continuous = PositionConverter.gridToContinuous(grid, DEFAULT_LOGH_OPTIONS);

      // 100x50 그리드 → 10000x10000 월드
      // x: (50 + 0.5) * 100 = 5050
      // y: (25 + 0.5) * 200 = 5100
      expect(continuous.type).toBe('continuous');
      expect(continuous.x).toBe(5050);
      expect(continuous.y).toBe(5100);
    });

    it('should convert grid to continuous with Samgukji options', () => {
      const grid: IGridPosition = { type: 'grid', x: 20, y: 20 };
      const continuous = PositionConverter.gridToContinuous(grid, DEFAULT_SAMGUKJI_OPTIONS);

      // 40x40 그리드 → 1600x1600 월드
      // x: (20 + 0.5) * 40 = 820
      // y: (20 + 0.5) * 40 = 820
      expect(continuous.x).toBe(820);
      expect(continuous.y).toBe(820);
    });

    it('should handle edge positions', () => {
      const grid: IGridPosition = { type: 'grid', x: 0, y: 0 };
      const continuous = PositionConverter.gridToContinuous(grid, DEFAULT_LOGH_OPTIONS);

      expect(continuous.x).toBe(50); // (0 + 0.5) * 100
      expect(continuous.y).toBe(100); // (0 + 0.5) * 200
    });
  });

  describe('continuousToGrid', () => {
    it('should convert continuous to grid', () => {
      const continuous: IContinuousPosition = { type: 'continuous', x: 5000, y: 5000 };
      const grid = PositionConverter.continuousToGrid(continuous, DEFAULT_LOGH_OPTIONS);

      expect(grid.type).toBe('grid');
      expect(grid.x).toBe(50); // 5000 / 100
      expect(grid.y).toBe(25); // 5000 / 200
    });

    it('should floor to nearest grid cell', () => {
      const continuous: IContinuousPosition = { type: 'continuous', x: 5099, y: 5199 };
      const grid = PositionConverter.continuousToGrid(continuous, DEFAULT_LOGH_OPTIONS);

      expect(grid.x).toBe(50);
      expect(grid.y).toBe(25);
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate distance correctly', () => {
      const a: IPosition2D = { x: 0, y: 0 };
      const b: IPosition2D = { x: 3, y: 4 };

      expect(PositionConverter.euclideanDistance(a, b)).toBe(5);
    });

    it('should return 0 for same points', () => {
      const p: IPosition2D = { x: 100, y: 200 };

      expect(PositionConverter.euclideanDistance(p, p)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const a: IPosition2D = { x: -3, y: -4 };
      const b: IPosition2D = { x: 0, y: 0 };

      expect(PositionConverter.euclideanDistance(a, b)).toBe(5);
    });

    it('should handle large distances (tactical map scale)', () => {
      const a: IPosition2D = { x: 0, y: 0 };
      const b: IPosition2D = { x: 10000, y: 10000 };

      expect(PositionConverter.euclideanDistance(a, b)).toBeCloseTo(14142.13, 1);
    });
  });

  describe('manhattanDistance', () => {
    it('should calculate Manhattan distance', () => {
      const a: IPosition2D = { x: 0, y: 0 };
      const b: IPosition2D = { x: 3, y: 4 };

      expect(PositionConverter.manhattanDistance(a, b)).toBe(7);
    });

    it('should return 0 for same points', () => {
      const p: IPosition2D = { x: 10, y: 20 };

      expect(PositionConverter.manhattanDistance(p, p)).toBe(0);
    });
  });

  describe('chebyshevDistance', () => {
    it('should calculate Chebyshev distance', () => {
      const a: IPosition2D = { x: 0, y: 0 };
      const b: IPosition2D = { x: 3, y: 4 };

      expect(PositionConverter.chebyshevDistance(a, b)).toBe(4);
    });

    it('should return max of x and y differences', () => {
      const a: IPosition2D = { x: 0, y: 0 };
      const b: IPosition2D = { x: 10, y: 3 };

      expect(PositionConverter.chebyshevDistance(a, b)).toBe(10);
    });
  });

  describe('angle', () => {
    it('should return 0 for pointing right', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 1, y: 0 };

      expect(PositionConverter.angle(from, to)).toBe(0);
    });

    it('should return PI/2 for pointing up', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 0, y: 1 };

      expect(PositionConverter.angle(from, to)).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('angleDegrees', () => {
    it('should return 0 for pointing right', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 1, y: 0 };

      expect(PositionConverter.angleDegrees(from, to)).toBe(0);
    });

    it('should return 90 for pointing up', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 0, y: 1 };

      expect(PositionConverter.angleDegrees(from, to)).toBeCloseTo(90, 5);
    });

    it('should return 45 for diagonal', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 1, y: 1 };

      expect(PositionConverter.angleDegrees(from, to)).toBeCloseTo(45, 5);
    });
  });

  describe('normalize', () => {
    it('should normalize vector to unit length', () => {
      const v: IPosition2D = { x: 3, y: 4 };
      const normalized = PositionConverter.normalize(v);

      expect(normalized.x).toBeCloseTo(0.6, 5);
      expect(normalized.y).toBeCloseTo(0.8, 5);
    });

    it('should return zero vector for zero input', () => {
      const v: IPosition2D = { x: 0, y: 0 };
      const normalized = PositionConverter.normalize(v);

      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });

    it('should keep unit vectors unchanged', () => {
      const v: IPosition2D = { x: 1, y: 0 };
      const normalized = PositionConverter.normalize(v);

      expect(normalized.x).toBe(1);
      expect(normalized.y).toBe(0);
    });
  });

  describe('direction', () => {
    it('should return normalized direction vector', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 3, y: 4 };
      const dir = PositionConverter.direction(from, to);

      expect(dir.x).toBeCloseTo(0.6, 5);
      expect(dir.y).toBeCloseTo(0.8, 5);
    });
  });

  describe('move', () => {
    it('should move position by velocity * deltaTime', () => {
      const pos: IContinuousPosition = { type: 'continuous', x: 100, y: 100 };
      const velocity = { x: 50, y: 25 };
      const deltaTime = 0.5;

      const newPos = PositionConverter.move(pos, velocity, deltaTime);

      expect(newPos.x).toBe(125); // 100 + 50 * 0.5
      expect(newPos.y).toBe(112.5); // 100 + 25 * 0.5
    });

    it('should handle zero velocity', () => {
      const pos: IContinuousPosition = { type: 'continuous', x: 100, y: 100 };
      const velocity = { x: 0, y: 0 };
      const deltaTime = 1;

      const newPos = PositionConverter.move(pos, velocity, deltaTime);

      expect(newPos.x).toBe(100);
      expect(newPos.y).toBe(100);
    });
  });

  describe('velocityTowards', () => {
    it('should create velocity vector towards target', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 100, y: 0 };
      const speed = 50;

      const velocity = PositionConverter.velocityTowards(from, to, speed);

      expect(velocity.x).toBe(50);
      expect(velocity.y).toBe(0);
    });

    it('should handle diagonal movement', () => {
      const from: IPosition2D = { x: 0, y: 0 };
      const to: IPosition2D = { x: 100, y: 100 };
      const speed = Math.sqrt(2) * 50; // ~70.7

      const velocity = PositionConverter.velocityTowards(from, to, speed);

      expect(velocity.x).toBeCloseTo(50, 1);
      expect(velocity.y).toBeCloseTo(50, 1);
    });
  });

  describe('isInBounds', () => {
    it('should return true for position within bounds', () => {
      const pos: IPosition2D = { x: 50, y: 50 };
      const bounds = { width: 100, height: 100 };

      expect(PositionConverter.isInBounds(pos, bounds)).toBe(true);
    });

    it('should return false for position outside bounds', () => {
      const pos: IPosition2D = { x: 150, y: 50 };
      const bounds = { width: 100, height: 100 };

      expect(PositionConverter.isInBounds(pos, bounds)).toBe(false);
    });

    it('should return false for negative coordinates', () => {
      const pos: IPosition2D = { x: -1, y: 50 };
      const bounds = { width: 100, height: 100 };

      expect(PositionConverter.isInBounds(pos, bounds)).toBe(false);
    });

    it('should return false for edge (width = x)', () => {
      const pos: IPosition2D = { x: 100, y: 50 };
      const bounds = { width: 100, height: 100 };

      expect(PositionConverter.isInBounds(pos, bounds)).toBe(false);
    });
  });

  describe('clamp', () => {
    it('should clamp position within bounds', () => {
      const pos: IPosition2D = { x: 150, y: -50 };
      const bounds = { width: 100, height: 100 };

      const clamped = PositionConverter.clamp(pos, bounds);

      expect(clamped.x).toBe(99); // width - 1
      expect(clamped.y).toBe(0);
    });

    it('should not change position already within bounds', () => {
      const pos: IPosition2D = { x: 50, y: 50 };
      const bounds = { width: 100, height: 100 };

      const clamped = PositionConverter.clamp(pos, bounds);

      expect(clamped.x).toBe(50);
      expect(clamped.y).toBe(50);
    });
  });

  describe('createGrid', () => {
    it('should create grid position', () => {
      const pos = PositionConverter.createGrid(10, 20);

      expect(pos.type).toBe('grid');
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
    });

    it('should floor float values', () => {
      const pos = PositionConverter.createGrid(10.7, 20.3);

      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
    });
  });

  describe('createContinuous', () => {
    it('should create continuous position', () => {
      const pos = PositionConverter.createContinuous(100.5, 200.5);

      expect(pos.type).toBe('continuous');
      expect(pos.x).toBe(100.5);
      expect(pos.y).toBe(200.5);
    });
  });

  describe('createMoving', () => {
    it('should create moving position with defaults', () => {
      const pos = PositionConverter.createMoving(100, 200);

      expect(pos.type).toBe('continuous');
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
      expect(pos.velocity.x).toBe(0);
      expect(pos.velocity.y).toBe(0);
      expect(pos.heading).toBe(0);
    });

    it('should create moving position with velocity', () => {
      const pos = PositionConverter.createMoving(100, 200, 50, 25, 45);

      expect(pos.velocity.x).toBe(50);
      expect(pos.velocity.y).toBe(25);
      expect(pos.heading).toBe(45);
    });
  });
});
