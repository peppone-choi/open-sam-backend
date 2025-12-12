/**
 * BattleAIService
 * 
 * AI system for controlling fleets in realtime battles
 * Provides different AI strategies and difficulty levels
 */

import { IVector3 } from '../../../models/gin7/Fleet';
import { FleetPhysicsEngine, Vector3 } from '../physics/FleetPhysicsEngine';
import { BattleFleetState, CommandType, RealtimeBattleEngine } from './RealtimeBattleEngine';

/**
 * AI Strategy types
 */
export type AIStrategy = 
  | 'AGGRESSIVE'    // Attack nearest enemy, pursue relentlessly
  | 'DEFENSIVE'     // Hold position, engage only when enemies approach
  | 'CAUTIOUS'      // Maintain distance, retreat when damaged
  | 'FLANKING'      // Try to attack from sides/rear
  | 'FOCUS_FIRE'    // Coordinate attacks on single target
  | 'SCATTER'       // Spread out to avoid concentrated fire
  | 'KITING'        // Hit and run tactics
  | 'FORMATION';    // Maintain formation with allies

/**
 * AI Difficulty levels
 */
export type AIDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';

/**
 * AI Fleet controller state
 */
export interface AIFleetController {
  fleetId: string;
  strategy: AIStrategy;
  difficulty: AIDifficulty;
  lastDecisionTick: number;
  currentTarget?: string;
  targetPosition?: IVector3;
  retreatThreshold: number;
  aggressiveness: number;  // 0-1, affects engagement decisions
  reactionTime: number;    // Ticks between decisions
  formationOffset?: IVector3;  // Offset from formation leader
  formationLeader?: string;    // Fleet ID of formation leader
}

/**
 * AI Decision result
 */
export interface AIDecision {
  type: CommandType;
  data: {
    targetPosition?: IVector3;
    targetFleetId?: string;
    formationType?: string;
    direction?: IVector3;
    heading?: number;
  };
  priority: number;  // Higher = more urgent
}

/**
 * BattleAIService class
 */
export class BattleAIService {
  private engine: RealtimeBattleEngine;
  private controllers: Map<string, AIFleetController> = new Map();
  
  // AI tuning parameters by difficulty
  private static readonly DIFFICULTY_PARAMS: Record<AIDifficulty, {
    reactionTime: number;
    accuracyBonus: number;
    retreatThreshold: number;
    aggressiveness: number;
    decisionQuality: number;
  }> = {
    EASY: {
      reactionTime: 20,      // Slow reactions (2 sec)
      accuracyBonus: -10,    // -10% accuracy
      retreatThreshold: 50,  // Retreats at 50% HP
      aggressiveness: 0.3,
      decisionQuality: 0.5   // 50% chance of optimal decision
    },
    NORMAL: {
      reactionTime: 10,      // Normal reactions (1 sec)
      accuracyBonus: 0,
      retreatThreshold: 30,
      aggressiveness: 0.5,
      decisionQuality: 0.7
    },
    HARD: {
      reactionTime: 5,       // Fast reactions (0.5 sec)
      accuracyBonus: 5,
      retreatThreshold: 20,
      aggressiveness: 0.7,
      decisionQuality: 0.85
    },
    EXPERT: {
      reactionTime: 3,       // Very fast (0.3 sec)
      accuracyBonus: 10,
      retreatThreshold: 10,
      aggressiveness: 0.9,
      decisionQuality: 0.95
    }
  };

  constructor(engine: RealtimeBattleEngine) {
    this.engine = engine;
  }

  /**
   * Register a fleet for AI control
   */
  registerFleet(
    fleetId: string, 
    strategy: AIStrategy = 'AGGRESSIVE',
    difficulty: AIDifficulty = 'NORMAL'
  ): void {
    const params = BattleAIService.DIFFICULTY_PARAMS[difficulty];
    
    this.controllers.set(fleetId, {
      fleetId,
      strategy,
      difficulty,
      lastDecisionTick: 0,
      retreatThreshold: params.retreatThreshold,
      aggressiveness: params.aggressiveness,
      reactionTime: params.reactionTime
    });
  }

  /**
   * Unregister fleet from AI control
   */
  unregisterFleet(fleetId: string): void {
    this.controllers.delete(fleetId);
  }

  /**
   * Set fleet strategy
   */
  setStrategy(fleetId: string, strategy: AIStrategy): void {
    const controller = this.controllers.get(fleetId);
    if (controller) {
      controller.strategy = strategy;
    }
  }

  /**
   * Set formation leader
   */
  setFormationLeader(fleetId: string, leaderId: string, offset: IVector3): void {
    const controller = this.controllers.get(fleetId);
    if (controller) {
      controller.formationLeader = leaderId;
      controller.formationOffset = offset;
    }
  }

  /**
   * Process AI tick - called every game tick
   */
  processTick(currentTick: number): void {
    for (const [fleetId, controller] of this.controllers) {
      // Check if it's time to make a decision
      if (currentTick - controller.lastDecisionTick < controller.reactionTime) {
        continue;
      }
      
      const fleetState = this.engine.getFleetState(fleetId);
      if (!fleetState || fleetState.isDefeated) {
        continue;
      }
      
      // Make decision based on strategy
      const decision = this.makeDecision(fleetState, controller, currentTick);
      
      if (decision) {
        this.engine.queueCommand(fleetId, decision.type, decision.data);
        controller.lastDecisionTick = currentTick;
        
        // Update controller state based on decision
        if (decision.data.targetFleetId) {
          controller.currentTarget = decision.data.targetFleetId;
        }
        if (decision.data.targetPosition) {
          controller.targetPosition = decision.data.targetPosition;
        }
      }
    }
  }

  /**
   * Make AI decision
   */
  private makeDecision(
    fleet: BattleFleetState,
    controller: AIFleetController,
    currentTick: number
  ): AIDecision | null {
    const params = BattleAIService.DIFFICULTY_PARAMS[controller.difficulty];
    
    // Check if should retreat
    if (fleet.hp <= controller.retreatThreshold && fleet.morale < 30) {
      return {
        type: 'RETREAT',
        data: {},
        priority: 100
      };
    }
    
    // Execute strategy
    switch (controller.strategy) {
      case 'AGGRESSIVE':
        return this.aggressiveStrategy(fleet, controller, params);
      case 'DEFENSIVE':
        return this.defensiveStrategy(fleet, controller, params);
      case 'CAUTIOUS':
        return this.cautiousStrategy(fleet, controller, params);
      case 'FLANKING':
        return this.flankingStrategy(fleet, controller, params);
      case 'FOCUS_FIRE':
        return this.focusFireStrategy(fleet, controller, params);
      case 'KITING':
        return this.kitingStrategy(fleet, controller, params);
      case 'FORMATION':
        return this.formationStrategy(fleet, controller, params);
      case 'SCATTER':
        return this.scatterStrategy(fleet, controller, params);
      default:
        return this.aggressiveStrategy(fleet, controller, params);
    }
  }

  /**
   * Aggressive strategy - attack nearest enemy
   */
  private aggressiveStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    // Find nearest enemy
    const nearest = this.findNearestFleet(fleet, enemies);
    if (!nearest) return null;
    
    // Sub-optimal decision chance for lower difficulties
    const useOptimal = Math.random() < params.decisionQuality;
    const target = useOptimal ? nearest : enemies[Math.floor(Math.random() * enemies.length)];
    
    return {
      type: 'ATTACK',
      data: { targetFleetId: target.fleetId },
      priority: 50
    };
  }

  /**
   * Defensive strategy - hold position, engage when approached
   */
  private defensiveStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    // Find closest enemy
    const nearest = this.findNearestFleet(fleet, enemies);
    if (!nearest) return null;
    
    const distance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      nearest.physics.combat.position
    );
    
    // Engage only if enemy is close
    const engageRange = fleet.weaponRange * 1.2;
    if (distance <= engageRange) {
      return {
        type: 'ATTACK',
        data: { targetFleetId: nearest.fleetId },
        priority: 40
      };
    }
    
    // Otherwise hold position
    return {
      type: 'STOP',
      data: {},
      priority: 20
    };
  }

  /**
   * Cautious strategy - maintain distance, retreat when damaged
   */
  private cautiousStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    const nearest = this.findNearestFleet(fleet, enemies);
    if (!nearest) return null;
    
    const distance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      nearest.physics.combat.position
    );
    
    // If damaged, try to maintain range
    if (fleet.hp < 70) {
      const optimalRange = fleet.weaponRange * 0.9;
      if (distance < optimalRange) {
        // Move away
        const awayDir = Vector3.normalize(
          Vector3.subtract(fleet.physics.combat.position, nearest.physics.combat.position)
        );
        const targetPos = Vector3.add(
          fleet.physics.combat.position,
          Vector3.multiply(awayDir, 100)
        );
        return {
          type: 'MOVE',
          data: { targetPosition: targetPos },
          priority: 60
        };
      }
    }
    
    // Attack from optimal range
    return {
      type: 'ATTACK',
      data: { targetFleetId: nearest.fleetId },
      priority: 40
    };
  }

  /**
   * Flanking strategy - attack from sides/rear
   */
  private flankingStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    // Find a target
    const target = controller.currentTarget 
      ? enemies.find(e => e.fleetId === controller.currentTarget)
      : this.findNearestFleet(fleet, enemies);
    
    if (!target) return null;
    
    const distance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      target.physics.combat.position
    );
    
    // Calculate flanking position (perpendicular to target's heading)
    const targetHeading = target.physics.combat.heading;
    const flankAngle = targetHeading + 90 + (Math.random() > 0.5 ? 0 : 180);
    const flankDir = Vector3.fromHeading(flankAngle);
    
    const optimalRange = fleet.weaponRange * 0.7;
    const flankPos = Vector3.add(
      target.physics.combat.position,
      Vector3.multiply(flankDir, optimalRange)
    );
    
    // If already in position, attack
    const flankDistance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      flankPos
    );
    
    if (flankDistance < 50 && distance < fleet.weaponRange) {
      return {
        type: 'ATTACK',
        data: { targetFleetId: target.fleetId },
        priority: 50
      };
    }
    
    // Move to flanking position
    return {
      type: 'MOVE',
      data: { targetPosition: flankPos },
      priority: 45
    };
  }

  /**
   * Focus fire strategy - coordinate attacks on weakest enemy
   */
  private focusFireStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    // Find weakest enemy (lowest HP + ships)
    const weakest = enemies.reduce((weak, current) => {
      const weakScore = weak.hp + (weak.currentShips / weak.maxShips) * 100;
      const currentScore = current.hp + (current.currentShips / current.maxShips) * 100;
      return currentScore < weakScore ? current : weak;
    });
    
    return {
      type: 'ATTACK',
      data: { targetFleetId: weakest.fleetId },
      priority: 55
    };
  }

  /**
   * Kiting strategy - hit and run
   */
  private kitingStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const enemies = this.getEnemyFleets(fleet);
    if (enemies.length === 0) return null;
    
    const nearest = this.findNearestFleet(fleet, enemies);
    if (!nearest) return null;
    
    const distance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      nearest.physics.combat.position
    );
    
    const minRange = fleet.weaponRange * 0.6;
    const maxRange = fleet.weaponRange * 0.9;
    
    // Too close - retreat while firing
    if (distance < minRange) {
      const awayDir = Vector3.normalize(
        Vector3.subtract(fleet.physics.combat.position, nearest.physics.combat.position)
      );
      const targetPos = Vector3.add(
        fleet.physics.combat.position,
        Vector3.multiply(awayDir, maxRange)
      );
      return {
        type: 'MOVE',
        data: { targetPosition: targetPos },
        priority: 60
      };
    }
    
    // In optimal range - attack
    if (distance <= maxRange) {
      return {
        type: 'ATTACK',
        data: { targetFleetId: nearest.fleetId },
        priority: 50
      };
    }
    
    // Too far - approach
    return {
      type: 'MOVE',
      data: { targetPosition: nearest.physics.combat.position },
      priority: 40
    };
  }

  /**
   * Formation strategy - maintain formation with allies
   */
  private formationStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    if (!controller.formationLeader || !controller.formationOffset) {
      // No formation assigned, fallback to aggressive
      return this.aggressiveStrategy(fleet, controller, params);
    }
    
    const leader = this.engine.getFleetState(controller.formationLeader);
    if (!leader || leader.isDefeated) {
      // Leader destroyed, switch to aggressive
      controller.strategy = 'AGGRESSIVE';
      return this.aggressiveStrategy(fleet, controller, params);
    }
    
    // Calculate target position relative to leader
    const leaderHeading = leader.physics.combat.heading;
    const rotatedOffset = this.rotateVector(controller.formationOffset, leaderHeading);
    const targetPos = Vector3.add(leader.physics.combat.position, rotatedOffset);
    
    const distToTarget = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      targetPos
    );
    
    // Move to formation position
    if (distToTarget > 20) {
      return {
        type: 'MOVE',
        data: { targetPosition: targetPos },
        priority: 30
      };
    }
    
    // In position - attack if leader is attacking
    if (leader.currentTarget) {
      return {
        type: 'ATTACK',
        data: { targetFleetId: leader.currentTarget },
        priority: 45
      };
    }
    
    // Match leader's heading
    return {
      type: 'ROTATE',
      data: { heading: leaderHeading },
      priority: 20
    };
  }

  /**
   * Scatter strategy - spread out to avoid concentrated fire
   */
  private scatterStrategy(
    fleet: BattleFleetState,
    controller: AIFleetController,
    params: typeof BattleAIService.DIFFICULTY_PARAMS.NORMAL
  ): AIDecision | null {
    const allies = this.getAllyFleets(fleet);
    const enemies = this.getEnemyFleets(fleet);
    
    // Calculate average ally position
    if (allies.length > 0) {
      let avgPos = Vector3.zero();
      for (const ally of allies) {
        avgPos = Vector3.add(avgPos, ally.physics.combat.position);
      }
      avgPos = Vector3.divide(avgPos, allies.length);
      
      const distToAllies = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        avgPos
      );
      
      // Too close to allies, spread out
      if (distToAllies < 100) {
        const awayDir = Vector3.normalize(
          Vector3.subtract(fleet.physics.combat.position, avgPos)
        );
        const targetPos = Vector3.add(
          fleet.physics.combat.position,
          Vector3.multiply(awayDir, 150)
        );
        return {
          type: 'MOVE',
          data: { targetPosition: targetPos },
          priority: 35
        };
      }
    }
    
    // Otherwise attack nearest enemy
    if (enemies.length > 0) {
      const nearest = this.findNearestFleet(fleet, enemies);
      if (nearest) {
        return {
          type: 'ATTACK',
          data: { targetFleetId: nearest.fleetId },
          priority: 40
        };
      }
    }
    
    return null;
  }

  /**
   * Get all enemy fleets
   */
  private getEnemyFleets(fleet: BattleFleetState): BattleFleetState[] {
    return this.engine.getAllFleetStates().filter(f => 
      f.factionId !== fleet.factionId && 
      !f.isDefeated &&
      !f.isRetreating
    );
  }

  /**
   * Get all ally fleets
   */
  private getAllyFleets(fleet: BattleFleetState): BattleFleetState[] {
    return this.engine.getAllFleetStates().filter(f => 
      f.factionId === fleet.factionId && 
      f.fleetId !== fleet.fleetId &&
      !f.isDefeated
    );
  }

  /**
   * Find nearest fleet from list
   */
  private findNearestFleet(
    origin: BattleFleetState, 
    targets: BattleFleetState[]
  ): BattleFleetState | null {
    if (targets.length === 0) return null;
    
    let nearest: BattleFleetState | null = null;
    let nearestDist = Infinity;
    
    for (const target of targets) {
      const dist = FleetPhysicsEngine.calculateDistance(
        origin.physics.combat.position,
        target.physics.combat.position
      );
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = target;
      }
    }
    
    return nearest;
  }

  /**
   * Rotate a vector by angle (degrees)
   */
  private rotateVector(v: IVector3, angleDeg: number): IVector3 {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
      z: v.z
    };
  }

  /**
   * Get controller for fleet
   */
  getController(fleetId: string): AIFleetController | undefined {
    return this.controllers.get(fleetId);
  }

  /**
   * Check if fleet is AI controlled
   */
  isAIControlled(fleetId: string): boolean {
    return this.controllers.has(fleetId);
  }

  /**
   * Get all AI controlled fleets
   */
  getAllControlledFleets(): string[] {
    return Array.from(this.controllers.keys());
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.controllers.clear();
  }
}

export default BattleAIService;
