/**
 * AIBattleController
 * 
 * High-level AI controller that coordinates AI fleet behavior in battles.
 * Integrates with:
 * - DelegationService (to know which fleets need AI control)
 * - AIProfileService (to get commander-based behavior profiles)
 * - BattleAIService (to execute AI decisions)
 * - RealtimeBattleEngine (to issue commands)
 * 
 * This controller is called each tick to process AI fleets.
 */

import { EventEmitter } from 'events';
import { delegationService, IDelegationState } from './DelegationService';
import { aiProfileService, IAIBattleProfile, TargetPriority } from './AIProfileService';
import { BattleAIService, AIStrategy, AIDifficulty, AIFleetController } from './BattleAIService';
import { RealtimeBattleEngine, BattleFleetState, CommandType } from './RealtimeBattleEngine';
import { FleetPhysicsEngine, Vector3 } from '../physics/FleetPhysicsEngine';
import { IVector3 } from '../../../models/gin7/Fleet';

/**
 * AI Fleet state tracking
 */
interface AIFleetState {
  fleetId: string;
  profile: IAIBattleProfile;
  lastDecisionTick: number;
  currentTarget?: string;
  currentAction?: CommandType;
  situationAssessment?: ISituationAssessment;
  retreatRequested: boolean;
}

/**
 * Situation assessment for AI decision making
 */
interface ISituationAssessment {
  tick: number;
  
  // Fleet status
  hpPercent: number;
  moralePercent: number;
  shipsRemaining: number;
  isOutnumbered: boolean;
  
  // Battle status
  enemyCount: number;
  allyCount: number;
  nearestEnemyDistance: number;
  nearestAllyDistance: number;
  
  // Tactical situation
  isWinning: boolean;
  isLosing: boolean;
  isStalemate: boolean;
  
  // Threats
  highestThreatFleetId?: string;
  lowestHpEnemyId?: string;
}

/**
 * AI action decision
 */
interface AIActionDecision {
  type: CommandType;
  priority: number;
  data: {
    targetPosition?: IVector3;
    targetFleetId?: string;
    formationType?: string;
    heading?: number;
  };
  reason: string;
}

/**
 * AIBattleController class
 */
export class AIBattleController extends EventEmitter {
  private battleId: string;
  private engine: RealtimeBattleEngine;
  private aiService: BattleAIService;
  
  // Track AI-controlled fleets
  private aiFleetStates: Map<string, AIFleetState> = new Map();
  
  // Performance tracking
  private ticksProcessed: number = 0;
  private decisionsIssued: number = 0;

  constructor(battleId: string, engine: RealtimeBattleEngine) {
    super();
    this.battleId = battleId;
    this.engine = engine;
    this.aiService = new BattleAIService(engine);
  }

  /**
   * Initialize AI controller for a battle
   * Sets up AI control for offline player fleets
   */
  async initialize(): Promise<void> {
    // Get all AI-controlled fleets in this battle
    const aiFleetIds = delegationService.getAIControlledFleets(this.battleId);
    
    for (const fleetId of aiFleetIds) {
      await this.registerFleet(fleetId);
    }

    // Listen for delegation changes
    delegationService.on('delegation:ai', (event) => {
      if (event.battleId === this.battleId) {
        this.registerFleet(event.fleetId);
      }
    });

    delegationService.on('delegation:reclaimed', (event) => {
      if (event.battleId === this.battleId) {
        this.unregisterFleet(event.fleetId);
      }
    });

    delegationService.on('delegation:subordinate', (event) => {
      if (event.battleId === this.battleId) {
        this.unregisterFleet(event.fleetId);
      }
    });

    this.emit('initialized', { battleId: this.battleId, aiFleetCount: this.aiFleetStates.size });
  }

  /**
   * Register a fleet for AI control
   */
  async registerFleet(fleetId: string): Promise<void> {
    const delegation = delegationService.getDelegationState(fleetId);
    if (!delegation || delegation.delegationType !== 'AI') {
      return;
    }

    const profile = delegation.aiProfile;
    if (!profile) {
      return;
    }

    // Create AI fleet state
    const aiState: AIFleetState = {
      fleetId,
      profile,
      lastDecisionTick: 0,
      retreatRequested: false
    };

    this.aiFleetStates.set(fleetId, aiState);

    // Register with BattleAIService for low-level AI behavior
    this.aiService.registerFleet(
      fleetId,
      profile.preferredStrategy,
      profile.effectiveDifficulty
    );

    this.emit('fleet:registered', { fleetId, profile });
  }

  /**
   * Unregister a fleet from AI control (player reclaimed)
   */
  unregisterFleet(fleetId: string): void {
    this.aiFleetStates.delete(fleetId);
    this.aiService.unregisterFleet(fleetId);
    
    this.emit('fleet:unregistered', { fleetId });
  }

  /**
   * Process AI tick - called every game tick
   * Main entry point from RealtimeBattleEngine
   */
  processTick(currentTick: number): void {
    this.ticksProcessed++;

    for (const [fleetId, aiState] of this.aiFleetStates) {
      // Check if it's time for this fleet to make a decision
      if (currentTick - aiState.lastDecisionTick < aiState.profile.reactionTime) {
        continue;
      }

      const fleetState = this.engine.getFleetState(fleetId);
      if (!fleetState || fleetState.isDefeated) {
        continue;
      }

      // Assess situation
      const assessment = this.assessSituation(fleetState, currentTick);
      aiState.situationAssessment = assessment;

      // Make decision based on profile and situation
      const decision = this.makeDecision(fleetState, aiState, assessment);

      if (decision) {
        this.executeDecision(fleetId, decision);
        aiState.lastDecisionTick = currentTick;
        aiState.currentAction = decision.type;
        
        this.decisionsIssued++;
        this.emit('decision', { fleetId, decision, tick: currentTick });
      }
    }

    // Also let BattleAIService do its low-level processing
    this.aiService.processTick(currentTick);
  }

  /**
   * Assess the current battle situation for a fleet
   */
  private assessSituation(fleet: BattleFleetState, tick: number): ISituationAssessment {
    const allFleets = this.engine.getAllFleetStates();
    
    // Categorize fleets
    const enemies = allFleets.filter(f => 
      f.factionId !== fleet.factionId && !f.isDefeated
    );
    const allies = allFleets.filter(f => 
      f.factionId === fleet.factionId && f.fleetId !== fleet.fleetId && !f.isDefeated
    );

    // Calculate distances
    let nearestEnemyDist = Infinity;
    let nearestAllyDist = Infinity;
    let highestThreatId: string | undefined;
    let highestThreat = 0;
    let lowestHpEnemyId: string | undefined;
    let lowestHp = Infinity;

    for (const enemy of enemies) {
      const dist = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        enemy.physics.combat.position
      );
      
      if (dist < nearestEnemyDist) {
        nearestEnemyDist = dist;
      }

      // Calculate threat based on ships and distance
      const threat = enemy.currentShips / Math.max(dist, 100);
      if (threat > highestThreat) {
        highestThreat = threat;
        highestThreatId = enemy.fleetId;
      }

      if (enemy.hp < lowestHp) {
        lowestHp = enemy.hp;
        lowestHpEnemyId = enemy.fleetId;
      }
    }

    for (const ally of allies) {
      const dist = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        ally.physics.combat.position
      );
      
      if (dist < nearestAllyDist) {
        nearestAllyDist = dist;
      }
    }

    // Calculate force balance
    const enemyForce = enemies.reduce((sum, e) => sum + e.currentShips, 0);
    const allyForce = allies.reduce((sum, a) => sum + a.currentShips, 0) + fleet.currentShips;
    
    const forceRatio = allyForce / Math.max(enemyForce, 1);

    return {
      tick,
      hpPercent: fleet.hp,
      moralePercent: fleet.morale,
      shipsRemaining: fleet.currentShips,
      isOutnumbered: forceRatio < 0.8,
      enemyCount: enemies.length,
      allyCount: allies.length,
      nearestEnemyDistance: nearestEnemyDist === Infinity ? 1000 : nearestEnemyDist,
      nearestAllyDistance: nearestAllyDist === Infinity ? 1000 : nearestAllyDist,
      isWinning: forceRatio > 1.3,
      isLosing: forceRatio < 0.7,
      isStalemate: forceRatio >= 0.8 && forceRatio <= 1.2,
      highestThreatFleetId: highestThreatId,
      lowestHpEnemyId
    };
  }

  /**
   * Make AI decision based on profile and situation
   */
  private makeDecision(
    fleet: BattleFleetState,
    aiState: AIFleetState,
    assessment: ISituationAssessment
  ): AIActionDecision | null {
    const profile = aiState.profile;

    // 1. Check for retreat conditions
    if (this.shouldRetreat(fleet, profile, assessment)) {
      if (!aiState.retreatRequested) {
        aiState.retreatRequested = true;
        return {
          type: 'RETREAT',
          priority: 100,
          data: {},
          reason: 'HP or morale below threshold'
        };
      }
      return null; // Already retreating
    }

    // 2. Adjust profile based on situation
    const adjustedProfile = aiProfileService.adjustProfileForSituation(profile, {
      outnumbered: assessment.isOutnumbered,
      winning: assessment.isWinning,
      lowSupply: false // TODO: integrate supply tracking
    });

    // 3. Select target based on priorities
    const target = this.selectTarget(fleet, adjustedProfile, assessment);

    // 4. Decide action based on strategy
    return this.decideActionByStrategy(fleet, aiState, adjustedProfile, assessment, target);
  }

  /**
   * Check if fleet should retreat
   */
  private shouldRetreat(
    fleet: BattleFleetState,
    profile: IAIBattleProfile,
    assessment: ISituationAssessment
  ): boolean {
    // Already retreating
    if (fleet.isRetreating) return false;

    // Check HP threshold
    if (assessment.hpPercent <= profile.retreatThreshold) {
      return true;
    }

    // Check morale threshold
    if (assessment.moralePercent <= profile.moraleThreshold) {
      return true;
    }

    // Heavily outnumbered and losing badly
    if (assessment.isOutnumbered && assessment.isLosing && assessment.hpPercent < 50) {
      // High caution commanders retreat earlier
      if (profile.caution > 60) {
        return true;
      }
    }

    return false;
  }

  /**
   * Select target based on profile priorities
   */
  private selectTarget(
    fleet: BattleFleetState,
    profile: IAIBattleProfile,
    assessment: ISituationAssessment
  ): BattleFleetState | null {
    const enemies = this.engine.getAllFleetStates().filter(f =>
      f.factionId !== fleet.factionId && !f.isDefeated && !f.isRetreating
    );

    if (enemies.length === 0) return null;

    // Go through priorities in order
    for (const priority of profile.targetPriority) {
      const target = this.selectTargetByPriority(fleet, enemies, priority, assessment);
      if (target) return target;
    }

    // Fallback: nearest
    return this.findNearestEnemy(fleet, enemies);
  }

  /**
   * Select target by priority type
   */
  private selectTargetByPriority(
    fleet: BattleFleetState,
    enemies: BattleFleetState[],
    priority: TargetPriority,
    assessment: ISituationAssessment
  ): BattleFleetState | null {
    switch (priority) {
      case 'NEAREST':
        return this.findNearestEnemy(fleet, enemies);

      case 'WEAKEST':
        return enemies.reduce((weak, e) => e.hp < weak.hp ? e : weak, enemies[0]);

      case 'STRONGEST':
        return enemies.reduce((strong, e) => e.currentShips > strong.currentShips ? e : strong, enemies[0]);

      case 'DAMAGED':
        // Find enemy with HP below 50%
        const damaged = enemies.filter(e => e.hp < 50);
        if (damaged.length > 0) {
          return this.findNearestEnemy(fleet, damaged);
        }
        return null;

      case 'ISOLATED':
        // Find enemy far from allies
        for (const enemy of enemies) {
          const allyDist = this.findNearestAllyDistance(enemy, enemies);
          if (allyDist > 200) return enemy;
        }
        return null;

      case 'FLAGSHIP':
        // For now, just return strongest (flagship logic can be expanded)
        return enemies.reduce((strong, e) => e.currentShips > strong.currentShips ? e : strong, enemies[0]);

      default:
        return null;
    }
  }

  /**
   * Find nearest enemy
   */
  private findNearestEnemy(fleet: BattleFleetState, enemies: BattleFleetState[]): BattleFleetState | null {
    if (enemies.length === 0) return null;

    let nearest = enemies[0];
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const dist = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        enemy.physics.combat.position
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * Find nearest ally distance for a fleet
   */
  private findNearestAllyDistance(fleet: BattleFleetState, allFleets: BattleFleetState[]): number {
    let minDist = Infinity;

    for (const other of allFleets) {
      if (other.fleetId === fleet.fleetId) continue;
      if (other.factionId !== fleet.factionId) continue;

      const dist = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        other.physics.combat.position
      );
      if (dist < minDist) minDist = dist;
    }

    return minDist;
  }

  /**
   * Decide action based on strategy
   */
  private decideActionByStrategy(
    fleet: BattleFleetState,
    aiState: AIFleetState,
    profile: IAIBattleProfile,
    assessment: ISituationAssessment,
    target: BattleFleetState | null
  ): AIActionDecision | null {
    const strategy = profile.preferredStrategy;

    // No target - hold position or move toward center
    if (!target) {
      return {
        type: 'STOP',
        priority: 10,
        data: {},
        reason: 'No valid targets'
      };
    }

    const distance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      target.physics.combat.position
    );

    switch (strategy) {
      case 'AGGRESSIVE':
        return this.aggressiveAction(fleet, target, distance, profile);

      case 'DEFENSIVE':
        return this.defensiveAction(fleet, target, distance, profile, assessment);

      case 'CAUTIOUS':
        return this.cautiousAction(fleet, target, distance, profile, assessment);

      case 'FLANKING':
        return this.flankingAction(fleet, target, distance, profile);

      case 'FOCUS_FIRE':
        // Focus on weakest enemy
        const weakest = this.engine.getAllFleetStates()
          .filter(f => f.factionId !== fleet.factionId && !f.isDefeated)
          .reduce((weak, e) => e.hp < weak.hp ? e : weak, target);
        return {
          type: 'ATTACK',
          priority: 55,
          data: { targetFleetId: weakest.fleetId },
          reason: 'Focus fire on weakest'
        };

      case 'KITING':
        return this.kitingAction(fleet, target, distance, profile);

      default:
        return this.aggressiveAction(fleet, target, distance, profile);
    }
  }

  /**
   * Aggressive strategy action
   */
  private aggressiveAction(
    fleet: BattleFleetState,
    target: BattleFleetState,
    distance: number,
    profile: IAIBattleProfile
  ): AIActionDecision {
    return {
      type: 'ATTACK',
      priority: 50 + Math.round(profile.aggressiveness / 10),
      data: { targetFleetId: target.fleetId },
      reason: 'Aggressive attack'
    };
  }

  /**
   * Defensive strategy action
   */
  private defensiveAction(
    fleet: BattleFleetState,
    target: BattleFleetState,
    distance: number,
    profile: IAIBattleProfile,
    assessment: ISituationAssessment
  ): AIActionDecision {
    const engageRange = fleet.weaponRange * 1.2;

    if (distance <= engageRange) {
      return {
        type: 'ATTACK',
        priority: 40,
        data: { targetFleetId: target.fleetId },
        reason: 'Enemy in range, engage'
      };
    }

    return {
      type: 'STOP',
      priority: 30,
      data: {},
      reason: 'Hold defensive position'
    };
  }

  /**
   * Cautious strategy action
   */
  private cautiousAction(
    fleet: BattleFleetState,
    target: BattleFleetState,
    distance: number,
    profile: IAIBattleProfile,
    assessment: ISituationAssessment
  ): AIActionDecision {
    const optimalRange = fleet.weaponRange * 0.9;

    // If damaged, maintain distance
    if (assessment.hpPercent < 70 && distance < optimalRange) {
      const awayDir = Vector3.normalize(
        Vector3.subtract(fleet.physics.combat.position, target.physics.combat.position)
      );
      const retreatPos = Vector3.add(
        fleet.physics.combat.position,
        Vector3.multiply(awayDir, 100)
      );

      return {
        type: 'MOVE',
        priority: 60,
        data: { targetPosition: retreatPos },
        reason: 'Maintain safe distance'
      };
    }

    return {
      type: 'ATTACK',
      priority: 40,
      data: { targetFleetId: target.fleetId },
      reason: 'Cautious attack at range'
    };
  }

  /**
   * Flanking strategy action
   */
  private flankingAction(
    fleet: BattleFleetState,
    target: BattleFleetState,
    distance: number,
    profile: IAIBattleProfile
  ): AIActionDecision {
    // Calculate flanking position
    const targetHeading = target.physics.combat.heading;
    const flankAngle = targetHeading + 90 + (Math.random() > 0.5 ? 0 : 180);
    const flankDir = Vector3.fromHeading(flankAngle);
    const optimalRange = fleet.weaponRange * 0.7;

    const flankPos = Vector3.add(
      target.physics.combat.position,
      Vector3.multiply(flankDir, optimalRange)
    );

    const flankDistance = FleetPhysicsEngine.calculateDistance(
      fleet.physics.combat.position,
      flankPos
    );

    // In flanking position - attack
    if (flankDistance < 50 && distance < fleet.weaponRange) {
      return {
        type: 'ATTACK',
        priority: 55,
        data: { targetFleetId: target.fleetId },
        reason: 'Flanking attack'
      };
    }

    // Move to flanking position
    return {
      type: 'MOVE',
      priority: 45,
      data: { targetPosition: flankPos },
      reason: 'Move to flank'
    };
  }

  /**
   * Kiting strategy action
   */
  private kitingAction(
    fleet: BattleFleetState,
    target: BattleFleetState,
    distance: number,
    profile: IAIBattleProfile
  ): AIActionDecision {
    const minRange = fleet.weaponRange * 0.6;
    const maxRange = fleet.weaponRange * 0.9;

    // Too close - retreat
    if (distance < minRange) {
      const awayDir = Vector3.normalize(
        Vector3.subtract(fleet.physics.combat.position, target.physics.combat.position)
      );
      const retreatPos = Vector3.add(
        fleet.physics.combat.position,
        Vector3.multiply(awayDir, maxRange)
      );

      return {
        type: 'MOVE',
        priority: 60,
        data: { targetPosition: retreatPos },
        reason: 'Kiting - create distance'
      };
    }

    // In optimal range - attack
    if (distance <= maxRange) {
      return {
        type: 'ATTACK',
        priority: 50,
        data: { targetFleetId: target.fleetId },
        reason: 'Kiting attack'
      };
    }

    // Too far - approach
    return {
      type: 'MOVE',
      priority: 40,
      data: { targetPosition: target.physics.combat.position },
      reason: 'Kiting - close distance'
    };
  }

  /**
   * Execute a decision
   */
  private executeDecision(fleetId: string, decision: AIActionDecision): void {
    this.engine.queueCommand(fleetId, decision.type, decision.data);
  }

  /**
   * Get AI state for a fleet
   */
  getAIState(fleetId: string): AIFleetState | undefined {
    return this.aiFleetStates.get(fleetId);
  }

  /**
   * Get all AI controlled fleet IDs
   */
  getAIControlledFleets(): string[] {
    return Array.from(this.aiFleetStates.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    aiFleetCount: number;
    ticksProcessed: number;
    decisionsIssued: number;
    averageDecisionsPerTick: number;
  } {
    return {
      aiFleetCount: this.aiFleetStates.size,
      ticksProcessed: this.ticksProcessed,
      decisionsIssued: this.decisionsIssued,
      averageDecisionsPerTick: this.ticksProcessed > 0 
        ? this.decisionsIssued / this.ticksProcessed 
        : 0
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.aiFleetStates.clear();
    this.aiService.destroy();
    this.removeAllListeners();
  }
}

export default AIBattleController;
