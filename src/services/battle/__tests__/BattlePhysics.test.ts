import { BattlePhysics } from '../BattlePhysics';
import { IBattleUnit } from '../../../models/battle.model';
import { UnitType } from '../../../core/battle-calculator';

describe('BattlePhysics', () => {
  let physics: BattlePhysics;

  beforeEach(() => {
    physics = new BattlePhysics({
      deltaTime: 50,
      mapWidth: 800,
      mapHeight: 600
    });
  });

  describe('updateMovement', () => {
    it('should move unit towards target position', () => {
      const unit: IBattleUnit = {
        generalId: 1,
        generalName: 'Test',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        targetPosition: { x: 200, y: 100 },
        velocity: { x: 0, y: 0 },
        facing: 0,
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const map: any = {
        width: 800,
        height: 600,
        entryDirection: 'north',
        attackerZone: { x: [0, 800], y: [0, 100] },
        defenderZone: { x: [0, 800], y: [500, 600] }
      };

      const initialX = unit.position.x;
      physics.updateMovement(unit, map);

      expect(unit.position.x).toBeGreaterThan(initialX);
      expect(unit.position.y).toBe(100);
    });

    it('should stop at target position', () => {
      const unit: IBattleUnit = {
        generalId: 1,
        generalName: 'Test',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        targetPosition: { x: 102, y: 100 },
        velocity: { x: 0, y: 0 },
        facing: 0,
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const map: any = {
        width: 800,
        height: 600,
        entryDirection: 'north',
        attackerZone: { x: [0, 800], y: [0, 100] },
        defenderZone: { x: [0, 800], y: [500, 600] }
      };

      physics.updateMovement(unit, map);

      expect(unit.position.x).toBe(102);
      expect(unit.position.y).toBe(100);
      expect(unit.targetPosition).toBeUndefined();
      expect(unit.velocity?.x).toBe(0);
      expect(unit.velocity?.y).toBe(0);
    });
  });

  describe('checkCollision', () => {
    it('should detect collision when units overlap', () => {
      const unit1: IBattleUnit = {
        generalId: 1,
        generalName: 'Unit1',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const unit2: IBattleUnit = {
        generalId: 2,
        generalName: 'Unit2',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 110, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const isColliding = physics.checkCollision(unit1, unit2);
      expect(isColliding).toBe(true);
    });

    it('should not detect collision when units are far apart', () => {
      const unit1: IBattleUnit = {
        generalId: 1,
        generalName: 'Unit1',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const unit2: IBattleUnit = {
        generalId: 2,
        generalName: 'Unit2',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 200, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const isColliding = physics.checkCollision(unit1, unit2);
      expect(isColliding).toBe(false);
    });
  });

  describe('isInAttackRange', () => {
    it('should return true when target is in range', () => {
      const attacker: IBattleUnit = {
        generalId: 1,
        generalName: 'Attacker',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.ARCHER,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 13,
        moveSpeed: 60,
        attackRange: 150,
        attackCooldown: 2000
      };

      const target: IBattleUnit = {
        generalId: 2,
        generalName: 'Target',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 200, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const inRange = physics.isInAttackRange(attacker, target);
      expect(inRange).toBe(true);
    });
  });

  describe('calculateDamage', () => {
    it('should calculate basic damage', () => {
      const attacker: IBattleUnit = {
        generalId: 1,
        generalName: 'Attacker',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const defender: IBattleUnit = {
        generalId: 2,
        generalName: 'Defender',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 120, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const damage = physics.calculateDamage(attacker, defender);
      expect(damage).toBeGreaterThan(0);
    });

    it('should apply type advantage (cavalry > footman)', () => {
      const cavalry: IBattleUnit = {
        generalId: 1,
        generalName: 'Cavalry',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.CAVALRY,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 20,
        moveSpeed: 100,
        attackRange: 25,
        attackCooldown: 1200
      };

      const footman: IBattleUnit = {
        generalId: 2,
        generalName: 'Footman',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 120, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const damageWithAdvantage = physics.calculateDamage(cavalry, footman);
      const damageWithoutAdvantage = physics.calculateDamage(footman, cavalry);

      expect(damageWithAdvantage).toBeGreaterThan(damageWithoutAdvantage);
    });
  });

  describe('findNearestEnemy', () => {
    it('should find the closest enemy', () => {
      const unit: IBattleUnit = {
        generalId: 1,
        generalName: 'Unit',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 100, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const enemy1: IBattleUnit = {
        generalId: 2,
        generalName: 'Enemy1',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 300, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const enemy2: IBattleUnit = {
        generalId: 3,
        generalName: 'Enemy2',
        troops: 1000,
        maxTroops: 1000,
        leadership: 80,
        strength: 80,
        intelligence: 80,
        unitType: UnitType.FOOTMAN,
        morale: 100,
        training: 100,
        techLevel: 50,
        position: { x: 150, y: 100 },
        collisionRadius: 15,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500
      };

      const nearest = physics.findNearestEnemy(unit, [enemy1, enemy2]);
      expect(nearest).toBe(enemy2);
    });
  });
});
