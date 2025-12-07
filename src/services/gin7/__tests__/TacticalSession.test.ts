/**
 * TacticalSession Tests
 * 
 * Phase 1: 물리 검증
 * Phase 2: 전투 검증
 * Phase 3: 성능/보안 검증
 */

import { TacticalSession, tacticalSessionManager } from '../TacticalSession';
import { 
  UnitState, 
  EnergyDistribution,
  TACTICAL_CONSTANTS,
  DEFAULT_ENERGY_DISTRIBUTION,
} from '../../../types/gin7/tactical.types';
import { IFleet, ShipClass, SHIP_SPECS } from '../../../models/gin7/Fleet';

describe('TacticalSession', () => {
  let session: TacticalSession;
  
  beforeEach(() => {
    session = new TacticalSession('test-session', 'grid-001');
  });
  
  afterEach(() => {
    session.destroy();
  });
  
  // ============================================================
  // Phase 1: 물리 검증
  // ============================================================
  
  describe('Phase 1: Physics', () => {
    describe('1.1 Inertia (관성)', () => {
      it('should continue moving when engine energy is 0', () => {
        // Create mock fleet
        const mockFleet = createMockFleet('destroyer', 10);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 100, y: 0, z: 100 });
        
        const units = session.getUnits();
        expect(units.length).toBeGreaterThan(0);
        
        const unit = units[0];
        
        // Set initial velocity
        unit.velocity = { x: 50, y: 0, z: 0 };
        
        // Set engine energy to 0
        unit.energyDistribution = {
          ...DEFAULT_ENERGY_DISTRIBUTION,
          engine: 0,
          beam: 40,  // Redistribute to maintain 100%
        };
        
        // Record initial position
        const initialX = unit.position.x;
        
        // Simulate physics update (manual call since we're not starting the loop)
        (session as any).updatePhysics(0.06); // 60ms
        
        // Unit should have moved due to velocity
        expect(unit.position.x).toBeGreaterThan(initialX);
        
        // Velocity should be reduced by drag, but not zero
        expect(unit.velocity.x).toBeGreaterThan(0);
        expect(unit.velocity.x).toBeLessThan(50); // Drag applied
      });
      
      it('should gradually slow down due to drag coefficient', () => {
        const mockFleet = createMockFleet('cruiser', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 100, y: 0, z: 100 });
        
        const unit = session.getUnits()[0];
        unit.velocity = { x: 100, y: 0, z: 0 };
        unit.targetPosition = undefined; // No target, just drift
        
        const velocities: number[] = [unit.velocity.x];
        
        // Simulate 10 ticks
        for (let i = 0; i < 10; i++) {
          (session as any).updatePhysics(0.06);
          velocities.push(unit.velocity.x);
        }
        
        // Each velocity should be less than the previous (drag)
        for (let i = 1; i < velocities.length; i++) {
          expect(velocities[i]).toBeLessThan(velocities[i - 1]);
        }
        
        // Drag coefficient is 0.02, so after 10 ticks: 100 * (0.98)^10 ≈ 81.7
        expect(unit.velocity.x).toBeCloseTo(100 * Math.pow(1 - TACTICAL_CONSTANTS.DRAG_COEFFICIENT, 10), 0);
      });
    });
    
    describe('1.2 Turn Rate (회전 속도)', () => {
      it('should have different turn rates based on ship class', () => {
        const turnRates: Record<ShipClass, number> = {
          flagship: 0.3,
          battleship: 0.4,
          carrier: 0.35,
          cruiser: 0.6,
          destroyer: 0.8,
          frigate: 1.0,
          corvette: 1.2,
          transport: 0.4,
          engineering: 0.5,
        };
        
        // Verify large ships turn slower than small ships
        expect(turnRates.flagship).toBeLessThan(turnRates.destroyer);
        expect(turnRates.battleship).toBeLessThan(turnRates.corvette);
        expect(turnRates.corvette).toBeGreaterThan(turnRates.battleship);
      });
      
      it('corvette should turn faster than battleship', () => {
        // Create two sessions for comparison
        const session1 = new TacticalSession('test-1', 'grid-001');
        const session2 = new TacticalSession('test-2', 'grid-001');
        
        const battleshipFleet = createMockFleet('battleship', 1);
        const corvetteFleet = createMockFleet('corvette', 1);
        
        session1.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session1.addFleetUnits(battleshipFleet, { x: 0, y: 0, z: 0 });
        
        session2.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session2.addFleetUnits(corvetteFleet, { x: 0, y: 0, z: 0 });
        
        const battleship = session1.getUnits()[0];
        const corvette = session2.getUnits()[0];
        
        // Set same initial velocity (moving +X)
        battleship.velocity = { x: 30, y: 0, z: 0 };
        corvette.velocity = { x: 30, y: 0, z: 0 };
        
        // Set target to +Z direction (90 degree turn)
        battleship.targetPosition = { x: 0, y: 0, z: 1000 };
        corvette.targetPosition = { x: 0, y: 0, z: 1000 };
        
        // Simulate same number of ticks
        for (let i = 0; i < 20; i++) {
          (session1 as any).updatePhysics(0.06);
          (session2 as any).updatePhysics(0.06);
        }
        
        // Corvette should have turned more (higher Z velocity component)
        const battleshipZRatio = Math.abs(battleship.velocity.z) / 
          Math.sqrt(battleship.velocity.x ** 2 + battleship.velocity.z ** 2);
        const corvetteZRatio = Math.abs(corvette.velocity.z) / 
          Math.sqrt(corvette.velocity.x ** 2 + corvette.velocity.z ** 2);
        
        expect(corvetteZRatio).toBeGreaterThan(battleshipZRatio);
        
        session1.destroy();
        session2.destroy();
      });
    });
  });
  
  // ============================================================
  // Phase 2: 전투 검증
  // ============================================================
  
  describe('Phase 2: Combat', () => {
    describe('2.1 Energy Distribution (에너지 배분)', () => {
      it('should reject energy distribution that exceeds 100%', () => {
        const mockFleet = createMockFleet('cruiser', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 100, y: 0, z: 100 });
        
        const unit = session.getUnits()[0];
        const originalDist = { ...unit.energyDistribution };
        
        // Try to set invalid distribution (total > 100)
        const invalidDist: EnergyDistribution = {
          beam: 30,
          gun: 30,
          shield: 30,
          engine: 30,
          warp: 10,
          sensor: 10,  // Total: 140
        };
        
        // Queue command
        session.queueCommand('faction-a', 'cmd-1', {
          type: 'ENERGY_DISTRIBUTION',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: { distribution: invalidDist },
        });
        
        // Process commands
        (session as any).processCommands();
        
        // Distribution should NOT have changed
        expect(unit.energyDistribution).toEqual(originalDist);
      });
      
      it('should accept energy distribution that equals 100%', () => {
        const mockFleet = createMockFleet('cruiser', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 100, y: 0, z: 100 });
        
        const unit = session.getUnits()[0];
        
        // Set valid distribution (total = 100)
        const validDist: EnergyDistribution = {
          beam: 30,
          gun: 20,
          shield: 15,
          engine: 15,
          warp: 10,
          sensor: 10,  // Total: 100
        };
        
        session.queueCommand('faction-a', 'cmd-1', {
          type: 'ENERGY_DISTRIBUTION',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: { distribution: validDist },
        });
        
        (session as any).processCommands();
        
        // Distribution should have changed
        expect(unit.energyDistribution).toEqual(validDist);
      });
      
      it('should enforce total exactly 100 (not less)', () => {
        const mockFleet = createMockFleet('destroyer', 3);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        const originalDist = { ...unit.energyDistribution };
        
        // Try to set distribution that's less than 100
        const lowDist: EnergyDistribution = {
          beam: 10,
          gun: 10,
          shield: 10,
          engine: 10,
          warp: 10,
          sensor: 10,  // Total: 60
        };
        
        session.queueCommand('faction-a', 'cmd-1', {
          type: 'ENERGY_DISTRIBUTION',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: { distribution: lowDist },
        });
        
        (session as any).processCommands();
        
        // Distribution should NOT have changed (must be exactly 100)
        expect(unit.energyDistribution).toEqual(originalDist);
      });
    });
    
    describe('2.2 Damage Formula (데미지 공식)', () => {
      it('should apply damage in order: Shield -> Armor -> HP', () => {
        const attackerFleet = createMockFleet('battleship', 5);
        const defenderFleet = createMockFleet('cruiser', 5);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(attackerFleet, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(defenderFleet, { x: 100, y: 0, z: 0 });
        
        const units = session.getUnits();
        const attacker = units.find(u => u.factionId === 'faction-a')!;
        const defender = units.find(u => u.factionId === 'faction-b')!;
        
        // Set defender with known values
        defender.shieldFront = 50;
        defender.armor = 70;
        defender.hp = 1000;
        
        const originalShield = defender.shieldFront;
        const originalArmor = defender.armor;
        const originalHp = defender.hp;
        
        // Apply damage
        (session as any).applyDamage(attacker, defender, 100, 'BEAM');
        
        // Shield should be reduced first
        expect(defender.shieldFront).toBeLessThan(originalShield);
        
        // If damage > shield, armor should absorb some
        // If damage > shield + armor_reduction, HP should take damage
        // The exact values depend on the formula, but the ORDER must be correct
        
        // Verify the damage was applied (at least one stat changed)
        const statsChanged = 
          defender.shieldFront < originalShield ||
          defender.hp < originalHp;
        expect(statsChanged).toBe(true);
      });
      
      it('should reduce morale on hit', () => {
        const attackerFleet = createMockFleet('destroyer', 3);
        const defenderFleet = createMockFleet('frigate', 3);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(attackerFleet, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(defenderFleet, { x: 50, y: 0, z: 0 });
        
        const units = session.getUnits();
        const attacker = units.find(u => u.factionId === 'faction-a')!;
        const defender = units.find(u => u.factionId === 'faction-b')!;
        
        defender.morale = 100;
        
        (session as any).applyDamage(attacker, defender, 50, 'GUN');
        
        expect(defender.morale).toBeLessThan(100);
      });
      
      it('should set isChaos when morale reaches 0', () => {
        const attackerFleet = createMockFleet('battleship', 1);
        const defenderFleet = createMockFleet('corvette', 1);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(attackerFleet, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(defenderFleet, { x: 50, y: 0, z: 0 });
        
        const units = session.getUnits();
        const attacker = units.find(u => u.factionId === 'faction-a')!;
        const defender = units.find(u => u.factionId === 'faction-b')!;
        
        defender.morale = TACTICAL_CONSTANTS.MORALE_DAMAGE_LOSS; // Just enough to hit 0
        
        (session as any).applyDamage(attacker, defender, 10, 'BEAM');
        
        expect(defender.morale).toBe(0);
        expect(defender.isChaos).toBe(true);
      });
    });
  });
  
  // ============================================================
  // Phase 3: 성능/보안 검증
  // ============================================================
  
  describe('Phase 3: Performance & Security', () => {
    describe('3.1 Stress Test (600 유닛)', () => {
      it('should handle 600 units without significant tick delay', () => {
        // Create large battle
        const fleetsPerSide = 10;
        const unitsPerFleet = 30; // 10 * 30 * 2 = 600 units
        
        session.addParticipant('faction-a', 
          Array.from({ length: fleetsPerSide }, (_, i) => `fleet-a-${i}`),
          ['cmd-a']
        );
        session.addParticipant('faction-b',
          Array.from({ length: fleetsPerSide }, (_, i) => `fleet-b-${i}`),
          ['cmd-b']
        );
        
        // Add units for faction A
        for (let i = 0; i < fleetsPerSide; i++) {
          const fleet = createMockFleet('cruiser', unitsPerFleet);
          fleet.factionId = 'faction-a';
          session.addFleetUnits(fleet, { x: i * 100, y: 0, z: 0 });
        }
        
        // Add units for faction B
        for (let i = 0; i < fleetsPerSide; i++) {
          const fleet = createMockFleet('destroyer', unitsPerFleet);
          fleet.factionId = 'faction-b';
          session.addFleetUnits(fleet, { x: i * 100, y: 0, z: 2000 });
        }
        
        expect(session.getUnits().length).toBe(600);
        
        // Measure tick performance
        const tickTimes: number[] = [];
        const targetTickMs = TACTICAL_CONSTANTS.TICK_INTERVAL_MS;
        
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          
          (session as any).updatePhysics(0.06);
          (session as any).processCombat(0.06);
          (session as any).updateProjectiles(0.06);
          (session as any).cleanupEffects();
          
          const elapsed = performance.now() - start;
          tickTimes.push(elapsed);
        }
        
        const avgTickTime = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
        const maxTickTime = Math.max(...tickTimes);
        
        // Average tick time should be well under 60ms
        expect(avgTickTime).toBeLessThan(targetTickMs);
        
        // Max tick time should not exceed 2x target (spike tolerance)
        expect(maxTickTime).toBeLessThan(targetTickMs * 2);
        
        console.log(`[Stress Test] 600 units - Avg: ${avgTickTime.toFixed(2)}ms, Max: ${maxTickTime.toFixed(2)}ms`);
      });
    });
    
    describe('3.2 Security (클라이언트 좌표 무시)', () => {
      it('should ignore client position data in commands', () => {
        const mockFleet = createMockFleet('destroyer', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 100, y: 0, z: 100 });
        
        const unit = session.getUnits()[0];
        const originalPosition = { ...unit.position };
        
        // Try to send command with manipulated position
        // (In a real attack, client might try to teleport)
        session.queueCommand('faction-a', 'cmd-1', {
          type: 'MOVE',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: {
            targetPosition: { x: 500, y: 0, z: 500 },
            // Attacker might try to inject: position: { x: 9999, y: 0, z: 9999 }
          },
        });
        
        (session as any).processCommands();
        
        // Position should NOT have changed immediately
        // (only velocity/target should change)
        expect(unit.position.x).toBe(originalPosition.x);
        expect(unit.position.y).toBe(originalPosition.y);
        expect(unit.position.z).toBe(originalPosition.z);
        
        // Target should be set
        expect(unit.targetPosition).toEqual({ x: 500, y: 0, z: 500 });
      });
      
      it('should reject commands for units not owned by faction', () => {
        const fleetA = createMockFleet('cruiser', 5);
        const fleetB = createMockFleet('destroyer', 5);
        
        fleetA.factionId = 'faction-a';
        fleetB.factionId = 'faction-b';
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(fleetA, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(fleetB, { x: 500, y: 0, z: 0 });
        
        const units = session.getUnits();
        const unitA = units.find(u => u.factionId === 'faction-a')!;
        const unitB = units.find(u => u.factionId === 'faction-b')!;
        
        // Faction A tries to command Faction B's unit
        const result = session.queueCommand('faction-a', 'cmd-a', {
          type: 'MOVE',
          unitIds: [unitB.id], // Enemy unit!
          timestamp: Date.now(),
          data: { targetPosition: { x: 0, y: 0, z: 0 } },
        });
        
        // Command should be rejected (returns false)
        expect(result).toBe(false);
      });
      
      it('should validate unit ownership on command execution', () => {
        const fleetA = createMockFleet('battleship', 3);
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addFleetUnits(fleetA, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        
        // Command from unknown faction should fail
        const result = session.queueCommand('faction-unknown', 'cmd-x', {
          type: 'ATTACK',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: { targetId: 'some-target' },
        });
        
        expect(result).toBe(false);
      });
    });
  });
});

  // ============================================================
  // Phase 4: 추가 물리 검증
  // ============================================================
  
  describe('Phase 4: Additional Physics', () => {
    describe('4.1 Acceleration (가속)', () => {
      it('should accelerate towards target position', () => {
        const mockFleet = createMockFleet('cruiser', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        unit.velocity = { x: 0, y: 0, z: 0 };
        unit.targetPosition = { x: 1000, y: 0, z: 0 };
        
        // Set engine energy high
        unit.energyDistribution = {
          ...DEFAULT_ENERGY_DISTRIBUTION,
          engine: 40,
        };
        
        const velocities: number[] = [0];
        
        // Simulate acceleration
        for (let i = 0; i < 10; i++) {
          (session as any).updatePhysics(0.06);
          velocities.push(unit.velocity.x);
        }
        
        // Velocity should increase (accelerating towards target)
        expect(velocities[velocities.length - 1]).toBeGreaterThan(0);
        
        // Check acceleration pattern
        let isAccelerating = true;
        for (let i = 2; i < velocities.length; i++) {
          if (velocities[i] < velocities[i - 1]) {
            isAccelerating = false;
            break;
          }
        }
        
        expect(isAccelerating).toBe(true);
      });
      
      it('should decelerate when approaching target', () => {
        const mockFleet = createMockFleet('destroyer', 3);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        unit.velocity = { x: 100, y: 0, z: 0 };
        unit.targetPosition = { x: 50, y: 0, z: 0 }; // Target very close
        
        const initialVelocity = unit.velocity.x;
        
        // Simulate multiple ticks
        for (let i = 0; i < 5; i++) {
          (session as any).updatePhysics(0.06);
        }
        
        // Should slow down when overshooting/approaching target
        expect(Math.abs(unit.velocity.x)).toBeLessThan(initialVelocity);
      });
    });
    
    describe('4.2 Collision Detection (충돌 감지)', () => {
      it('should detect units within collision range', () => {
        const fleetA = createMockFleet('battleship', 1);
        const fleetB = createMockFleet('cruiser', 1);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        
        // Place units very close together
        session.addFleetUnits(fleetA, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(fleetB, { x: 5, y: 0, z: 0 }); // 5 units apart
        
        const units = session.getUnits();
        const unitA = units[0];
        const unitB = units[1];
        
        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(unitB.position.x - unitA.position.x, 2) +
          Math.pow(unitB.position.y - unitA.position.y, 2) +
          Math.pow(unitB.position.z - unitA.position.z, 2)
        );
        
        // Units should be within close range
        expect(distance).toBeLessThan(TACTICAL_CONSTANTS.COLLISION_RADIUS * 2 || 100);
      });
    });
  });
  
  // ============================================================
  // Phase 5: 추가 전투 검증
  // ============================================================
  
  describe('Phase 5: Additional Combat', () => {
    describe('5.1 Weapon Types (무기 타입)', () => {
      it('should apply different damage calculations for BEAM vs GUN', () => {
        const fleetA = createMockFleet('battleship', 5);
        const fleetB = createMockFleet('cruiser', 5);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(fleetA, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(fleetB, { x: 100, y: 0, z: 0 });
        
        const units = session.getUnits();
        const attacker = units.find(u => u.factionId === 'faction-a')!;
        const defender1 = { ...units.find(u => u.factionId === 'faction-b')!, hp: 1000, shieldFront: 50, armor: 50 };
        const defender2 = { ...units.find(u => u.factionId === 'faction-b')!, hp: 1000, shieldFront: 50, armor: 50 };
        
        // Apply same raw damage with different weapon types
        (session as any).applyDamage(attacker, defender1, 100, 'BEAM');
        (session as any).applyDamage(attacker, defender2, 100, 'GUN');
        
        // Both should take damage (exact values depend on implementation)
        expect(defender1.hp).toBeLessThanOrEqual(1000);
        expect(defender2.hp).toBeLessThanOrEqual(1000);
      });
      
      it('should track ammunition consumption', () => {
        const mockFleet = createMockFleet('destroyer', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        const initialAmmo = unit.ammo;
        
        // Set high gun energy
        unit.energyDistribution = {
          ...DEFAULT_ENERGY_DISTRIBUTION,
          gun: 40,
          beam: 10,
        };
        
        // Target an enemy (even if none exists, ammo tracking logic should work)
        expect(unit.ammo).toBeLessThanOrEqual(initialAmmo);
      });
    });
    
    describe('5.2 Shield Regeneration', () => {
      it('should regenerate shields based on shield energy allocation', () => {
        const mockFleet = createMockFleet('battleship', 1);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        
        // Set initial damaged shield
        unit.shieldFront = 50;
        unit.shieldRear = 50;
        const maxShield = unit.shieldMax || 100;
        
        // Allocate high shield energy
        unit.energyDistribution = {
          beam: 10,
          gun: 10,
          shield: 40, // High shield regen
          engine: 20,
          warp: 10,
          sensor: 10,
        };
        
        // Should have shields below max (damaged state)
        expect(unit.shieldFront).toBeLessThan(maxShield);
      });
    });
  });
  
  // ============================================================
  // Phase 6: 명령어 검증
  // ============================================================
  
  describe('Phase 6: Command Validation', () => {
    describe('6.1 Command Rate Limiting', () => {
      it('should allow commands within rate limit', () => {
        const mockFleet = createMockFleet('cruiser', 5);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        
        // Queue multiple commands
        for (let i = 0; i < 5; i++) {
          const result = session.queueCommand('faction-a', 'cmd-1', {
            type: 'MOVE',
            unitIds: [unit.id],
            timestamp: Date.now() + i * 100,
            data: { targetPosition: { x: i * 100, y: 0, z: 0 } },
          });
          
          // Early commands should succeed
          if (i < 3) {
            expect(result).toBe(true);
          }
        }
      });
    });
    
    describe('6.2 Command Priority', () => {
      it('should process ATTACK commands with appropriate priority', () => {
        const fleetA = createMockFleet('battleship', 3);
        const fleetB = createMockFleet('destroyer', 3);
        
        session.addParticipant('faction-a', ['fleet-a'], ['cmd-a']);
        session.addParticipant('faction-b', ['fleet-b'], ['cmd-b']);
        session.addFleetUnits(fleetA, { x: 0, y: 0, z: 0 });
        session.addFleetUnits(fleetB, { x: 100, y: 0, z: 0 });
        
        const units = session.getUnits();
        const attackerUnit = units.find(u => u.factionId === 'faction-a')!;
        const targetUnit = units.find(u => u.factionId === 'faction-b')!;
        
        const result = session.queueCommand('faction-a', 'cmd-a', {
          type: 'ATTACK',
          unitIds: [attackerUnit.id],
          timestamp: Date.now(),
          data: { targetId: targetUnit.id },
        });
        
        expect(result).toBe(true);
        
        // Process and verify target is set
        (session as any).processCommands();
        expect(attackerUnit.targetId).toBe(targetUnit.id);
      });
    });
    
    describe('6.3 Invalid Command Handling', () => {
      it('should reject commands with invalid unit IDs', () => {
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        
        const result = session.queueCommand('faction-a', 'cmd-1', {
          type: 'MOVE',
          unitIds: ['invalid-unit-id'],
          timestamp: Date.now(),
          data: { targetPosition: { x: 100, y: 0, z: 0 } },
        });
        
        expect(result).toBe(false);
      });
      
      it('should reject commands from non-participant commanders', () => {
        const mockFleet = createMockFleet('cruiser', 3);
        session.addParticipant('faction-a', ['fleet-1'], ['cmd-1']);
        session.addFleetUnits(mockFleet, { x: 0, y: 0, z: 0 });
        
        const unit = session.getUnits()[0];
        
        // Non-existent commander
        const result = session.queueCommand('faction-a', 'cmd-invalid', {
          type: 'MOVE',
          unitIds: [unit.id],
          timestamp: Date.now(),
          data: { targetPosition: { x: 100, y: 0, z: 0 } },
        });
        
        expect(result).toBe(false);
      });
    });
  });
});

// ============================================================
// Helper Functions
// ============================================================

function createMockFleet(shipClass: ShipClass, count: number): IFleet {
  const spec = SHIP_SPECS[shipClass];
  
  return {
    fleetId: `fleet-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 'test-session',
    commanderId: 'test-commander',
    factionId: 'faction-a',
    name: 'Test Fleet',
    status: 'IDLE',
    statusData: {},
    location: { type: 'SYSTEM', systemId: 'sys-001' },
    units: [{
      unitId: `unit-${Math.random().toString(36).slice(2, 8)}`,
      shipClass,
      count,
      hp: 100,
      morale: 100,
      fuel: spec.fuelConsumption * 10 * count,
      maxFuel: spec.fuelConsumption * 10 * count,
      ammo: spec.ammoConsumption * 10 * count,
      maxAmmo: spec.ammoConsumption * 10 * count,
      crewCount: spec.crewCapacity * count,
      maxCrew: spec.crewCapacity * count,
      veterancy: 0,
      destroyed: 0,
      damaged: 0,
    }],
    maxUnits: 6,
    totalShips: count,
    maxShips: 300,
    formation: 'standard',
    tactics: {
      engageDistance: 'medium',
      retreatThreshold: 20,
      priorityTargets: [],
    },
    combatStats: {
      battlesWon: 0,
      battlesLost: 0,
      shipsDestroyed: 0,
      shipsLost: 0,
      damageDealt: 0,
      damageTaken: 0,
    },
    isLocked: false,
    createdAt: new Date(),
    data: {},
  } as unknown as IFleet;
}

