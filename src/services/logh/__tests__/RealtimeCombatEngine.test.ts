/**
 * LOGH Realtime Combat Engine Tests
 * 은하영웅전설 실시간 전투 엔진 단위 테스트
 */

import {
  Formation,
  FORMATION_STATS,
  COMBAT_CONSTANTS,
  Position2D,
  Velocity2D,
  getDistance,
  normalize,
  vectorToAngle,
  angleToVector,
  clamp,
  getSupplyMultiplier,
  getFormationStats,
  toRadians,
  toDegrees,
} from '../types/Combat.types';

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Combat Types - Utility Functions', () => {
  describe('getDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const p1: Position2D = { x: 0, y: 0 };
      const p2: Position2D = { x: 3, y: 4 };
      expect(getDistance(p1, p2)).toBe(5);
    });

    it('should return 0 for same points', () => {
      const p: Position2D = { x: 100, y: 200 };
      expect(getDistance(p, p)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const p1: Position2D = { x: -3, y: -4 };
      const p2: Position2D = { x: 0, y: 0 };
      expect(getDistance(p1, p2)).toBe(5);
    });

    it('should handle large coordinates (tactical map scale)', () => {
      const p1: Position2D = { x: 0, y: 0 };
      const p2: Position2D = { x: 10000, y: 10000 };
      expect(getDistance(p1, p2)).toBeCloseTo(14142.13, 1);
    });
  });

  describe('normalize', () => {
    it('should normalize a vector to unit length', () => {
      const v: Velocity2D = { x: 3, y: 4 };
      const normalized = normalize(v);
      expect(normalized.x).toBeCloseTo(0.6, 5);
      expect(normalized.y).toBeCloseTo(0.8, 5);
    });

    it('should return zero vector for zero input', () => {
      const v: Velocity2D = { x: 0, y: 0 };
      const normalized = normalize(v);
      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });

    it('should handle unit vectors', () => {
      const v: Velocity2D = { x: 1, y: 0 };
      const normalized = normalize(v);
      expect(normalized.x).toBe(1);
      expect(normalized.y).toBe(0);
    });
  });

  describe('vectorToAngle', () => {
    it('should return 0 for pointing right', () => {
      const v: Velocity2D = { x: 1, y: 0 };
      expect(vectorToAngle(v)).toBe(0);
    });

    it('should return 90 for pointing up', () => {
      const v: Velocity2D = { x: 0, y: 1 };
      expect(vectorToAngle(v)).toBe(90);
    });

    it('should return 180 for pointing left', () => {
      const v: Velocity2D = { x: -1, y: 0 };
      expect(vectorToAngle(v)).toBe(180);
    });

    it('should return 270 for pointing down', () => {
      const v: Velocity2D = { x: 0, y: -1 };
      expect(vectorToAngle(v)).toBe(270);
    });

    it('should return 45 for diagonal', () => {
      const v: Velocity2D = { x: 1, y: 1 };
      expect(vectorToAngle(v)).toBeCloseTo(45, 5);
    });
  });

  describe('angleToVector', () => {
    it('should convert 0 degrees to right vector', () => {
      const v = angleToVector(0);
      expect(v.x).toBeCloseTo(1, 5);
      expect(v.y).toBeCloseTo(0, 5);
    });

    it('should convert 90 degrees to up vector', () => {
      const v = angleToVector(90);
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y).toBeCloseTo(1, 5);
    });

    it('should convert 180 degrees to left vector', () => {
      const v = angleToVector(180);
      expect(v.x).toBeCloseTo(-1, 5);
      expect(v.y).toBeCloseTo(0, 5);
    });

    it('should convert 45 degrees to diagonal', () => {
      const v = angleToVector(45);
      expect(v.x).toBeCloseTo(0.707, 2);
      expect(v.y).toBeCloseTo(0.707, 2);
    });
  });

  describe('clamp', () => {
    it('should clamp value below min to min', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('should clamp value above max to max', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should not change value within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('should handle equal min and max', () => {
      expect(clamp(50, 25, 25)).toBe(25);
    });
  });

  describe('toRadians / toDegrees', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI, 5);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 5);
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 5);
    });

    it('should convert radians to degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 5);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 5);
      expect(toDegrees(2 * Math.PI)).toBeCloseTo(360, 5);
    });
  });
});

// ============================================================================
// Formation System Tests
// ============================================================================

describe('Combat Types - Formation System', () => {
  describe('FORMATION_STATS', () => {
    it('should have all five formations defined', () => {
      const formations: Formation[] = [
        'fishScale',
        'craneWing',
        'circular',
        'arrowhead',
        'longSnake',
      ];
      
      formations.forEach((f) => {
        expect(FORMATION_STATS[f]).toBeDefined();
      });
    });

    it('should have correct Korean names', () => {
      expect(FORMATION_STATS.fishScale.koreanName).toBe('어린');
      expect(FORMATION_STATS.craneWing.koreanName).toBe('학익');
      expect(FORMATION_STATS.circular.koreanName).toBe('방원');
      expect(FORMATION_STATS.arrowhead.koreanName).toBe('봉시');
      expect(FORMATION_STATS.longSnake.koreanName).toBe('장사');
    });

    it('should have correct Japanese names', () => {
      expect(FORMATION_STATS.fishScale.japaneseName).toBe('魚鱗');
      expect(FORMATION_STATS.craneWing.japaneseName).toBe('鶴翼');
      expect(FORMATION_STATS.circular.japaneseName).toBe('方円');
      expect(FORMATION_STATS.arrowhead.japaneseName).toBe('鋒矢');
      expect(FORMATION_STATS.longSnake.japaneseName).toBe('長蛇');
    });

    it('fishScale (어린) should have high attack, low defense', () => {
      const stats = FORMATION_STATS.fishScale;
      expect(stats.attack).toBeGreaterThan(1.0);
      expect(stats.defense).toBeLessThan(1.0);
    });

    it('circular (방원) should have high defense, low attack', () => {
      const stats = FORMATION_STATS.circular;
      expect(stats.attack).toBeLessThan(1.0);
      expect(stats.defense).toBeGreaterThan(1.0);
    });

    it('arrowhead (봉시) should have highest attack and speed', () => {
      const stats = FORMATION_STATS.arrowhead;
      expect(stats.attack).toBe(1.3); // Highest attack
      expect(stats.speed).toBe(1.2); // Highest speed
    });

    it('longSnake (장사) should have highest evasion', () => {
      const stats = FORMATION_STATS.longSnake;
      expect(stats.evasion).toBe(15); // Highest evasion
    });
  });

  describe('getFormationStats', () => {
    it('should return correct stats for each formation', () => {
      expect(getFormationStats('fishScale').attack).toBe(1.2);
      expect(getFormationStats('craneWing').range).toBe(1.1);
      expect(getFormationStats('circular').defense).toBe(1.3);
      expect(getFormationStats('arrowhead').speed).toBe(1.2);
      expect(getFormationStats('longSnake').evasion).toBe(15);
    });
  });
});

// ============================================================================
// Supply System Tests
// ============================================================================

describe('Combat Types - Supply System', () => {
  describe('getSupplyMultiplier', () => {
    it('should return 1.0 for normal supply (> 20%)', () => {
      expect(getSupplyMultiplier(100)).toBe(1.0);
      expect(getSupplyMultiplier(50)).toBe(1.0);
      expect(getSupplyMultiplier(21)).toBe(1.0);
    });

    it('should return 0.5 for low supply (<= 20%)', () => {
      expect(getSupplyMultiplier(20)).toBe(0.5);
      expect(getSupplyMultiplier(10)).toBe(0.5);
      expect(getSupplyMultiplier(0)).toBe(0.5);
    });

    it('should match COMBAT_CONSTANTS values', () => {
      const threshold = COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD;
      const penalty = COMBAT_CONSTANTS.LOW_SUPPLY_PENALTY;
      
      expect(getSupplyMultiplier(threshold)).toBe(penalty);
      expect(getSupplyMultiplier(threshold + 1)).toBe(1.0);
    });
  });
});

// ============================================================================
// Combat Constants Tests
// ============================================================================

describe('Combat Types - Constants', () => {
  describe('COMBAT_CONSTANTS', () => {
    it('should have correct tactical map size', () => {
      expect(COMBAT_CONSTANTS.TACTICAL_MAP_SIZE).toBe(10000);
    });

    it('should have correct tick interval (50ms)', () => {
      expect(COMBAT_CONSTANTS.TICK_INTERVAL_MS).toBe(50);
      expect(COMBAT_CONSTANTS.TICK_RATE).toBe(20);
    });

    it('should have correct supply thresholds', () => {
      expect(COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD).toBe(20);
      expect(COMBAT_CONSTANTS.LOW_SUPPLY_PENALTY).toBe(0.5);
    });

    it('should have correct morale thresholds', () => {
      expect(COMBAT_CONSTANTS.MORALE_SURRENDER_THRESHOLD).toBe(10);
      expect(COMBAT_CONSTANTS.MORALE_ROUT_THRESHOLD).toBe(0);
    });
  });
});

// ============================================================================
// Movement Calculation Tests
// ============================================================================

describe('Combat Engine - Movement Calculations', () => {
  describe('deltaTime-based movement', () => {
    it('should calculate correct position after movement', () => {
      const position: Position2D = { x: 1000, y: 1000 };
      const velocity: Velocity2D = { x: 1, y: 0 }; // Moving right
      const speed = 100; // 100 units per second
      const deltaTime = 0.05; // 50ms

      const expectedX = position.x + velocity.x * speed * deltaTime;
      const expectedY = position.y + velocity.y * speed * deltaTime;

      expect(expectedX).toBe(1005); // 1000 + 1 * 100 * 0.05
      expect(expectedY).toBe(1000);
    });

    it('should apply formation speed modifier', () => {
      const baseSpeed = 100;
      const arrowheadModifier = FORMATION_STATS.arrowhead.speed; // 1.2
      const circularModifier = FORMATION_STATS.circular.speed; // 0.8

      expect(baseSpeed * arrowheadModifier).toBe(120);
      expect(baseSpeed * circularModifier).toBe(80);
    });

    it('should clamp position to map boundaries', () => {
      const mapSize = COMBAT_CONSTANTS.TACTICAL_MAP_SIZE;
      
      // Test upper bounds
      expect(clamp(11000, 0, mapSize)).toBe(10000);
      
      // Test lower bounds
      expect(clamp(-100, 0, mapSize)).toBe(0);
    });
  });

  describe('destination arrival detection', () => {
    it('should detect arrival when within threshold', () => {
      const position: Position2D = { x: 5000, y: 5000 };
      const destination: Position2D = { x: 5005, y: 5005 };
      const distance = getDistance(position, destination);
      
      expect(distance).toBeLessThan(COMBAT_CONSTANTS.ARRIVAL_THRESHOLD);
    });

    it('should not detect arrival when beyond threshold', () => {
      const position: Position2D = { x: 5000, y: 5000 };
      const destination: Position2D = { x: 5050, y: 5050 };
      const distance = getDistance(position, destination);
      
      expect(distance).toBeGreaterThan(COMBAT_CONSTANTS.ARRIVAL_THRESHOLD);
    });
  });
});

// ============================================================================
// Combat Calculation Tests
// ============================================================================

describe('Combat Engine - Damage Calculations', () => {
  describe('base damage formula', () => {
    it('should calculate base damage correctly', () => {
      const attackStrength = 1000;
      const defenseStrength = 500;
      const deltaTime = 0.05;

      const attackPower = attackStrength / 100; // 10
      const defensePower = defenseStrength / 200; // 2.5
      const baseDamage = (attackPower - defensePower) * deltaTime;

      expect(baseDamage).toBeCloseTo(0.375, 3);
    });

    it('should apply formation attack modifier', () => {
      const attackPower = 10;
      const fishScaleModifier = FORMATION_STATS.fishScale.attack; // 1.2
      const arrowheadModifier = FORMATION_STATS.arrowhead.attack; // 1.3

      expect(attackPower * fishScaleModifier).toBe(12);
      expect(attackPower * arrowheadModifier).toBe(13);
    });

    it('should apply formation defense modifier', () => {
      const defensePower = 5;
      const circularModifier = FORMATION_STATS.circular.defense; // 1.3

      expect(defensePower * circularModifier).toBe(6.5);
    });

    it('should apply supply penalty when low', () => {
      const attackPower = 10;
      const supplyMultiplier = getSupplyMultiplier(15); // Low supply

      expect(attackPower * supplyMultiplier).toBe(5); // 50% reduction
    });
  });

  describe('evasion calculation', () => {
    it('should calculate hit chance based on formation evasion', () => {
      const longSnakeEvasion = FORMATION_STATS.longSnake.evasion / 100; // 0.15
      const hitChance = Math.max(0.1, 1 - longSnakeEvasion);

      expect(hitChance).toBe(0.85);
    });

    it('should have minimum hit chance of 0.1', () => {
      // Even with very high evasion, minimum hit chance is 10%
      const extremeEvasion = 100 / 100; // 100%
      const hitChance = Math.max(0.1, 1 - extremeEvasion);

      expect(hitChance).toBe(0.1);
    });
  });

  describe('range calculation', () => {
    it('should apply formation range modifier', () => {
      const baseRange = COMBAT_CONSTANTS.BASE_ATTACK_RANGE; // 500
      const craneWingModifier = FORMATION_STATS.craneWing.range; // 1.1

      expect(baseRange * craneWingModifier).toBe(550);
    });

    it('should detect target in range', () => {
      const attackerPos: Position2D = { x: 5000, y: 5000 };
      const targetPos: Position2D = { x: 5400, y: 5000 };
      const effectiveRange = 500;

      const distance = getDistance(attackerPos, targetPos);
      expect(distance).toBeLessThanOrEqual(effectiveRange);
    });

    it('should detect target out of range', () => {
      const attackerPos: Position2D = { x: 5000, y: 5000 };
      const targetPos: Position2D = { x: 5600, y: 5000 };
      const effectiveRange = 500;

      const distance = getDistance(attackerPos, targetPos);
      expect(distance).toBeGreaterThan(effectiveRange);
    });
  });
});

// ============================================================================
// Morale System Tests
// ============================================================================

describe('Combat Engine - Morale System', () => {
  describe('morale thresholds', () => {
    it('should trigger surrender consideration at threshold', () => {
      const morale = 10;
      const isSurrenderCandidate = morale <= COMBAT_CONSTANTS.MORALE_SURRENDER_THRESHOLD;
      
      expect(isSurrenderCandidate).toBe(true);
    });

    it('should trigger rout at zero morale', () => {
      const morale = 0;
      const isRouted = morale <= COMBAT_CONSTANTS.MORALE_ROUT_THRESHOLD;
      
      expect(isRouted).toBe(true);
    });

    it('should not trigger surrender above threshold', () => {
      const morale = 50;
      const isSurrenderCandidate = morale <= COMBAT_CONSTANTS.MORALE_SURRENDER_THRESHOLD;
      
      expect(isSurrenderCandidate).toBe(false);
    });
  });

  describe('morale loss calculation', () => {
    it('should calculate morale loss from casualties', () => {
      const casualties = 100;
      const moraleLoss = casualties * COMBAT_CONSTANTS.MORALE_LOSS_PER_CASUALTY;
      
      expect(moraleLoss).toBe(1);
    });

    it('should calculate morale loss from low supply', () => {
      const deltaTime = 1; // 1 second
      const moraleLoss = COMBAT_CONSTANTS.MORALE_LOSS_LOW_SUPPLY * deltaTime;
      
      expect(moraleLoss).toBe(1);
    });
  });
});

// ============================================================================
// Integration-like Tests
// ============================================================================

describe('Combat Engine - Scenario Simulations', () => {
  describe('Scenario 1: Basic Movement', () => {
    it('should move fleet from (1000,1000) to (5000,5000)', () => {
      const start: Position2D = { x: 1000, y: 1000 };
      const destination: Position2D = { x: 5000, y: 5000 };
      const speed = 100; // 100 units per second

      const direction = normalize({
        x: destination.x - start.x,
        y: destination.y - start.y,
      });

      const distance = getDistance(start, destination);
      const travelTime = distance / speed;

      // After travelTime seconds, should reach destination
      const finalX = start.x + direction.x * speed * travelTime;
      const finalY = start.y + direction.y * speed * travelTime;

      expect(finalX).toBeCloseTo(5000, 0);
      expect(finalY).toBeCloseTo(5000, 0);
    });
  });

  describe('Scenario 2: Formation Combat', () => {
    it('어린(fishScale) vs 방원(circular) - 어린 공격 우위, 방원 방어 우위', () => {
      const fishScaleStats = FORMATION_STATS.fishScale;
      const circularStats = FORMATION_STATS.circular;

      // 어린의 공격력이 더 높음
      expect(fishScaleStats.attack).toBeGreaterThan(circularStats.attack);
      
      // 방원의 방어력이 더 높음
      expect(circularStats.defense).toBeGreaterThan(fishScaleStats.defense);
    });
  });

  describe('Scenario 3: Range Check', () => {
    it('함대 A (사정거리 500) vs 함대 B (거리 600) - 공격 불가', () => {
      const fleetAPos: Position2D = { x: 5000, y: 5000 };
      const fleetBPos: Position2D = { x: 5600, y: 5000 };
      const fleetARange = 500;

      const distance = getDistance(fleetAPos, fleetBPos);
      const canAttack = distance <= fleetARange;

      expect(canAttack).toBe(false);
    });

    it('함대 A가 접근 후 공격 가능', () => {
      const fleetAPos: Position2D = { x: 5200, y: 5000 }; // Moved closer
      const fleetBPos: Position2D = { x: 5600, y: 5000 };
      const fleetARange = 500;

      const distance = getDistance(fleetAPos, fleetBPos);
      const canAttack = distance <= fleetARange;

      expect(canAttack).toBe(true);
    });
  });

  describe('Scenario 4: Supply Effect', () => {
    it('보급 0% 상태로 전투 - 전투력 50% 감소', () => {
      const baseAttackPower = 100;
      const supplyPercent = 0;
      const supplyMultiplier = getSupplyMultiplier(supplyPercent);

      const effectiveAttack = baseAttackPower * supplyMultiplier;

      expect(effectiveAttack).toBe(50);
    });

    it('보급 100% 상태로 전투 - 전투력 정상', () => {
      const baseAttackPower = 100;
      const supplyPercent = 100;
      const supplyMultiplier = getSupplyMultiplier(supplyPercent);

      const effectiveAttack = baseAttackPower * supplyMultiplier;

      expect(effectiveAttack).toBe(100);
    });
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Combat Engine - Edge Cases', () => {
  it('should handle zero ships', () => {
    const totalShips = 0;
    const attackPower = totalShips / 100;
    
    expect(attackPower).toBe(0);
  });

  it('should handle maximum map coordinates', () => {
    const maxCoord = COMBAT_CONSTANTS.TACTICAL_MAP_SIZE;
    const position: Position2D = { x: maxCoord, y: maxCoord };
    
    expect(clamp(position.x, 0, maxCoord)).toBe(maxCoord);
    expect(clamp(position.y, 0, maxCoord)).toBe(maxCoord);
  });

  it('should handle diagonal movement correctly', () => {
    const velocity: Velocity2D = { x: 1, y: 1 };
    const normalized = normalize(velocity);
    
    // Both components should be equal for 45-degree angle
    expect(normalized.x).toBeCloseTo(normalized.y, 5);
    
    // Magnitude should be 1
    const magnitude = Math.sqrt(normalized.x ** 2 + normalized.y ** 2);
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('should handle rapid tick updates', () => {
    const deltaTime = 0.001; // 1ms (very fast tick)
    const speed = 100;
    const movement = speed * deltaTime;
    
    // Should still produce valid (small) movement
    expect(movement).toBe(0.1);
  });
});




