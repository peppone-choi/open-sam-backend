/**
 * FleetPhysicsEngine Tests
 */

import { FleetPhysicsEngine, Vector3, FleetPhysicsState } from '../physics/FleetPhysicsEngine';
import { IVector3 } from '../../../models/gin7/Fleet';

describe('FleetPhysicsEngine', () => {
  describe('Vector3 utilities', () => {
    test('should create zero vector', () => {
      const v = Vector3.zero();
      expect(v).toEqual({ x: 0, y: 0, z: 0 });
    });

    test('should add vectors', () => {
      const a: IVector3 = { x: 1, y: 2, z: 3 };
      const b: IVector3 = { x: 4, y: 5, z: 6 };
      const result = Vector3.add(a, b);
      expect(result).toEqual({ x: 5, y: 7, z: 9 });
    });

    test('should subtract vectors', () => {
      const a: IVector3 = { x: 5, y: 7, z: 9 };
      const b: IVector3 = { x: 1, y: 2, z: 3 };
      const result = Vector3.subtract(a, b);
      expect(result).toEqual({ x: 4, y: 5, z: 6 });
    });

    test('should calculate magnitude', () => {
      const v: IVector3 = { x: 3, y: 4, z: 0 };
      const mag = Vector3.magnitude(v);
      expect(mag).toBe(5);
    });

    test('should normalize vector', () => {
      const v: IVector3 = { x: 3, y: 4, z: 0 };
      const normalized = Vector3.normalize(v);
      expect(normalized.x).toBeCloseTo(0.6);
      expect(normalized.y).toBeCloseTo(0.8);
      expect(normalized.z).toBe(0);
    });

    test('should calculate distance', () => {
      const a: IVector3 = { x: 0, y: 0, z: 0 };
      const b: IVector3 = { x: 3, y: 4, z: 0 };
      const dist = Vector3.distance(a, b);
      expect(dist).toBe(5);
    });

    test('should convert heading to direction', () => {
      // 0 degrees = positive X
      const dir0 = Vector3.fromHeading(0);
      expect(dir0.x).toBeCloseTo(1);
      expect(dir0.y).toBeCloseTo(0);

      // 90 degrees = positive Y
      const dir90 = Vector3.fromHeading(90);
      expect(dir90.x).toBeCloseTo(0);
      expect(dir90.y).toBeCloseTo(1);
    });

    test('should convert direction to heading', () => {
      const heading0 = Vector3.toHeading({ x: 1, y: 0, z: 0 });
      expect(heading0).toBeCloseTo(0);

      const heading90 = Vector3.toHeading({ x: 0, y: 1, z: 0 });
      expect(heading90).toBeCloseTo(90);

      const heading180 = Vector3.toHeading({ x: -1, y: 0, z: 0 });
      expect(heading180).toBeCloseTo(180);
    });

    test('should lerp between vectors', () => {
      const a: IVector3 = { x: 0, y: 0, z: 0 };
      const b: IVector3 = { x: 10, y: 10, z: 10 };
      
      const mid = Vector3.lerp(a, b, 0.5);
      expect(mid).toEqual({ x: 5, y: 5, z: 5 });
      
      const quarter = Vector3.lerp(a, b, 0.25);
      expect(quarter).toEqual({ x: 2.5, y: 2.5, z: 2.5 });
    });
  });

  describe('Physics operations', () => {
    test('should update position based on velocity', () => {
      const state = FleetPhysicsEngine.createDefaultState('test', { x: 0, y: 0, z: 0 });
      state.combat.velocity = { x: 10, y: 5, z: 0 };
      
      FleetPhysicsEngine.updatePosition(state, 1);
      
      expect(state.combat.position.x).toBeCloseTo(10);
      expect(state.combat.position.y).toBeCloseTo(5);
    });

    test('should apply acceleration', () => {
      const state = FleetPhysicsEngine.createDefaultState('test');
      state.combat.acceleration = 2;
      
      FleetPhysicsEngine.applyAcceleration(state, { x: 1, y: 0, z: 0 }, 1);
      
      expect(state.combat.velocity.x).toBeCloseTo(2);
      expect(state.combat.speed).toBeCloseTo(2);
    });

    test('should clamp velocity to max speed', () => {
      const state = FleetPhysicsEngine.createDefaultState('test');
      state.combat.maxSpeed = 5;
      state.combat.acceleration = 10;
      
      FleetPhysicsEngine.applyAcceleration(state, { x: 1, y: 0, z: 0 }, 1);
      
      expect(state.combat.speed).toBeLessThanOrEqual(5);
    });

    test('should apply drag', () => {
      const state = FleetPhysicsEngine.createDefaultState('test');
      state.combat.velocity = { x: 10, y: 0, z: 0 };
      state.combat.speed = 10;
      
      FleetPhysicsEngine.applyDrag(state, 0.5);
      
      expect(state.combat.velocity.x).toBeCloseTo(5);
      expect(state.combat.speed).toBeCloseTo(5);
    });

    test('should update heading toward target', () => {
      const state = FleetPhysicsEngine.createDefaultState('test');
      state.combat.heading = 0;
      state.combat.turnRate = 45;  // 45 degrees per tick
      
      FleetPhysicsEngine.updateHeading(state, 90, 1);
      
      expect(state.combat.heading).toBeCloseTo(45);
    });

    test('should normalize angle', () => {
      expect(FleetPhysicsEngine.normalizeAngle(370)).toBeCloseTo(10);
      expect(FleetPhysicsEngine.normalizeAngle(-10)).toBeCloseTo(350);
      expect(FleetPhysicsEngine.normalizeAngle(720)).toBeCloseTo(0);
    });

    test('should check if target is in range', () => {
      const pos1: IVector3 = { x: 0, y: 0, z: 0 };
      const pos2: IVector3 = { x: 50, y: 0, z: 0 };
      
      expect(FleetPhysicsEngine.isInRange(pos1, pos2, 100)).toBe(true);
      expect(FleetPhysicsEngine.isInRange(pos1, pos2, 40)).toBe(false);
    });

    test('should detect collision', () => {
      const fleet1 = FleetPhysicsEngine.createDefaultState('fleet1', { x: 0, y: 0, z: 0 });
      const fleet2 = FleetPhysicsEngine.createDefaultState('fleet2', { x: 50, y: 0, z: 0 });
      fleet1.collisionRadius = 30;
      fleet2.collisionRadius = 30;
      
      const collision = FleetPhysicsEngine.checkCollision(fleet1, fleet2);
      
      expect(collision.collided).toBe(true);
      expect(collision.penetrationDepth).toBeGreaterThan(0);
    });

    test('should not detect collision when far apart', () => {
      const fleet1 = FleetPhysicsEngine.createDefaultState('fleet1', { x: 0, y: 0, z: 0 });
      const fleet2 = FleetPhysicsEngine.createDefaultState('fleet2', { x: 200, y: 0, z: 0 });
      fleet1.collisionRadius = 30;
      fleet2.collisionRadius = 30;
      
      const collision = FleetPhysicsEngine.checkCollision(fleet1, fleet2);
      
      expect(collision.collided).toBe(false);
    });

    test('should check if position is in battle area', () => {
      const area = { minX: -100, maxX: 100, minY: -100, maxY: 100, minZ: -50, maxZ: 50 };
      
      expect(FleetPhysicsEngine.isInBattleArea({ x: 0, y: 0, z: 0 }, area)).toBe(true);
      expect(FleetPhysicsEngine.isInBattleArea({ x: 150, y: 0, z: 0 }, area)).toBe(false);
      expect(FleetPhysicsEngine.isInBattleArea({ x: 0, y: -150, z: 0 }, area)).toBe(false);
    });

    test('should clamp position to battle area', () => {
      const area = { minX: -100, maxX: 100, minY: -100, maxY: 100, minZ: -50, maxZ: 50 };
      const outOfBounds: IVector3 = { x: 150, y: -200, z: 100 };
      
      const clamped = FleetPhysicsEngine.clampToBattleArea(outOfBounds, area);
      
      expect(clamped.x).toBe(100);
      expect(clamped.y).toBe(-100);
      expect(clamped.z).toBe(50);
    });
  });

  describe('Fleet state management', () => {
    test('should create default state', () => {
      const state = FleetPhysicsEngine.createDefaultState('test-fleet', { x: 100, y: 200, z: 0 }, {
        heading: 45,
        maxSpeed: 15
      });
      
      expect(state.fleetId).toBe('test-fleet');
      expect(state.combat.position).toEqual({ x: 100, y: 200, z: 0 });
      expect(state.combat.heading).toBe(45);
      expect(state.combat.maxSpeed).toBe(15);
      expect(state.combat.velocity).toEqual({ x: 0, y: 0, z: 0 });
      expect(state.combat.speed).toBe(0);
    });

    test('should move toward target', () => {
      const state = FleetPhysicsEngine.createDefaultState('test', { x: 0, y: 0, z: 0 });
      state.combat.maxSpeed = 10;
      state.combat.acceleration = 5;
      state.combat.turnRate = 180;  // Fast turning for test
      
      const target: IVector3 = { x: 100, y: 0, z: 0 };
      
      // Move for several ticks
      for (let i = 0; i < 10; i++) {
        FleetPhysicsEngine.moveToward(state, target, 1);
      }
      
      // Should have moved toward target
      expect(state.combat.position.x).toBeGreaterThan(0);
    });

    test('should calculate angle to target', () => {
      const from: IVector3 = { x: 0, y: 0, z: 0 };
      const to: IVector3 = { x: 100, y: 0, z: 0 };
      
      const angle = FleetPhysicsEngine.angleToTarget(from, to);
      expect(angle).toBeCloseTo(0);
      
      const to2: IVector3 = { x: 0, y: 100, z: 0 };
      const angle2 = FleetPhysicsEngine.angleToTarget(from, to2);
      expect(angle2).toBeCloseTo(90);
    });

    test('should detect target in front', () => {
      const state = FleetPhysicsEngine.createDefaultState('test', { x: 0, y: 0, z: 0 });
      state.combat.heading = 0;  // Facing positive X
      
      // Target directly in front
      expect(FleetPhysicsEngine.isTargetInFront(state, { x: 100, y: 0, z: 0 })).toBe(true);
      
      // Target to the side (90 degrees)
      expect(FleetPhysicsEngine.isTargetInFront(state, { x: 0, y: 100, z: 0 }, 45)).toBe(false);
      
      // Target behind
      expect(FleetPhysicsEngine.isTargetInFront(state, { x: -100, y: 0, z: 0 })).toBe(false);
    });
  });
});
