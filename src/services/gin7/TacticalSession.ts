/**
 * TacticalSession - RTS 전투 세션 관리 클래스
 * 
 * 틱 기반 물리 루프와 상태 동기화를 담당합니다.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  UnitState,
  Vector3,
  Quaternion,
  BattleStatus,
  BattleParticipant,
  BattleResult,
  TacticalCommand,
  TacticalCommandType,
  BattleUpdateEvent,
  ProjectileState,
  EffectState,
  TACTICAL_CONSTANTS,
  EnergyDistribution,
  DEFAULT_ENERGY_DISTRIBUTION,
  calculateDamage,
  calculateHitChance,
  CasualtyReport,
  AdvancedFormationType,
  ChangeFormationCommandData,
  ParallelMoveCommandData,
  ShipComponent,
  DEFAULT_COMPONENTS,
  DEFAULT_CARRIER_COMPONENTS,
  EXPLOSION_RADIUS,
  EXPLOSION_DAMAGE,
  RepairType,
  RepairTask,
  CommanderBonus,
  DEFAULT_COMMANDER_BONUS,
  calculateCommanderBonus,
} from '../../types/gin7/tactical.types';
import { Gin7Character } from '../../models/gin7/Character';
import { ShipClass, SHIP_SPECS, IFleet } from '../../models/gin7/Fleet';
import { DamageControlSystem, ExtendedUnitState } from './DamageControlSystem';
import { 
  fleetFormationService, 
  FleetFormationService,
} from './FleetFormationService';
import {
  FormationType as AdvFormationType,
  FORMATION_MODIFIERS,
} from '../../types/gin7/formation.types';
import { logger } from '../../common/logger';

// ============================================================
// TacticalSession Class
// ============================================================

export class TacticalSession extends EventEmitter {
  // Identification
  readonly battleId: string;
  readonly sessionId: string;
  readonly gridId: string;
  
  // State
  private status: BattleStatus = 'WAITING';
  private tick: number = 0;
  private startTime: Date | null = null;
  private endTime: Date | null = null;
  
  // Participants
  private participants: Map<string, BattleParticipant> = new Map();
  
  // Game State
  private units: Map<string, UnitState> = new Map();
  private projectiles: Map<string, ProjectileState> = new Map();
  private effects: Map<string, EffectState> = new Map();
  
  // Command Queue (processed each tick)
  private commandQueue: TacticalCommand[] = [];
  
  // Physics Loop
  private loopTimer: NodeJS.Timeout | null = null;
  private lastTickTime: number = 0;
  
  // Results
  private result: BattleResult | null = null;
  
  // Damage Control System (부위별 데미지, 수리, 유폭)
  private damageControl: DamageControlSystem;
  
  constructor(sessionId: string, gridId: string) {
    super();
    this.battleId = `BTL-${uuidv4().slice(0, 8)}`;
    this.sessionId = sessionId;
    this.gridId = gridId;
    
    // DamageControlSystem 초기화
    this.damageControl = new DamageControlSystem();
    this.setupDamageControlEvents();
    
    logger.info('[TacticalSession] Created', {
      battleId: this.battleId,
      sessionId,
      gridId,
    });
  }
  
  /**
   * DamageControlSystem 이벤트 핸들러 설정
   */
  private setupDamageControlEvents(): void {
    // 부위 파괴 이벤트
    this.damageControl.on('COMPONENT_DESTROYED', (data) => {
      this.emit('COMPONENT_DESTROYED', {
        battleId: this.battleId,
        ...data,
      });
    });
    
    // 유폭 이벤트
    this.damageControl.on('CHAIN_EXPLOSION', (data) => {
      this.addEffect({
        type: 'CHAIN_EXPLOSION',
        position: data.position,
        scale: data.damage / 100,
      });
      this.emit('CHAIN_EXPLOSION', data);
    });
    
    // 수리 이벤트
    this.damageControl.on('REPAIR_STARTED', (data) => {
      this.emit('REPAIR_STARTED', {
        battleId: this.battleId,
        ...data,
      });
    });
    
    this.damageControl.on('REPAIR_COMPLETED', (data) => {
      this.emit('REPAIR_COMPLETED', {
        battleId: this.battleId,
        ...data,
      });
    });
    
    // 디버프 적용 이벤트
    this.damageControl.on('DEBUFF_APPLIED', (data) => {
      this.emit('DEBUFF_APPLIED', {
        battleId: this.battleId,
        ...data,
      });
    });
  }
  
  // ============================================================
  // Public Getters
  // ============================================================
  
  getBattleId(): string {
    return this.battleId;
  }
  
  getStatus(): BattleStatus {
    return this.status;
  }
  
  getTick(): number {
    return this.tick;
  }
  
  getStartTime(): Date | null {
    return this.startTime;
  }
  
  getUnits(): UnitState[] {
    return Array.from(this.units.values());
  }
  
  getUnit(unitId: string): UnitState | undefined {
    return this.units.get(unitId);
  }
  
  getParticipants(): BattleParticipant[] {
    return Array.from(this.participants.values());
  }
  
  getResult(): BattleResult | null {
    return this.result;
  }
  
  // ============================================================
  // Participant Management
  // ============================================================
  
  addParticipant(factionId: string, fleetIds: string[], commanderIds: string[]): void {
    if (this.status !== 'WAITING') {
      throw new Error('Cannot add participants after battle started');
    }
    
    this.participants.set(factionId, {
      factionId,
      fleetIds,
      commanderIds,
      ready: false,
      retreated: false,
      surrendered: false,
    });
    
    logger.debug('[TacticalSession] Participant added', {
      battleId: this.battleId,
      factionId,
      fleetIds,
    });
  }
  
  setParticipantReady(factionId: string, ready: boolean): void {
    const participant = this.participants.get(factionId);
    if (participant) {
      participant.ready = ready;
      
      // Check if all participants are ready
      const allReady = Array.from(this.participants.values()).every(p => p.ready);
      if (allReady && this.participants.size >= 2) {
        this.startCountdown();
      }
    }
  }
  
  // ============================================================
  // Unit Management
  // ============================================================
  
  /**
   * Add units from a fleet to the battle
   * @param fleet 함대 정보
   * @param spawnPosition 스폰 위치
   * @param commanderBonus 제독 보너스 (선택, 없으면 기본값 사용)
   */
  addFleetUnits(fleet: IFleet, spawnPosition: Vector3, commanderBonus?: CommanderBonus): void {
    const unitIds: string[] = [];
    let leaderUnitId: string | undefined;
    
    // 제독 보너스가 없으면 기본값 사용 (L004 버그 수정)
    const bonus = commanderBonus ?? DEFAULT_COMMANDER_BONUS;
    
    for (const shipUnit of fleet.units) {
      const unitId = `${this.battleId}-${shipUnit.unitId}`;
      
      // 제독의 매력(charm) 기반 사기 보너스 적용
      const adjustedMorale = Math.max(0, Math.min(100, shipUnit.morale + bonus.moraleBonus));
      
      const unit: UnitState = {
        id: unitId,
        position: { ...spawnPosition },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        
        hp: Math.floor(SHIP_SPECS[shipUnit.shipClass].maxHp * (shipUnit.hp / 100)),
        maxHp: SHIP_SPECS[shipUnit.shipClass].maxHp,
        shieldFront: 100,
        shieldRear: 100,
        shieldLeft: 100,
        shieldRight: 100,
        maxShield: 100,
        
        armor: SHIP_SPECS[shipUnit.shipClass].defense,
        morale: adjustedMorale,
        
        fuel: shipUnit.fuel,
        maxFuel: shipUnit.maxFuel,
        ammo: shipUnit.ammo,
        maxAmmo: shipUnit.maxAmmo,
        
        shipClass: shipUnit.shipClass,
        shipCount: shipUnit.count,
        
        factionId: fleet.factionId,
        commanderId: fleet.commanderId,
        fleetId: fleet.fleetId,
        
        isDestroyed: false,
        isChaos: false,
        
        energyDistribution: { ...DEFAULT_ENERGY_DISTRIBUTION },
        
        // 제독 보너스 저장 (L004 버그 수정)
        commanderBonus: bonus,
      };
      
      this.units.set(unitId, unit);
      unitIds.push(unitId);
      
      // DamageControlSystem에 유닛 등록 (부위별 HP 초기화)
      this.damageControl.initializeUnit(unit);
      
      // 기함(flagship)을 리더로 설정
      if (shipUnit.shipClass === 'flagship' && !leaderUnitId) {
        leaderUnitId = unitId;
      }
      
      // Offset spawn position for next unit
      spawnPosition.x += 50;
      if (spawnPosition.x > 500) {
        spawnPosition.x = 0;
        spawnPosition.z += 50;
      }
    }
    
    // 리더가 없으면 첫 번째 유닛을 리더로
    if (!leaderUnitId && unitIds.length > 0) {
      leaderUnitId = unitIds[0];
    }
    
    // 진형 상태 초기화
    if (leaderUnitId) {
      const initialFormation = this.mapFleetFormationToAdvanced(fleet.formation);
      fleetFormationService.initializeFormation(
        fleet.fleetId,
        leaderUnitId,
        unitIds,
        initialFormation
      );
    }
    
    logger.debug('[TacticalSession] Fleet units added', {
      battleId: this.battleId,
      fleetId: fleet.fleetId,
      unitCount: fleet.units.length,
      leaderUnitId,
    });
  }
  
  /**
   * Fleet 모델의 formation을 AdvancedFormationType으로 매핑
   */
  private mapFleetFormationToAdvanced(formation: string): AdvFormationType {
    const mapping: Record<string, AdvFormationType> = {
      'standard': 'STANDARD',
      'offensive': 'SPINDLE',
      'defensive': 'CIRCULAR',
      'wedge': 'WEDGE',
      'encircle': 'ENCIRCLE',
      'guerrilla': 'ECHELON',
    };
    return mapping[formation] || 'STANDARD';
  }
  
  // ============================================================
  // Command Processing
  // ============================================================
  
  /**
   * Queue a command for processing in the next tick
   * Server is authoritative - client coordinates are ignored
   */
  queueCommand(
    factionId: string,
    commanderId: string,
    command: TacticalCommand
  ): boolean {
    // Validate command ownership
    const validUnits = command.unitIds.filter(unitId => {
      const unit = this.units.get(unitId);
      return unit && unit.factionId === factionId && !unit.isDestroyed;
    });
    
    if (validUnits.length === 0) {
      return false;
    }
    
    // Add timestamp for ordering
    command.timestamp = Date.now();
    command.unitIds = validUnits;
    
    this.commandQueue.push(command);
    return true;
  }
  
  private processCommands(): void {
    // Sort by timestamp
    this.commandQueue.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const command of this.commandQueue) {
      this.executeCommand(command);
    }
    
    this.commandQueue = [];
  }
  
  private executeCommand(command: TacticalCommand): void {
    for (const unitId of command.unitIds) {
      const unit = this.units.get(unitId);
      if (!unit || unit.isDestroyed) continue;
      
      // 함교 파괴 시 명령 수신 불가 체크 (SURRENDER, ENERGY_DISTRIBUTION 제외)
      const commandsAllowedWhenUncontrollable: TacticalCommandType[] = ['SURRENDER', 'ENERGY_DISTRIBUTION'];
      if (!this.damageControl.canReceiveOrders(unitId) && 
          !commandsAllowedWhenUncontrollable.includes(command.type)) {
        logger.debug('[TacticalSession] Command rejected - unit uncontrollable', {
          battleId: this.battleId,
          unitId,
          commandType: command.type,
        });
        continue;
      }
      
      switch (command.type) {
        case 'MOVE':
          if ('targetPosition' in command.data) {
            unit.targetPosition = command.data.targetPosition;
            unit.targetId = undefined;
          }
          break;
          
        case 'ATTACK':
          if ('targetId' in command.data) {
            unit.targetId = command.data.targetId;
          }
          break;
          
        case 'STOP':
          unit.targetPosition = undefined;
          unit.targetId = undefined;
          unit.velocity = { x: 0, y: 0, z: 0 };
          break;
          
        case 'ENERGY_DISTRIBUTION':
          if ('distribution' in command.data) {
            const dist = command.data.distribution;
            const total = dist.beam + dist.gun + dist.shield + dist.engine + dist.warp + dist.sensor;
            if (Math.abs(total - 100) < 0.1) {
              unit.energyDistribution = { ...dist };
            }
          }
          break;
        
        case 'CHANGE_FORMATION':
          // 진형 변경 커맨드 처리
          if ('targetFormation' in command.data) {
            const formationData = command.data as ChangeFormationCommandData;
            const fleetId = unit.fleetId;
            
            fleetFormationService.startFormationChange({
              fleetId,
              targetFormation: formationData.targetFormation as AdvFormationType,
              priority: formationData.priority,
            });
            
            logger.debug('[TacticalSession] Formation change initiated', {
              battleId: this.battleId,
              fleetId,
              targetFormation: formationData.targetFormation,
            });
          }
          break;
        
        case 'PARALLEL_MOVE':
          // 평행 이동 기동
          if ('direction' in command.data) {
            const moveData = command.data as ParallelMoveCommandData;
            
            fleetFormationService.executeManeuver({
              unitIds: [unitId],
              type: 'PARALLEL_MOVE',
              params: {
                direction: moveData.direction,
              },
            });
            
            logger.debug('[TacticalSession] Parallel move initiated', {
              battleId: this.battleId,
              unitId,
            });
          }
          break;
        
        case 'TURN_180':
          // 반전 기동
          fleetFormationService.executeManeuver({
            unitIds: [unitId],
            type: 'TURN_180',
          });
          
          logger.debug('[TacticalSession] Turn 180 initiated', {
            battleId: this.battleId,
            unitId,
          });
          break;
          
        case 'RETREAT':
          // Mark faction as retreating
          const participant = this.participants.get(unit.factionId);
          if (participant) {
            participant.retreated = true;
          }
          break;
          
        case 'SURRENDER':
          const surrenderer = this.participants.get(unit.factionId);
          if (surrenderer) {
            surrenderer.surrendered = true;
          }
          break;
        
        case 'REPAIR' as TacticalCommandType:
          // 수리 커맨드 처리 (공작함만 가능)
          if (unit.shipClass === 'engineering' && 'targetUnitId' in command.data && 'targetComponent' in command.data) {
            const repairData = command.data as { targetUnitId: string; targetComponent: ShipComponent; repairType?: RepairType };
            const result = this.damageControl.startRepair(
              repairData.targetUnitId,
              unitId,
              repairData.targetComponent,
              repairData.repairType || 'FIELD'
            );
            
            if (result.success) {
              // 수리 이펙트 추가
              const targetUnit = this.units.get(repairData.targetUnitId);
              if (targetUnit) {
                this.addEffect({
                  type: 'REPAIR_BEAM',
                  position: targetUnit.position,
                  scale: 1,
                });
              }
            }
            
            logger.debug('[TacticalSession] Repair command processed', {
              battleId: this.battleId,
              repairShipId: unitId,
              targetUnitId: repairData.targetUnitId,
              success: result.success,
              message: result.message,
            });
          }
          break;
      }
    }
  }
  
  // ============================================================
  // Game Loop
  // ============================================================
  
  private startCountdown(): void {
    if (this.status !== 'WAITING') return;
    
    this.status = 'COUNTDOWN';
    this.tick = -TACTICAL_CONSTANTS.COUNTDOWN_TICKS;
    
    logger.info('[TacticalSession] Countdown started', {
      battleId: this.battleId,
      countdownTicks: TACTICAL_CONSTANTS.COUNTDOWN_TICKS,
    });
    
    this.startLoop();
  }
  
  /**
   * Start the physics loop
   */
  private startLoop(): void {
    if (this.loopTimer) return;
    
    this.lastTickTime = Date.now();
    
    this.loopTimer = setInterval(() => {
      this.tickLoop();
    }, TACTICAL_CONSTANTS.TICK_INTERVAL_MS);
  }
  
  /**
   * Stop the physics loop
   */
  private stopLoop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }
  
  /**
   * Main tick loop - runs every 60ms
   */
  private tickLoop(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000; // Convert to seconds
    this.lastTickTime = now;
    
    this.tick++;
    
    // Countdown phase
    if (this.status === 'COUNTDOWN') {
      if (this.tick >= 0) {
        this.status = 'RUNNING';
        this.startTime = new Date();
        this.emit('BATTLE_START', {
          battleId: this.battleId,
          gridId: this.gridId,
          participants: this.getParticipants(),
          mapSize: TACTICAL_CONSTANTS.MAP_SIZE,
          startTime: this.startTime.getTime(),
        });
      }
      return;
    }
    
    if (this.status !== 'RUNNING') return;
    
    // 0. Update DamageControl tick
    this.damageControl.setCurrentTick(this.tick);
    
    // 1. Process queued commands
    this.processCommands();
    
    // 2. Update physics
    this.updatePhysics(deltaTime);
    
    // 3. Process combat
    this.processCombat(deltaTime);
    
    // 4. Update projectiles
    this.updateProjectiles(deltaTime);
    
    // 5. Process repair tasks (수리 작업 처리)
    this.damageControl.processRepairTasks();
    
    // 6. Check victory conditions
    this.checkVictoryConditions();
    
    // 7. Clean up expired effects
    this.cleanupEffects();
    
    // 8. Emit state update
    this.emitUpdate();
    
    // 9. Check timeout
    if (this.tick >= TACTICAL_CONSTANTS.BATTLE_TIMEOUT_TICKS) {
      this.endBattle('TIMEOUT');
    }
  }
  
  // ============================================================
  // Physics Update
  // ============================================================
  
  private updatePhysics(deltaTime: number): void {
    // 진형 변경 상태 업데이트
    this.updateFormationChanges(deltaTime);
    
    // 유닛별 물리 업데이트
    for (const unit of this.units.values()) {
      if (unit.isDestroyed) continue;
      
      // 기동 상태 업데이트 (평행 이동, 반전 등)
      fleetFormationService.updateManeuver(unit.id, unit, deltaTime);
      
      // 기동 중이 아닐 때만 일반 이동 처리
      if (!fleetFormationService.isManeuveringg(unit.id)) {
        // Apply movement towards target
        if (unit.targetPosition) {
          this.moveTowardsTarget(unit, deltaTime);
        }
      }
      
      // 기동 페널티 적용
      const maneuverPenalties = fleetFormationService.getManeuverPenalties(unit.id);
      const speedMod = 1 - maneuverPenalties.speed;
      
      // Apply velocity (with maneuver speed penalty)
      unit.position.x += unit.velocity.x * deltaTime * speedMod;
      unit.position.y += unit.velocity.y * deltaTime * speedMod;
      unit.position.z += unit.velocity.z * deltaTime * speedMod;
      
      // Apply drag
      unit.velocity.x *= (1 - TACTICAL_CONSTANTS.DRAG_COEFFICIENT);
      unit.velocity.y *= (1 - TACTICAL_CONSTANTS.DRAG_COEFFICIENT);
      unit.velocity.z *= (1 - TACTICAL_CONSTANTS.DRAG_COEFFICIENT);
      
      // Clamp to map bounds
      unit.position.x = Math.max(0, Math.min(TACTICAL_CONSTANTS.MAP_SIZE.width, unit.position.x));
      unit.position.y = Math.max(0, Math.min(TACTICAL_CONSTANTS.MAP_SIZE.height, unit.position.y));
      unit.position.z = Math.max(0, Math.min(TACTICAL_CONSTANTS.MAP_SIZE.depth, unit.position.z));
      
      // Shield regeneration
      this.regenerateShields(unit, deltaTime);
      
      // Morale recovery (slow)
      if (unit.morale < 100 && !unit.isChaos) {
        unit.morale = Math.min(100, unit.morale + TACTICAL_CONSTANTS.MORALE_RECOVERY_RATE * deltaTime);
      }
      
      // Fuel consumption (movement)
      if (this.vectorLength(unit.velocity) > 1) {
        const fuelCost = SHIP_SPECS[unit.shipClass].fuelConsumption * deltaTime * 0.01;
        unit.fuel = Math.max(0, unit.fuel - fuelCost);
      }
    }
    
    // 윙맨 대형 유지 업데이트 (Boids)
    this.updateWingmanFormations(deltaTime);
  }
  
  /**
   * 진형 변경 상태 업데이트
   */
  private updateFormationChanges(deltaTime: number): void {
    const processedFleets = new Set<string>();
    
    for (const unit of this.units.values()) {
      if (unit.isDestroyed || processedFleets.has(unit.fleetId)) continue;
      
      fleetFormationService.updateFormationChange(unit.fleetId, deltaTime);
      processedFleets.add(unit.fleetId);
    }
  }
  
  /**
   * 윙맨 대형 유지 업데이트 (Boids 알고리즘)
   */
  private updateWingmanFormations(deltaTime: number): void {
    const processedFleets = new Set<string>();
    
    for (const unit of this.units.values()) {
      if (unit.isDestroyed || processedFleets.has(unit.fleetId)) continue;
      
      fleetFormationService.updateWingmanPositions(this.units, unit.fleetId, deltaTime);
      processedFleets.add(unit.fleetId);
    }
  }
  
  private moveTowardsTarget(unit: UnitState, deltaTime: number): void {
    if (!unit.targetPosition) return;
    
    const dx = unit.targetPosition.x - unit.position.x;
    const dy = unit.targetPosition.y - unit.position.y;
    const dz = unit.targetPosition.z - unit.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < 10) {
      // Arrived at target
      unit.targetPosition = undefined;
      return;
    }
    
    // 진형 속도 보정 가져오기
    const formationMods = fleetFormationService.getFormationModifiers(unit.fleetId);
    const turnRateMod = formationMods.turnRate;
    const speedMod = formationMods.speed;
    
    // Calculate desired velocity (진형 속도 보정 적용)
    const spec = SHIP_SPECS[unit.shipClass];
    const maxSpeed = spec.speed * 10 * (0.5 + unit.energyDistribution.engine / 100 * 0.5) * speedMod;
    
    // Turn rate based on ship size (smaller = faster turn)
    // flagship/battleship/carrier: slow, cruiser/destroyer: medium, frigate/corvette: fast
    const turnRateByClass: Record<ShipClass, number> = {
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
    const baseTurnRate = turnRateByClass[unit.shipClass] ?? 0.5;
    // 진형 선회력 보정 적용
    const turnRate = baseTurnRate * TACTICAL_CONSTANTS.MAX_ANGULAR_VELOCITY * deltaTime * turnRateMod;
    
    // Calculate desired direction
    const desiredDirX = dx / distance;
    const desiredDirY = dy / distance;
    const desiredDirZ = dz / distance;
    
    // Get current facing direction from velocity (or default to +X)
    const currentSpeed = this.vectorLength(unit.velocity);
    let currentDirX = 1, currentDirY = 0, currentDirZ = 0;
    if (currentSpeed > 0.1) {
      currentDirX = unit.velocity.x / currentSpeed;
      currentDirY = unit.velocity.y / currentSpeed;
      currentDirZ = unit.velocity.z / currentSpeed;
    }
    
    // Interpolate direction based on turn rate
    const lerpFactor = Math.min(1, turnRate);
    const newDirX = currentDirX + (desiredDirX - currentDirX) * lerpFactor;
    const newDirY = currentDirY + (desiredDirY - currentDirY) * lerpFactor;
    const newDirZ = currentDirZ + (desiredDirZ - currentDirZ) * lerpFactor;
    
    // Normalize new direction
    const newDirLen = Math.sqrt(newDirX * newDirX + newDirY * newDirY + newDirZ * newDirZ);
    const normDirX = newDirX / newDirLen;
    const normDirY = newDirY / newDirLen;
    const normDirZ = newDirZ / newDirLen;
    
    // Accelerate in the new direction
    const acceleration = maxSpeed * deltaTime * 2;
    unit.velocity.x += normDirX * acceleration;
    unit.velocity.y += normDirY * acceleration;
    unit.velocity.z += normDirZ * acceleration;
    
    // Clamp velocity
    const speed = this.vectorLength(unit.velocity);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      unit.velocity.x *= scale;
      unit.velocity.y *= scale;
      unit.velocity.z *= scale;
    }
    
    // Update rotation to face movement direction
    unit.rotation = this.directionToQuaternion(normDirX, normDirY, normDirZ);
    
    // Store angular velocity for client prediction
    unit.angularVelocity = {
      x: 0,
      y: Math.atan2(normDirZ, normDirX) * turnRate,
      z: 0,
    };
  }
  
  private regenerateShields(unit: UnitState, deltaTime: number): void {
    const regenRate = TACTICAL_CONSTANTS.SHIELD_REGEN_RATE * 
      (unit.energyDistribution.shield / 100) * deltaTime;
    
    unit.shieldFront = Math.min(unit.maxShield, unit.shieldFront + regenRate);
    unit.shieldRear = Math.min(unit.maxShield, unit.shieldRear + regenRate);
    unit.shieldLeft = Math.min(unit.maxShield, unit.shieldLeft + regenRate);
    unit.shieldRight = Math.min(unit.maxShield, unit.shieldRight + regenRate);
  }
  
  // ============================================================
  // Combat Processing
  // ============================================================
  
  private processCombat(deltaTime: number): void {
    for (const unit of this.units.values()) {
      if (unit.isDestroyed || unit.isChaos || !unit.targetId) continue;
      
      const target = this.units.get(unit.targetId);
      if (!target || target.isDestroyed || target.factionId === unit.factionId) {
        unit.targetId = undefined;
        continue;
      }
      
      const distance = this.distanceBetween(unit.position, target.position);
      const spec = SHIP_SPECS[unit.shipClass];
      
      // Check weapon range (simplified)
      const beamRange = 300;
      const gunRange = 200;
      
      // Fire beams
      if (distance <= beamRange && unit.energyDistribution.beam > 0) {
        this.fireWeapon(unit, target, 'BEAM', distance);
      }
      
      // Fire guns
      if (distance <= gunRange && unit.energyDistribution.gun > 0 && unit.ammo > 0) {
        this.fireWeapon(unit, target, 'GUN', distance);
        unit.ammo = Math.max(0, unit.ammo - spec.ammoConsumption * deltaTime);
      }
    }
  }
  
  private fireWeapon(
    attacker: UnitState,
    target: UnitState,
    weaponType: 'BEAM' | 'GUN' | 'MISSILE',
    distance: number
  ): void {
    // 공격자 진형 보정 가져오기
    const attackerFormationMods = fleetFormationService.getFormationModifiers(attacker.fleetId);
    // 방어자 진형 보정 가져오기
    const defenderFormationMods = fleetFormationService.getFormationModifiers(target.fleetId);
    
    // 기동 중 페널티
    const attackerManeuverPenalty = fleetFormationService.getManeuverPenalties(attacker.id);
    const defenderManeuverPenalty = fleetFormationService.getManeuverPenalties(target.id);
    
    // Calculate hit chance (진형 및 기동 보정, 제독 보너스 적용 - L004 버그 수정)
    const energyKey = weaponType === 'BEAM' ? 'beam' : weaponType === 'GUN' ? 'gun' : 'gun';
    let hitChance = calculateHitChance(
      attacker.shipClass,
      target.shipClass,
      distance,
      attacker.energyDistribution.sensor,
      attacker.commanderBonus,  // 공격자 제독 보너스
      target.commanderBonus     // 방어자 제독 보너스
    );
    
    // 진형 보정: 공격자 명중률, 방어자 회피율
    hitChance *= attackerFormationMods.accuracy;
    hitChance /= (defenderFormationMods.evasion * (1 - defenderManeuverPenalty.evasion));
    
    // Roll for hit
    if (Math.random() * 100 > hitChance) {
      return; // Miss
    }
    
    // Calculate damage (진형 공격력 보정, 제독 보너스 적용 - L004 버그 수정)
    let baseDamage = calculateDamage(
      attacker.shipClass,
      weaponType,
      attacker.energyDistribution[energyKey],
      distance,
      attacker.commanderBonus,  // 공격자 제독 보너스
      target.commanderBonus     // 방어자 제독 보너스
    ) * attacker.shipCount;
    
    // 진형 보정: 공격력, 방어력
    baseDamage *= attackerFormationMods.attackPower;
    baseDamage /= defenderFormationMods.defensePower;
    
    // 측면 사격 보너스 (횡열진 등)
    if (weaponType === 'GUN' || weaponType === 'BEAM') {
      baseDamage *= (0.8 + attackerFormationMods.broadside * 0.4);
    }
    
    // Apply damage
    this.applyDamage(attacker, target, baseDamage, weaponType);
    
    // Create visual effect
    this.addEffect({
      type: weaponType === 'BEAM' ? 'BEAM_FIRE' : 'EXPLOSION',
      position: target.position,
      scale: baseDamage / 100,
    });
  }
  
  private applyDamage(
    source: UnitState,
    target: UnitState,
    damage: number,
    damageType: 'BEAM' | 'GUN' | 'MISSILE' | 'COLLISION'
  ): void {
    // Determine which shield faces the attack
    const shieldFacing = this.getShieldFacing(source.position, target);
    let shieldRef: 'shieldFront' | 'shieldRear' | 'shieldLeft' | 'shieldRight' = 'shieldFront';
    
    switch (shieldFacing) {
      case 'FRONT': shieldRef = 'shieldFront'; break;
      case 'REAR': shieldRef = 'shieldRear'; break;
      case 'LEFT': shieldRef = 'shieldLeft'; break;
      case 'RIGHT': shieldRef = 'shieldRight'; break;
    }
    
    let remainingDamage = damage;
    let shieldAbsorbed = 0;
    let armorReduced = 0;
    
    // 1. Shield absorption
    const shieldValue = target[shieldRef];
    if (shieldValue > 0) {
      shieldAbsorbed = Math.min(shieldValue, remainingDamage * 0.8);
      target[shieldRef] = Math.max(0, shieldValue - shieldAbsorbed);
      remainingDamage -= shieldAbsorbed;
    }
    
    // 2. Armor reduction
    if (remainingDamage > 0 && target.armor > 0) {
      armorReduced = Math.min(target.armor * 0.1, remainingDamage * 0.3);
      remainingDamage -= armorReduced;
    }
    
    // 3. Component Damage (부위별 데미지 적용)
    const attackDirection = this.shieldFacingToAttackDirection(shieldFacing);
    const componentResult = this.damageControl.applyComponentDamage(
      target.id,
      remainingDamage,
      attackDirection,
      source.id
    );
    
    // 4. HP damage (부위 데미지와 별개로 총 HP에도 반영)
    const hpDamage = Math.floor(remainingDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    
    // 5. Morale damage
    target.morale = Math.max(0, target.morale - TACTICAL_CONSTANTS.MORALE_DAMAGE_LOSS);
    
    // 6. Check for chaos
    if (target.morale <= TACTICAL_CONSTANTS.CHAOS_THRESHOLD) {
      target.isChaos = true;
    }
    
    // 7. Check for destruction
    const wasDestroyed = target.hp <= 0 || componentResult.unitDestroyed;
    if (wasDestroyed && !target.isDestroyed) {
      target.isDestroyed = true;
      this.emit('UNIT_DESTROYED', {
        battleId: this.battleId,
        unitId: target.id,
        destroyedBy: source.id,
        position: target.position,
        timestamp: Date.now(),
      });
      
      // Apply morale damage to allies
      this.applyAllyDeathMorale(target.factionId);
      
      // 8. Chain Explosion (유폭 처리)
      this.processChainExplosion(target);
    }
    
    // Emit damage event
    this.emit('DAMAGE', {
      battleId: this.battleId,
      sourceId: source.id,
      targetId: target.id,
      damage,
      damageType,
      shieldAbsorbed,
      armorReduced,
      hpDamage,
      position: target.position,
      hitComponent: componentResult.hitComponent,
      componentDestroyed: componentResult.componentDestroyed,
    });
  }
  
  /**
   * 쉴드 방향을 공격 방향으로 변환
   */
  private shieldFacingToAttackDirection(facing: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'): 'FRONT' | 'REAR' | 'SIDE' {
    switch (facing) {
      case 'FRONT': return 'REAR';   // 쉴드 앞면 = 후방에서 공격
      case 'REAR': return 'FRONT';   // 쉴드 뒷면 = 전방에서 공격
      default: return 'SIDE';
    }
  }
  
  /**
   * 유폭 처리
   */
  private processChainExplosion(destroyedUnit: UnitState): void {
    const explosionDamage = EXPLOSION_DAMAGE[destroyedUnit.shipClass] || 50;
    const explosionRadius = EXPLOSION_RADIUS;
    const affectedUnits: string[] = [];
    
    // 주변 유닛에 피해 (아군/적군 구분 없이)
    for (const [unitId, unit] of this.units) {
      if (unitId === destroyedUnit.id || unit.isDestroyed) continue;
      
      const distance = this.distanceBetween(destroyedUnit.position, unit.position);
      if (distance <= explosionRadius) {
        // 거리에 따른 데미지 감소
        const distanceMultiplier = 1 - (distance / explosionRadius);
        const actualDamage = Math.floor(explosionDamage * distanceMultiplier);
        
        // 유폭 데미지 적용 (재귀적 유폭은 방지)
        if (actualDamage > 0) {
          // 직접 HP 감소 (부위 데미지는 별도로 처리됨)
          unit.hp = Math.max(0, unit.hp - actualDamage);
          unit.morale = Math.max(0, unit.morale - TACTICAL_CONSTANTS.MORALE_DAMAGE_LOSS * 2);
          
          // 부위 데미지도 적용
          this.damageControl.applyComponentDamage(unitId, actualDamage, 'SIDE', destroyedUnit.id);
          
          affectedUnits.push(unitId);
          
          // 유폭으로 인한 파괴 확인
          if (unit.hp <= 0 && !unit.isDestroyed) {
            unit.isDestroyed = true;
            this.emit('UNIT_DESTROYED', {
              battleId: this.battleId,
              unitId: unit.id,
              destroyedBy: destroyedUnit.id,
              position: unit.position,
              timestamp: Date.now(),
              cause: 'CHAIN_EXPLOSION',
            });
            this.applyAllyDeathMorale(unit.factionId);
          }
        }
      }
    }
    
    if (affectedUnits.length > 0) {
      // 유폭 이펙트 추가
      this.addEffect({
        type: 'CHAIN_EXPLOSION',
        position: destroyedUnit.position,
        scale: explosionDamage / 100,
      });
      
      this.emit('CHAIN_EXPLOSION', {
        battleId: this.battleId,
        sourceUnitId: destroyedUnit.id,
        position: destroyedUnit.position,
        radius: explosionRadius,
        damage: explosionDamage,
        affectedUnits,
        timestamp: Date.now(),
      });
      
      logger.info('[TacticalSession] Chain explosion processed', {
        battleId: this.battleId,
        sourceId: destroyedUnit.id,
        affectedCount: affectedUnits.length,
      });
    }
  }
  
  private getShieldFacing(
    attackerPos: Vector3,
    target: UnitState
  ): 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' {
    // Simplified facing calculation
    const dx = attackerPos.x - target.position.x;
    const dz = attackerPos.z - target.position.z;
    
    // Get angle
    const angle = Math.atan2(dz, dx);
    
    // Convert to 4 directions (simplified, assumes target faces +X)
    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) {
      return 'FRONT';
    } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) {
      return 'RIGHT';
    } else if (angle > 3 * Math.PI / 4 || angle <= -3 * Math.PI / 4) {
      return 'REAR';
    } else {
      return 'LEFT';
    }
  }
  
  private applyAllyDeathMorale(factionId: string): void {
    for (const unit of this.units.values()) {
      if (unit.factionId === factionId && !unit.isDestroyed) {
        unit.morale = Math.max(0, unit.morale - TACTICAL_CONSTANTS.MORALE_ALLY_DEATH_LOSS);
        if (unit.morale <= TACTICAL_CONSTANTS.CHAOS_THRESHOLD) {
          unit.isChaos = true;
        }
      }
    }
  }
  
  // ============================================================
  // Projectile Update
  // ============================================================
  
  private updateProjectiles(deltaTime: number): void {
    const toRemove: string[] = [];
    
    for (const [id, proj] of this.projectiles) {
      // Update position
      proj.position.x += proj.velocity.x * deltaTime;
      proj.position.y += proj.velocity.y * deltaTime;
      proj.position.z += proj.velocity.z * deltaTime;
      
      // Reduce lifetime
      proj.lifetime -= deltaTime;
      
      if (proj.lifetime <= 0) {
        toRemove.push(id);
        continue;
      }
      
      // Check for collision with target (if missile)
      if (proj.type === 'MISSILE' && proj.targetId) {
        const target = this.units.get(proj.targetId);
        if (target && !target.isDestroyed) {
          const dist = this.distanceBetween(proj.position, target.position);
          if (dist < 20) {
            // Hit!
            const source = this.units.get(proj.sourceId);
            if (source) {
              this.applyDamage(source, target, proj.damage, 'MISSILE');
            }
            toRemove.push(id);
          }
        }
      }
    }
    
    for (const id of toRemove) {
      this.projectiles.delete(id);
    }
  }
  
  // ============================================================
  // Victory Conditions
  // ============================================================
  
  private checkVictoryConditions(): void {
    const factionStatus = new Map<string, { alive: number; total: number; retreated: boolean; surrendered: boolean }>();
    
    // Count units per faction
    for (const unit of this.units.values()) {
      const factionId = unit.factionId;
      if (!factionStatus.has(factionId)) {
        factionStatus.set(factionId, { alive: 0, total: 0, retreated: false, surrendered: false });
      }
      const status = factionStatus.get(factionId)!;
      status.total++;
      if (!unit.isDestroyed) {
        status.alive++;
      }
    }
    
    // Check participant status
    for (const [factionId, participant] of this.participants) {
      const status = factionStatus.get(factionId);
      if (status) {
        status.retreated = participant.retreated;
        status.surrendered = participant.surrendered;
      }
    }
    
    // Determine winner
    const activeFactions = Array.from(factionStatus.entries())
      .filter(([, status]) => status.alive > 0 && !status.retreated && !status.surrendered);
    
    if (activeFactions.length === 0) {
      // Draw
      this.endBattle('DRAW');
    } else if (activeFactions.length === 1) {
      // Winner
      this.endBattle('ANNIHILATION', activeFactions[0][0]);
    } else {
      // Check for surrender
      const surrendered = Array.from(factionStatus.entries())
        .filter(([, status]) => status.surrendered);
      if (surrendered.length > 0 && activeFactions.length === 1) {
        this.endBattle('SURRENDER', activeFactions[0][0]);
      }
      
      // Check for retreat
      const retreated = Array.from(factionStatus.entries())
        .filter(([, status]) => status.retreated);
      if (retreated.length > 0 && activeFactions.length === 1) {
        this.endBattle('RETREAT', activeFactions[0][0]);
      }
    }
  }
  
  private endBattle(
    reason: 'ANNIHILATION' | 'RETREAT' | 'SURRENDER' | 'TIMEOUT' | 'DRAW',
    winnerId: string | null = null
  ): void {
    this.status = 'ENDED';
    this.endTime = new Date();
    this.stopLoop();
    
    // Calculate casualties
    const casualties: Record<string, CasualtyReport> = {};
    for (const [factionId] of this.participants) {
      casualties[factionId] = {
        shipsLost: 0,
        shipsDestroyed: 0,
        damageDealt: 0,
        damageTaken: 0,
        creditsLost: 0,
      };
    }
    
    for (const unit of this.units.values()) {
      if (unit.isDestroyed) {
        casualties[unit.factionId].shipsLost += unit.shipCount;
        casualties[unit.factionId].creditsLost += 
          SHIP_SPECS[unit.shipClass].buildCost.credits * unit.shipCount;
      }
    }
    
    this.result = {
      winnerId,
      reason,
      casualties,
      duration: this.tick,
      endTime: this.endTime,
    };
    
    logger.info('[TacticalSession] Battle ended', {
      battleId: this.battleId,
      winnerId,
      reason,
      duration: this.tick,
    });
    
    this.emit('BATTLE_END', {
      battleId: this.battleId,
      result: this.result,
    });
  }
  
  // ============================================================
  // Effects
  // ============================================================
  
  private addEffect(params: { type: EffectState['type']; position: Vector3; scale?: number }): void {
    const effectId = `EFF-${uuidv4().slice(0, 8)}`;
    this.effects.set(effectId, {
      id: effectId,
      type: params.type,
      position: { ...params.position },
      scale: params.scale ?? 1,
      duration: 1,
      startTick: this.tick,
    });
  }
  
  private cleanupEffects(): void {
    const toRemove: string[] = [];
    for (const [id, effect] of this.effects) {
      if (this.tick - effect.startTick > effect.duration * TACTICAL_CONSTANTS.TICKS_PER_SECOND) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.effects.delete(id);
    }
  }
  
  // ============================================================
  // State Emission
  // ============================================================
  
  private emitUpdate(): void {
    const update: BattleUpdateEvent = {
      battleId: this.battleId,
      tick: this.tick,
      timestamp: Date.now(),
      units: this.getUnits(),
      projectiles: Array.from(this.projectiles.values()),
      effects: Array.from(this.effects.values()),
    };
    
    this.emit('BATTLE_UPDATE', update);
  }
  
  /**
   * Get current snapshot for reconnecting clients
   */
  getSnapshot(): BattleUpdateEvent {
    return {
      battleId: this.battleId,
      tick: this.tick,
      timestamp: Date.now(),
      units: this.getUnits(),
      projectiles: Array.from(this.projectiles.values()),
      effects: Array.from(this.effects.values()),
    };
  }
  
  // ============================================================
  // Utility Functions
  // ============================================================
  
  private vectorLength(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
  
  private distanceBetween(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  private lookAt(from: Vector3, to: Vector3): Quaternion {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.001) {
      return { x: 0, y: 0, z: 0, w: 1 };
    }
    return this.directionToQuaternion(dx / len, dy / len, dz / len);
  }
  
  private directionToQuaternion(dirX: number, dirY: number, dirZ: number): Quaternion {
    // Convert direction to quaternion (simplified Y-up rotation)
    const yaw = Math.atan2(dirZ, dirX);
    const pitch = Math.asin(-dirY);
    
    // Convert euler angles to quaternion
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    
    return {
      x: sp * cy,
      y: cp * sy,
      z: sp * sy,
      w: cp * cy,
    };
  }
  
  // ============================================================
  // Cleanup
  // ============================================================
  
  destroy(): void {
    this.stopLoop();
    this.removeAllListeners();
    
    // 진형 상태 정리
    const processedFleets = new Set<string>();
    for (const unit of this.units.values()) {
      if (!processedFleets.has(unit.fleetId)) {
        fleetFormationService.clearFormationState(unit.fleetId);
        processedFleets.add(unit.fleetId);
      }
      // 기동 상태 정리
      fleetFormationService.clearManeuverState(unit.id);
    }
    
    this.units.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.commandQueue = [];
    
    logger.info('[TacticalSession] Destroyed', {
      battleId: this.battleId,
    });
  }
}

// ============================================================
// Session Manager (Singleton)
// ============================================================

class TacticalSessionManager {
  private sessions: Map<string, TacticalSession> = new Map();
  
  createSession(sessionId: string, gridId: string): TacticalSession {
    const session = new TacticalSession(sessionId, gridId);
    this.sessions.set(session.getBattleId(), session);
    return session;
  }
  
  getSession(battleId: string): TacticalSession | undefined {
    return this.sessions.get(battleId);
  }
  
  getSessionsByGameSession(sessionId: string): TacticalSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.sessionId === sessionId);
  }
  
  removeSession(battleId: string): boolean {
    const session = this.sessions.get(battleId);
    if (session) {
      session.destroy();
      this.sessions.delete(battleId);
      return true;
    }
    return false;
  }
  
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values())
      .filter(s => s.getStatus() === 'RUNNING' || s.getStatus() === 'COUNTDOWN')
      .length;
  }
}

export const tacticalSessionManager = new TacticalSessionManager();

