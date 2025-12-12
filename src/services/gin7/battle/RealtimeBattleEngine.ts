/**
 * RealtimeBattleEngine
 * 
 * Tick-based realtime battle engine for fleet combat
 * Runs at 10 ticks/second (100ms per tick)
 */

import { EventEmitter } from 'events';
import { IRealtimeBattle, RealtimeBattle, IBattleArea, IBattleParticipant } from '../../../models/gin7/RealtimeBattle';
import { Fleet, IFleet, IVector3, IRealtimeCombatState, SHIP_SPECS, ShipClass } from '../../../models/gin7/Fleet';
import { FleetPhysicsEngine, Vector3, FleetPhysicsState } from '../physics/FleetPhysicsEngine';

// AI integration imports (lazy loaded to avoid circular dependencies)
let AIBattleController: typeof import('./AIBattleController').AIBattleController | null = null;

// Supply and time limit imports (lazy loaded)
let SupplyService: typeof import('../SupplyService').default | null = null;
let BattleTimeLimitService: typeof import('./BattleTimeLimitService').default | null = null;

/**
 * Command types for fleet control
 */
export type CommandType = 'MOVE' | 'ATTACK' | 'FORMATION' | 'RETREAT' | 'STOP' | 'ROTATE';

/**
 * Command interface
 */
export interface BattleCommand {
  id: string;
  fleetId: string;
  type: CommandType;
  data: {
    targetPosition?: IVector3;
    targetFleetId?: string;
    formationType?: string;
    direction?: IVector3;
    heading?: number;
  };
  issuedAt: number;  // tick number
  processed: boolean;
}

/**
 * Fleet state in battle
 */
export interface BattleFleetState {
  fleetId: string;
  factionId: string;
  name: string;
  physics: FleetPhysicsState;
  // Combat data
  currentShips: number;
  maxShips: number;
  hp: number;          // Average HP percentage
  maxHp: number;
  morale: number;
  formation: string;
  // Weapons
  weaponRange: number;
  fireRate: number;     // Ticks between shots
  lastFireTick: number;
  damage: number;
  accuracy: number;
  // Status
  isDefeated: boolean;
  isRetreating: boolean;
  retreatStartTick?: number;
  currentTarget?: string;
  // Stats tracking
  damageDealt: number;
  damageTaken: number;
  shipsLost: number;
}

/**
 * Battle state snapshot
 * Note: ships/maxShips = unit count (1 unit = 300 ships)
 */
export interface BattleStateSnapshot {
  battleId: string;
  tick: number;
  timestamp: number;
  status: 'PREPARING' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  fleets: Array<{
    fleetId: string;
    factionId: string;
    name: string;
    position: IVector3;
    velocity: IVector3;
    heading: number;
    speed: number;
    hp: number;
    maxHp: number;
    ships: number;        // Unit count
    maxShips: number;     // Max unit count
    totalShips?: number;  // Actual ship count (ships * 300)
    maxTotalShips?: number;
    morale: number;
    formation: string;
    isDefeated: boolean;
    isRetreating: boolean;
    currentTarget?: string;
  }>;
  events: BattleEvent[];
}

/**
 * Battle event types
 */
export type BattleEventType = 
  | 'DAMAGE'
  | 'SHIP_DESTROYED'
  | 'FLEET_DESTROYED'
  | 'FORMATION_CHANGED'
  | 'RETREAT_STARTED'
  | 'RETREAT_COMPLETED'
  | 'TARGET_ACQUIRED'
  | 'COLLISION'
  | 'SUPPLY_DEPLETED'   // 보급 고갈 (Phase 3)
  | 'SUPPLY_WARNING'    // 보급 경고 (Phase 3)
  | 'TIME_WARNING';     // 시간 경고 (Phase 3)

/**
 * Battle event
 */
export interface BattleEvent {
  type: BattleEventType;
  tick: number;
  data: Record<string, unknown>;
}

/**
 * Battle engine options
 */
export interface BattleEngineOptions {
  tickRate?: number;           // Ticks per second (default: 10)
  retreatDelay?: number;       // Ticks to complete retreat (default: 50)
  defaultWeaponRange?: number; // Default weapon range (default: 200)
  defaultFireRate?: number;    // Default fire rate in ticks (default: 5)
  enableAI?: boolean;          // Enable AI controller integration (default: true)
  enableSupply?: boolean;      // Enable supply consumption (default: true)
  enableTimeLimit?: boolean;   // Enable time limit checks (default: true)
  maxTicks?: number;           // Maximum battle duration in ticks
}

/**
 * RealtimeBattleEngine class
 */
export class RealtimeBattleEngine extends EventEmitter {
  private battleId: string;
  private battle: IRealtimeBattle | null = null;
  private tickRate: number;
  private tickInterval: number;  // ms between ticks
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  // Battle state
  private fleetStates: Map<string, BattleFleetState> = new Map();
  private commandQueue: BattleCommand[] = [];
  private currentTick: number = 0;
  private events: BattleEvent[] = [];
  private lastSnapshot: BattleStateSnapshot | null = null;
  
  // Options
  private retreatDelay: number;
  private defaultWeaponRange: number;
  private defaultFireRate: number;
  
  // AI Controller integration
  private enableAI: boolean;
  private aiController: InstanceType<typeof import('./AIBattleController').AIBattleController> | null = null;
  private aiInitialized: boolean = false;
  
  // Supply system integration
  private enableSupply: boolean;
  private supplyService: import('../SupplyService').default | null = null;
  private supplyInitialized: boolean = false;
  
  // Time limit integration
  private enableTimeLimit: boolean;
  private timeLimitService: import('./BattleTimeLimitService').default | null = null;
  private timeLimitInitialized: boolean = false;
  private maxTicks: number;
  
  // Session ID for supply/time services
  private sessionId: string = '';
  
  constructor(battleId: string, options: BattleEngineOptions = {}) {
    super();
    this.battleId = battleId;
    this.tickRate = options.tickRate ?? 10;
    this.tickInterval = 1000 / this.tickRate;
    this.retreatDelay = options.retreatDelay ?? 100;  // Increased from 50 to 100 ticks (10s)
    this.defaultWeaponRange = options.defaultWeaponRange ?? 300;  // Increased range for better visibility
    this.defaultFireRate = options.defaultFireRate ?? 10;  // Slowed from 5 to 10 ticks (1s between shots)
    this.enableAI = options.enableAI ?? true;
    this.enableSupply = options.enableSupply ?? true;
    this.enableTimeLimit = options.enableTimeLimit ?? true;
    this.maxTicks = options.maxTicks ?? 36000; // 1시간 기본값
  }

  /**
   * Initialize battle from database
   */
  async initialize(): Promise<boolean> {
    try {
      this.battle = await RealtimeBattle.findOne({ battleId: this.battleId });
      if (!this.battle) {
        console.error(`Battle ${this.battleId} not found`);
        return false;
      }
      
      // Store session ID for supply/time services
      this.sessionId = this.battle.sessionId;
      
      // Set max ticks from battle or default
      if (this.battle.maxTicks) {
        this.maxTicks = this.battle.maxTicks;
      }
      
      // Load all participating fleets
      for (const participant of this.battle.participants) {
        const fleet = await Fleet.findOne({ fleetId: participant.fleetId });
        if (fleet) {
          await this.addFleetToEngine(fleet, participant);
        }
      }
      
      this.currentTick = this.battle.tickCount;
      
      // Initialize AI controller if enabled
      if (this.enableAI) {
        await this.initializeAI();
      }
      
      // Initialize supply system if enabled
      if (this.enableSupply) {
        await this.initializeSupply();
      }
      
      // Initialize time limit if enabled
      if (this.enableTimeLimit) {
        await this.initializeTimeLimit();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize battle:', error);
      return false;
    }
  }
  
  /**
   * Initialize AI controller for offline player fleets
   */
  private async initializeAI(): Promise<void> {
    if (this.aiInitialized) return;
    
    try {
      // Lazy load AIBattleController to avoid circular dependencies
      if (!AIBattleController) {
        const module = await import('./AIBattleController');
        AIBattleController = module.AIBattleController;
      }
      
      this.aiController = new AIBattleController(this.battleId, this);
      await this.aiController.initialize();
      this.aiInitialized = true;
      
      // Forward AI events
      this.aiController.on('decision', (event) => {
        this.emit('ai:decision', event);
      });
      
      this.aiController.on('fleet:registered', (event) => {
        this.emit('ai:fleet_registered', event);
      });
      
      this.aiController.on('fleet:unregistered', (event) => {
        this.emit('ai:fleet_unregistered', event);
      });
      
      console.log(`[Battle ${this.battleId}] AI controller initialized with ${this.aiController.getAIControlledFleets().length} AI fleets`);
    } catch (error) {
      console.error('Failed to initialize AI controller:', error);
      this.enableAI = false;
    }
  }
  
  /**
   * Initialize supply system
   */
  private async initializeSupply(): Promise<void> {
    if (this.supplyInitialized) return;
    
    try {
      // Lazy load SupplyService
      if (!SupplyService) {
        const module = await import('../SupplyService');
        SupplyService = module.default;
      }
      
      this.supplyService = SupplyService.getInstance();
      this.supplyInitialized = true;
      
      // Forward supply events
      this.supplyService.on('supply:warning', (event) => {
        if (this.fleetStates.has(event.fleetId)) {
          this.emit('supply:warning', event);
        }
      });
      
      console.log(`[Battle ${this.battleId}] Supply system initialized`);
    } catch (error) {
      console.error('Failed to initialize supply system:', error);
      this.enableSupply = false;
    }
  }
  
  /**
   * Initialize time limit system
   */
  private async initializeTimeLimit(): Promise<void> {
    if (this.timeLimitInitialized) return;
    
    try {
      // Lazy load BattleTimeLimitService
      if (!BattleTimeLimitService) {
        const module = await import('./BattleTimeLimitService');
        BattleTimeLimitService = module.default;
      }
      
      this.timeLimitService = BattleTimeLimitService.getInstance();
      this.timeLimitService.initializeBattle(this.battleId, this.maxTicks);
      this.timeLimitInitialized = true;
      
      // Forward time limit events
      this.timeLimitService.on('battle:warning', (event) => {
        if (event.battleId === this.battleId) {
          this.emit('timelimit:warning', event);
        }
      });
      
      this.timeLimitService.on('battle:force_end', (event) => {
        if (event.battleId === this.battleId) {
          this.stop(event.reason);
        }
      });
      
      console.log(`[Battle ${this.battleId}] Time limit initialized: ${this.maxTicks} ticks (${this.maxTicks / 10}s)`);
    } catch (error) {
      console.error('Failed to initialize time limit:', error);
      this.enableTimeLimit = false;
    }
  }

  /**
   * Add a fleet to the engine
   */
  private async addFleetToEngine(fleet: IFleet, participant: IBattleParticipant): Promise<void> {
    // Calculate fleet stats
    const totalShips = fleet.units.reduce((sum, u) => sum + u.count, 0);
    const avgHp = fleet.units.length > 0
      ? fleet.units.reduce((sum, u) => sum + u.hp * u.count, 0) / totalShips
      : 100;
    const avgMorale = fleet.units.length > 0
      ? fleet.units.reduce((sum, u) => sum + u.morale * u.count, 0) / totalShips
      : 100;
    
    // Calculate combat stats from ship composition
    let totalAttack = 0;
    let totalAccuracy = 0;
    for (const unit of fleet.units) {
      const spec = SHIP_SPECS[unit.shipClass];
      if (spec) {
        totalAttack += spec.attack * unit.count;
        totalAccuracy += spec.accuracy * unit.count;
      }
    }
    const avgDamage = totalShips > 0 ? totalAttack / totalShips : 50;
    const avgAccuracy = totalShips > 0 ? totalAccuracy / totalShips : 70;
    
    // Calculate collision radius based on fleet size
    const collisionRadius = 30 + Math.sqrt(totalShips) * 2;
    
    // Create physics state
    const physics = FleetPhysicsEngine.createDefaultState(
      fleet.fleetId,
      participant.initialPosition,
      {
        heading: this.calculateInitialHeading(participant),
        maxSpeed: this.calculateMaxSpeed(fleet),
        acceleration: 1.5,
        turnRate: 8,
        collisionRadius,
        mass: totalShips * 10
      }
    );
    
    // Create battle fleet state
    const state: BattleFleetState = {
      fleetId: fleet.fleetId,
      factionId: fleet.factionId,
      name: fleet.name,
      physics,
      currentShips: totalShips,
      maxShips: totalShips,
      hp: avgHp,
      maxHp: 100,
      morale: avgMorale,
      formation: String(fleet.formation),
      weaponRange: this.defaultWeaponRange,
      fireRate: this.defaultFireRate,
      lastFireTick: -this.defaultFireRate,
      damage: avgDamage,
      accuracy: avgAccuracy,
      isDefeated: participant.isDefeated,
      isRetreating: false,
      damageDealt: participant.damageDealt,
      damageTaken: participant.damageTaken,
      shipsLost: participant.shipsLost
    };
    
    this.fleetStates.set(fleet.fleetId, state);
  }

  /**
   * Calculate initial heading (face center or enemy)
   */
  private calculateInitialHeading(participant: IBattleParticipant): number {
    // Default: face toward center
    const pos = participant.initialPosition;
    return FleetPhysicsEngine.angleToTarget(pos, { x: 0, y: 0, z: 0 });
  }

  /**
   * Calculate max speed based on fleet composition
   */
  private calculateMaxSpeed(fleet: IFleet): number {
    if (fleet.units.length === 0) return 10;
    
    // Slowest ship determines fleet speed
    let minSpeed = Infinity;
    for (const unit of fleet.units) {
      const spec = SHIP_SPECS[unit.shipClass];
      if (spec && spec.speed < minSpeed) {
        minSpeed = spec.speed;
      }
    }
    
    return minSpeed === Infinity ? 10 : minSpeed * 3;  // Scale for battle
  }

  /**
   * Start the battle loop
   */
  async start(): Promise<boolean> {
    if (this.isRunning) return false;
    if (!this.battle) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    // Check if can start
    if (this.battle!.status !== 'PREPARING' && this.battle!.status !== 'PAUSED') {
      return false;
    }
    
    // Update battle status
    this.battle!.status = 'ACTIVE';
    this.battle!.startedAt = this.battle!.startedAt || new Date();
    await this.battle!.save();
    
    this.isRunning = true;
    this.emit('started', { battleId: this.battleId, tick: this.currentTick });
    
    // Start tick loop (async processTick)
    this.intervalId = setInterval(async () => {
      await this.processTick();
    }, this.tickInterval);
    
    return true;
  }

  /**
   * Stop the battle loop
   */
  async stop(reason: 'VICTORY' | 'RETREAT' | 'TIMEOUT' | 'DRAW' | 'CANCELLED' | 'STALEMATE' | 'SUPPLY_DEPLETION' = 'CANCELLED'): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Determine winner
    const activeFactions = new Map<string, number>();
    for (const [_, state] of this.fleetStates) {
      if (!state.isDefeated && !state.isRetreating) {
        const count = activeFactions.get(state.factionId) || 0;
        activeFactions.set(state.factionId, count + state.currentShips);
      }
    }
    
    let winner: string | undefined;
    let winnerFaction: string | undefined;
    if (activeFactions.size === 1) {
      winner = Array.from(activeFactions.keys())[0];
      const winnerState = Array.from(this.fleetStates.values()).find(s => s.factionId === winner);
      winnerFaction = winnerState?.factionId;
    }
    
    // Update battle in database
    if (this.battle) {
      this.battle.status = 'ENDED';
      this.battle.endedAt = new Date();
      this.battle.tickCount = this.currentTick;
      this.battle.result = {
        winner,
        winnerFaction,
        endReason: reason,
        duration: this.currentTick,
        totalShipsDestroyed: Array.from(this.fleetStates.values()).reduce((sum, s) => sum + s.shipsLost, 0),
        participantResults: Array.from(this.fleetStates.values()).map(s => ({
          fleetId: s.fleetId,
          faction: s.factionId,
          shipsLost: s.shipsLost,
          damageDealt: s.damageDealt,
          damageTaken: s.damageTaken,
          survived: !s.isDefeated
        }))
      };
      await this.battle.save();
    }
    
    this.emit('ended', {
      battleId: this.battleId,
      tick: this.currentTick,
      reason,
      winner
    });
  }

  /**
   * Pause the battle
   */
  async pause(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.battle) {
      this.battle.status = 'PAUSED';
      this.battle.pausedAt = new Date();
      this.battle.tickCount = this.currentTick;
      await this.battle.save();
    }
    
    this.emit('paused', { battleId: this.battleId, tick: this.currentTick });
  }

  /**
   * Resume paused battle
   */
  async resume(): Promise<boolean> {
    if (this.isRunning) return false;
    if (!this.battle || this.battle.status !== 'PAUSED') return false;
    
    return this.start();
  }

  /**
   * Process a single tick
   */
  private async processTick(): Promise<void> {
    this.currentTick++;
    this.events = [];
    
    // 0. Process AI decisions first (generates commands for AI-controlled fleets)
    if (this.aiController && this.enableAI) {
      this.aiController.processTick(this.currentTick);
    }
    
    // 1. Process command queue (both player and AI commands)
    this.processCommands();
    
    // 2. Update physics for all fleets
    this.updatePhysics();
    
    // 3. Process combat (targeting, firing, damage)
    this.processCombat();
    
    // 4. Check for collisions
    this.checkCollisions();
    
    // 5. Update retreating fleets
    this.updateRetreats();
    
    // 6. Process supply consumption (Phase 3)
    if (this.enableSupply && this.supplyService) {
      await this.processSupplyConsumption();
    }
    
    // 7. Check time limits (Phase 3)
    if (this.enableTimeLimit && this.timeLimitService) {
      await this.checkTimeLimits();
    }
    
    // 8. Check victory conditions
    this.checkVictoryConditions();
    
    // 9. Generate snapshot
    const snapshot = this.generateSnapshot();
    this.lastSnapshot = snapshot;
    
    // 10. Emit tick event
    this.emit('tick', snapshot);
    
    // 11. Save to database periodically (every 10 ticks)
    if (this.currentTick % 10 === 0) {
      this.saveState();
    }
  }
  
  /**
   * Process supply consumption for all fleets
   */
  private async processSupplyConsumption(): Promise<void> {
    if (!this.supplyService || !this.sessionId) return;
    
    for (const [fleetId, state] of this.fleetStates) {
      if (state.isDefeated || state.isRetreating) continue;
      
      // 행동 상태 결정
      const isMoving = state.physics.combat.speed > 0.5;
      const isAttacking = state.currentTarget !== undefined;
      
      // 보급 소모 처리
      const result = await this.supplyService.processBattleTick(
        this.sessionId,
        fleetId,
        { isMoving, isAttacking, attackCount: isAttacking ? 1 : 0 }
      );
      
      // 보급 고갈 시 행동 제한
      if (result.depleted.fuel) {
        // 연료 고갈 - 이동 불가 (속도 강제 0)
        state.physics.combat.speed = 0;
        state.physics.combat.velocity = Vector3.zero();
        this.addEvent('SUPPLY_DEPLETED', { 
          fleetId, 
          type: 'FUEL',
          message: '연료 고갈로 이동 불가'
        });
      }
      
      if (result.depleted.ammo) {
        // 탄약 고갈 - 공격 불가 (타겟 해제)
        state.currentTarget = undefined;
        this.addEvent('SUPPLY_DEPLETED', { 
          fleetId, 
          type: 'AMMO',
          message: '탄약 고갈로 공격 불가'
        });
      }
    }
  }
  
  /**
   * Check time limits and end conditions
   */
  private async checkTimeLimits(): Promise<void> {
    if (!this.timeLimitService || !this.sessionId) return;
    
    const fleetIds = Array.from(this.fleetStates.keys());
    
    // 종합 체크
    const result = await this.timeLimitService.checkAllLimits(
      this.battleId,
      this.sessionId,
      this.currentTick,
      fleetIds
    );
    
    if (result.shouldEnd && result.reason) {
      // 전투 종료
      await this.stop(result.reason as any);
    }
  }

  /**
   * Process queued commands
   */
  private processCommands(): void {
    const pendingCommands = this.commandQueue.filter(c => !c.processed);
    
    for (const command of pendingCommands) {
      const fleet = this.fleetStates.get(command.fleetId);
      if (!fleet || fleet.isDefeated) {
        command.processed = true;
        continue;
      }
      
      switch (command.type) {
        case 'MOVE':
          if (command.data.targetPosition) {
            fleet.currentTarget = undefined;  // Clear attack target
            // Physics will handle movement in updatePhysics
            fleet.physics.combat.targetHeading = FleetPhysicsEngine.angleToTarget(
              fleet.physics.combat.position,
              command.data.targetPosition
            );
          }
          break;
          
        case 'ATTACK':
          if (command.data.targetFleetId) {
            fleet.currentTarget = command.data.targetFleetId;
            this.addEvent('TARGET_ACQUIRED', {
              fleetId: fleet.fleetId,
              targetId: command.data.targetFleetId
            });
          }
          break;
          
        case 'FORMATION':
          if (command.data.formationType) {
            fleet.formation = command.data.formationType;
            this.addEvent('FORMATION_CHANGED', {
              fleetId: fleet.fleetId,
              formation: command.data.formationType
            });
          }
          break;
          
        case 'RETREAT':
          if (!fleet.isRetreating) {
            fleet.isRetreating = true;
            fleet.retreatStartTick = this.currentTick;
            this.addEvent('RETREAT_STARTED', { fleetId: fleet.fleetId });
          }
          break;
          
        case 'STOP':
          fleet.physics.combat.velocity = Vector3.zero();
          fleet.physics.combat.speed = 0;
          fleet.currentTarget = undefined;
          break;
          
        case 'ROTATE':
          if (command.data.heading !== undefined) {
            fleet.physics.combat.targetHeading = command.data.heading;
          }
          break;
      }
      
      command.processed = true;
    }
    
    // Clean up old processed commands
    this.commandQueue = this.commandQueue.filter(c => !c.processed || this.currentTick - c.issuedAt < 100);
  }

  /**
   * Update physics for all fleets
   */
  private updatePhysics(): void {
    for (const [_, fleet] of this.fleetStates) {
      if (fleet.isDefeated) continue;
      
      // If has attack target, move toward it
      if (fleet.currentTarget) {
        const target = this.fleetStates.get(fleet.currentTarget);
        if (target && !target.isDefeated) {
          const distance = FleetPhysicsEngine.calculateDistance(
            fleet.physics.combat.position,
            target.physics.combat.position
          );
          
          // Move toward target if out of range
          if (distance > fleet.weaponRange * 0.8) {
            FleetPhysicsEngine.moveToward(
              fleet.physics,
              target.physics.combat.position,
              1
            );
          } else {
            // In range: stop and face target
            FleetPhysicsEngine.applyDrag(fleet.physics, 0.9);
            const targetHeading = FleetPhysicsEngine.angleToTarget(
              fleet.physics.combat.position,
              target.physics.combat.position
            );
            FleetPhysicsEngine.updateHeading(fleet.physics, targetHeading, 1);
          }
        } else {
          fleet.currentTarget = undefined;
        }
      } else if (fleet.physics.combat.targetHeading !== undefined) {
        // Rotate toward target heading
        FleetPhysicsEngine.updateHeading(
          fleet.physics,
          fleet.physics.combat.targetHeading,
          1
        );
      }
      
      // Apply drag if no active movement
      if (fleet.physics.combat.speed > 0 && !fleet.currentTarget) {
        FleetPhysicsEngine.applyDrag(fleet.physics, 0.98);
      }
      
      // Update position
      FleetPhysicsEngine.updatePosition(fleet.physics, 1);
      
      // Clamp to battle area
      if (this.battle) {
        fleet.physics.combat.position = FleetPhysicsEngine.clampToBattleArea(
          fleet.physics.combat.position,
          this.battle.battleArea
        );
      }
    }
  }

  /**
   * Process combat (targeting, firing, damage)
   */
  private processCombat(): void {
    for (const [_, attacker] of this.fleetStates) {
      if (attacker.isDefeated || attacker.isRetreating) continue;
      
      // Check if can fire
      if (this.currentTick - attacker.lastFireTick < attacker.fireRate) continue;
      
      // Find target
      let target = attacker.currentTarget ? this.fleetStates.get(attacker.currentTarget) : undefined;
      if (!target || target.isDefeated) {
        target = this.findNearestEnemy(attacker);
        if (target) {
          attacker.currentTarget = target.fleetId;
        }
      }
      
      if (!target) continue;
      
      // Check range
      const distance = FleetPhysicsEngine.calculateDistance(
        attacker.physics.combat.position,
        target.physics.combat.position
      );
      
      if (distance > attacker.weaponRange) continue;
      
      // Fire!
      attacker.lastFireTick = this.currentTick;
      
      // Calculate hit chance based on distance and accuracy
      const distanceModifier = 1 - (distance / attacker.weaponRange) * 0.3;
      const hitChance = (attacker.accuracy / 100) * distanceModifier;
      
      // Calculate damage - REDUCED for longer battles
      // Scale damage with sqrt of ships to prevent instant annihilation
      const shipScaling = Math.sqrt(attacker.currentShips);
      const baseDamage = attacker.damage * shipScaling * 0.02;  // Reduced from 0.1 to 0.02
      const actualDamage = Math.random() < hitChance ? baseDamage : baseDamage * 0.3;  // Glancing hit
      
      this.applyDamage(target, actualDamage, attacker);
    }
  }

  /**
   * Apply damage to a fleet
   * Note: 1 unit = 300 ships. currentShips tracks UNITS, not individual ships.
   */
  private applyDamage(target: BattleFleetState, damage: number, attacker: BattleFleetState): void {
    // Apply damage to HP (average HP percentage across all ships)
    const hpDamage = damage / (target.currentShips * 300);  // Spread across 300 ships per unit
    target.hp = Math.max(0, target.hp - hpDamage);
    target.damageTaken += damage;
    attacker.damageDealt += damage;
    
    // Record damage for stalemate detection (Phase 3)
    if (this.timeLimitService && this.enableTimeLimit) {
      this.timeLimitService.recordDamage(
        this.battleId, 
        this.currentTick, 
        attacker.factionId, 
        damage
      );
    }
    
    // Calculate unit losses (1 unit = 300 ships)
    // 500 damage = 1 unit destroyed (roughly 1.67 damage per ship)
    const unitsDestroyed = Math.floor(damage / 500);
    if (unitsDestroyed > 0 && target.currentShips > 0) {
      const actualLoss = Math.min(unitsDestroyed, target.currentShips);
      target.currentShips -= actualLoss;
      target.shipsLost += actualLoss;
      
      // Update collision radius based on unit count
      target.physics.collisionRadius = 30 + Math.sqrt(target.currentShips) * 5;
      target.physics.mass = target.currentShips * 300;  // Mass based on actual ship count
      
      this.addEvent('SHIP_DESTROYED', {
        fleetId: target.fleetId,
        count: actualLoss,  // Units lost
        shipsLost: actualLoss * 300,  // Actual ships lost for display
        attackerId: attacker.fleetId
      });
    }
    
    // Morale loss - based on damage relative to fleet size
    const moraleLoss = (damage / (target.currentShips * 300)) * 0.5;
    target.morale = Math.max(0, target.morale - moraleLoss);
    
    // Check if fleet destroyed (all units gone or HP depleted)
    if (target.currentShips <= 0 || target.hp <= 0) {
      target.isDefeated = true;
      target.currentShips = 0;
      this.addEvent('FLEET_DESTROYED', {
        fleetId: target.fleetId,
        destroyedBy: attacker.fleetId
      });
    }
    
    this.addEvent('DAMAGE', {
      targetId: target.fleetId,
      attackerId: attacker.fleetId,
      damage: Math.round(damage),
      targetHp: Math.round(target.hp),
      targetUnits: target.currentShips,
      targetShips: target.currentShips * 300  // For display
    });
  }

  /**
   * Find nearest enemy fleet
   */
  private findNearestEnemy(fleet: BattleFleetState): BattleFleetState | undefined {
    let nearest: BattleFleetState | undefined;
    let nearestDist = Infinity;
    
    for (const [_, other] of this.fleetStates) {
      if (other.fleetId === fleet.fleetId) continue;
      if (other.factionId === fleet.factionId) continue;  // Same faction
      if (other.isDefeated) continue;
      
      const dist = FleetPhysicsEngine.calculateDistance(
        fleet.physics.combat.position,
        other.physics.combat.position
      );
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }
    
    return nearest;
  }

  /**
   * Check for collisions between fleets
   */
  private checkCollisions(): void {
    const fleets = Array.from(this.fleetStates.values()).filter(f => !f.isDefeated);
    
    for (let i = 0; i < fleets.length; i++) {
      for (let j = i + 1; j < fleets.length; j++) {
        const collision = FleetPhysicsEngine.checkCollision(
          fleets[i].physics,
          fleets[j].physics
        );
        
        if (collision.collided) {
          FleetPhysicsEngine.resolveCollision(
            fleets[i].physics,
            fleets[j].physics,
            collision
          );
          
          this.addEvent('COLLISION', {
            fleet1: fleets[i].fleetId,
            fleet2: fleets[j].fleetId
          });
        }
      }
    }
  }

  /**
   * Update retreating fleets
   */
  private updateRetreats(): void {
    for (const [_, fleet] of this.fleetStates) {
      if (!fleet.isRetreating || fleet.isDefeated) continue;
      
      const retreatElapsed = this.currentTick - (fleet.retreatStartTick || 0);
      
      if (retreatElapsed >= this.retreatDelay) {
        fleet.isDefeated = true;  // Mark as out of battle (not destroyed)
        this.addEvent('RETREAT_COMPLETED', { fleetId: fleet.fleetId });
      } else {
        // Move away from center
        const awayFromCenter = Vector3.normalize(
          Vector3.subtract(fleet.physics.combat.position, { x: 0, y: 0, z: 0 })
        );
        const direction = Vector3.add(fleet.physics.combat.position, Vector3.multiply(awayFromCenter, 100));
        FleetPhysicsEngine.moveToward(fleet.physics, direction, 1);
      }
    }
  }

  /**
   * Check victory conditions
   */
  private checkVictoryConditions(): void {
    const activeFactions = new Set<string>();
    
    for (const [_, fleet] of this.fleetStates) {
      if (!fleet.isDefeated && !fleet.isRetreating) {
        activeFactions.add(fleet.factionId);
      }
    }
    
    // Victory: only one faction remains
    if (activeFactions.size <= 1) {
      const reason = activeFactions.size === 0 ? 'DRAW' : 'VICTORY';
      this.stop(reason);
    }
    
    // Timeout check
    if (this.battle?.maxTicks && this.currentTick >= this.battle.maxTicks) {
      this.stop('TIMEOUT');
    }
  }

  /**
   * Add an event to the current tick
   */
  private addEvent(type: BattleEventType, data: Record<string, unknown>): void {
    this.events.push({
      type,
      tick: this.currentTick,
      data
    });
  }

  /**
   * Generate state snapshot
   * Note: ships = unit count (1 unit = 300 ships)
   */
  private generateSnapshot(): BattleStateSnapshot {
    return {
      battleId: this.battleId,
      tick: this.currentTick,
      timestamp: Date.now(),
      status: this.battle?.status || 'ACTIVE',
      fleets: Array.from(this.fleetStates.values()).map(f => ({
        fleetId: f.fleetId,
        factionId: f.factionId,
        name: f.name,
        position: Vector3.round(f.physics.combat.position, 2),
        velocity: Vector3.round(f.physics.combat.velocity, 2),
        heading: Math.round(f.physics.combat.heading * 100) / 100,
        speed: Math.round(f.physics.combat.speed * 100) / 100,
        hp: Math.round(f.hp),
        maxHp: f.maxHp,
        ships: f.currentShips,  // Unit count (1 unit = 300 ships)
        maxShips: f.maxShips,
        totalShips: f.currentShips * 300,  // Actual ship count for display
        maxTotalShips: f.maxShips * 300,
        morale: Math.round(f.morale),
        formation: f.formation,
        isDefeated: f.isDefeated,
        isRetreating: f.isRetreating,
        currentTarget: f.currentTarget
      })),
      events: this.events
    };
  }

  /**
   * Save current state to database
   */
  private async saveState(): Promise<void> {
    if (!this.battle) return;
    
    try {
      this.battle.tickCount = this.currentTick;
      
      // Update participant stats
      for (const participant of this.battle.participants) {
        const state = this.fleetStates.get(participant.fleetId);
        if (state) {
          participant.isDefeated = state.isDefeated;
          participant.shipsLost = state.shipsLost;
          participant.damageDealt = state.damageDealt;
          participant.damageTaken = state.damageTaken;
        }
      }
      
      await this.battle.save();
    } catch (error) {
      console.error('Failed to save battle state:', error);
    }
  }

  /**
   * Queue a command
   */
  queueCommand(fleetId: string, type: CommandType, data: BattleCommand['data'] = {}): string {
    const id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.commandQueue.push({
      id,
      fleetId,
      type,
      data,
      issuedAt: this.currentTick,
      processed: false
    });
    
    return id;
  }

  /**
   * Get current state
   */
  getState(): BattleStateSnapshot | null {
    if (!this.lastSnapshot) {
      return this.generateSnapshot();
    }
    return this.lastSnapshot;
  }

  /**
   * Get fleet state
   */
  getFleetState(fleetId: string): BattleFleetState | undefined {
    return this.fleetStates.get(fleetId);
  }

  /**
   * Get all fleet states
   */
  getAllFleetStates(): BattleFleetState[] {
    return Array.from(this.fleetStates.values());
  }

  /**
   * Get current tick
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get battle ID
   */
  getBattleId(): string {
    return this.battleId;
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Cleanup AI controller
    if (this.aiController) {
      this.aiController.destroy();
      this.aiController = null;
    }
    
    // Cleanup supply service cache for this battle's fleets
    if (this.supplyService && this.sessionId) {
      const fleetIds = Array.from(this.fleetStates.keys());
      // Save final supply states to DB
      await this.supplyService.saveBattleSupplyStates(this.sessionId, fleetIds);
      for (const fleetId of fleetIds) {
        this.supplyService.clearCache(fleetId);
      }
    }
    
    // Cleanup time limit data
    if (this.timeLimitService) {
      this.timeLimitService.cleanup(this.battleId);
    }
    
    this.isRunning = false;
    this.aiInitialized = false;
    this.supplyInitialized = false;
    this.timeLimitInitialized = false;
    this.fleetStates.clear();
    this.commandQueue = [];
    this.removeAllListeners();
  }
  
  /**
   * Get AI controller (for external access)
   */
  getAIController(): InstanceType<typeof import('./AIBattleController').AIBattleController> | null {
    return this.aiController;
  }
  
  /**
   * Check if a fleet is AI controlled
   */
  isFleetAIControlled(fleetId: string): boolean {
    if (!this.aiController) return false;
    return this.aiController.getAIControlledFleets().includes(fleetId);
  }
  
  /**
   * Get AI statistics
   */
  getAIStats(): { aiFleetCount: number; ticksProcessed: number; decisionsIssued: number; averageDecisionsPerTick: number } | null {
    if (!this.aiController) return null;
    return this.aiController.getStats();
  }
}

export default RealtimeBattleEngine;
