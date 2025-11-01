/**
 * BattleEngine - 3D 전투 메인 엔진
 * 
 * 전투 시작, Planning Phase, Resolution Phase 관리
 */

import {
  BattleState,
  BattleUnit3D,
  Action,
  ResolutionResult,
  VictoryCondition,
  Position3D,
  BattleTile3D
} from './types';
import { BattleValidator } from './BattleValidator';
import { BattleResolver } from './BattleResolver';
import { BattleAI } from './BattleAI';

export interface BattleConfig {
  planningSeconds: number;
  resolutionSeconds: number;
  turnLimit: number;
  timeCapSeconds: number;
}

export class BattleEngine {
  private validator: BattleValidator;
  private resolver: BattleResolver;
  private ai: BattleAI;
  
  private state!: BattleState;
  private config: BattleConfig;
  private planningTimer?: NodeJS.Timeout;
  private resolutionTimer?: NodeJS.Timeout;
  
  private throneOccupationTurns: number = 0;
  private startTime?: Date;

  constructor(config: BattleConfig) {
    this.validator = new BattleValidator();
    this.resolver = new BattleResolver();
    this.ai = new BattleAI();
    this.config = config;
  }

  startBattle(
    battleId: string,
    map: BattleTile3D[][],
    attackerUnits: BattleUnit3D[],
    defenderUnits: BattleUnit3D[],
    attackerPlayerId: number,
    defenderPlayerId: number
  ): BattleState {
    this.state = {
      battleId,
      currentTurn: 0,
      phase: 'deployment',
      map,
      units: new Map(),
      buildings: [],
      attackerPlayerId,
      defenderPlayerId,
      turnSeconds: this.config.planningSeconds,
      resolutionSeconds: this.config.resolutionSeconds,
      actions: new Map(),
      readyPlayers: new Set(),
      aiControlled: new Set(),
      battleLog: []
    };

    for (const unit of [...attackerUnits, ...defenderUnits]) {
      this.state.units.set(unit.id, unit);
    }

    this.startTime = new Date();
    this.state.battleLog.push(`Battle ${battleId} started at ${this.startTime.toISOString()}`);

    return this.state;
  }

  startDeploymentPhase(deploymentSeconds: number = 60): void {
    this.state.phase = 'deployment';
    this.state.battleLog.push(`Deployment phase started (${deploymentSeconds}s)`);

    setTimeout(() => {
      this.startPlanningPhase();
    }, deploymentSeconds * 1000);
  }

  processPlanningPhase(): void {
    if (this.state.phase !== 'planning') {
      this.startPlanningPhase();
      return;
    }

    const deadline = this.state.planningDeadline;
    if (!deadline) return;

    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();

    if (remaining <= 0 || this.allPlayersReady()) {
      this.endPlanningPhase();
    }
  }

  private startPlanningPhase(): void {
    this.state.currentTurn++;
    this.state.phase = 'planning';
    this.state.actions.clear();
    this.state.readyPlayers.clear();

    for (const unit of this.state.units.values()) {
      unit.hasActed = false;
    }

    this.state.planningDeadline = new Date(Date.now() + this.config.planningSeconds * 1000);
    this.state.battleLog.push(
      `Turn ${this.state.currentTurn} Planning Phase started (${this.config.planningSeconds}s)`
    );

    this.handleAFKPlayers();

    this.planningTimer = setTimeout(() => {
      this.endPlanningPhase();
    }, this.config.planningSeconds * 1000);
  }

  private endPlanningPhase(): void {
    if (this.planningTimer) {
      clearTimeout(this.planningTimer);
    }

    this.state.battleLog.push(`Turn ${this.state.currentTurn} Planning Phase ended`);
    this.processResolutionPhase();
  }

  processResolutionPhase(): void {
    this.state.phase = 'resolution';
    this.state.battleLog.push(`Turn ${this.state.currentTurn} Resolution Phase started`);

    const result = this.resolver.resolve(this.state);

    for (const effect of result.effects) {
      this.state.battleLog.push(effect);
    }

    this.cleanupDeadUnits();

    const victoryCondition = this.checkVictoryCondition();
    
    if (victoryCondition) {
      this.endBattle(victoryCondition);
      return;
    }

    setTimeout(() => {
      if (this.state.currentTurn >= this.config.turnLimit) {
        this.endBattle({
          type: 'time_limit',
          winner: 'defender',
          reason: 'Turn limit reached'
        });
      } else if (this.hasExceededTimeCap()) {
        this.endBattle({
          type: 'time_limit',
          winner: 'defender',
          reason: 'Time cap exceeded'
        });
      } else {
        this.startPlanningPhase();
      }
    }, this.config.resolutionSeconds * 1000);
  }

  checkVictoryCondition(): VictoryCondition | null {
    const attackerUnits = Array.from(this.state.units.values()).filter(
      u => u.side === 'attacker' && u.hp > 0
    );
    const defenderUnits = Array.from(this.state.units.values()).filter(
      u => u.side === 'defender' && u.hp > 0
    );

    if (defenderUnits.length === 0) {
      return {
        type: 'elimination',
        winner: 'attacker',
        reason: 'All defenders eliminated'
      };
    }

    if (attackerUnits.length === 0) {
      return {
        type: 'elimination',
        winner: 'defender',
        reason: 'All attackers eliminated'
      };
    }

    const throneBuilding = this.state.buildings.find(b => b.type === 'throne');
    if (throneBuilding) {
      const throneOccupied = attackerUnits.some(
        u => u.position.x === throneBuilding.z && u.position.y === throneBuilding.z
      );

      if (throneOccupied) {
        this.throneOccupationTurns++;
        if (this.throneOccupationTurns >= 3) {
          return {
            type: 'throne_captured',
            winner: 'attacker',
            reason: 'Throne captured for 3 turns'
          };
        }
      } else {
        this.throneOccupationTurns = 0;
      }
    }

    return null;
  }

  submitAction(playerId: number, action: Action): { success: boolean; error?: string } {
    if (this.state.phase !== 'planning') {
      return { success: false, error: 'Not in planning phase' };
    }

    const unit = this.state.units.get(action.unitId);
    if (!unit) {
      return { success: false, error: 'Unit not found' };
    }

    if (unit.playerId !== playerId) {
      return { success: false, error: 'Not your unit' };
    }

    if (this.state.aiControlled.has(action.unitId)) {
      return { success: false, error: 'Unit is AI controlled' };
    }

    const validation = this.validator.validateAction(action, this.state);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    this.state.actions.set(action.unitId, action);
    unit.afkTurns = 0;

    return { success: true };
  }

  setPlayerReady(playerId: number): void {
    this.state.readyPlayers.add(playerId);

    if (this.allPlayersReady()) {
      this.endPlanningPhase();
    }
  }

  private allPlayersReady(): boolean {
    const playerIds = new Set<number>();
    for (const unit of this.state.units.values()) {
      playerIds.add(unit.playerId);
    }

    for (const pid of playerIds) {
      if (!this.state.readyPlayers.has(pid)) {
        return false;
      }
    }

    return true;
  }

  private handleAFKPlayers(): void {
    const playerActions = new Map<number, number>();

    for (const action of this.state.actions.values()) {
      const unit = this.state.units.get(action.unitId);
      if (unit) {
        playerActions.set(unit.playerId, (playerActions.get(unit.playerId) || 0) + 1);
      }
    }

    for (const [unitId, unit] of this.state.units) {
      const playerActionCount = playerActions.get(unit.playerId) || 0;

      if (playerActionCount === 0) {
        unit.afkTurns++;

        if (unit.afkTurns >= 2) {
          this.state.aiControlled.add(unitId);
          const aiAction = this.ai.decideAction(unit, this.state);
          this.state.actions.set(unitId, aiAction);
          this.state.battleLog.push(`AI controlling ${unit.name}`);
        } else {
          this.state.actions.set(unitId, { type: 'defend', unitId });
        }
      }
    }
  }

  private cleanupDeadUnits(): void {
    for (const [unitId, unit] of this.state.units) {
      if (unit.hp <= 0 || unit.troops <= 0) {
        this.state.units.delete(unitId);
        this.state.battleLog.push(`${unit.name} has been eliminated`);
      }
    }
  }

  private hasExceededTimeCap(): boolean {
    if (!this.startTime) return false;
    
    const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
    return elapsed > this.config.timeCapSeconds;
  }

  private endBattle(condition: VictoryCondition): void {
    this.state.phase = 'finished';
    this.state.winner = condition.winner;
    this.state.battleLog.push(`Battle ended: ${condition.reason}`);
    this.state.battleLog.push(`Winner: ${condition.winner}`);

    if (this.planningTimer) clearTimeout(this.planningTimer);
    if (this.resolutionTimer) clearTimeout(this.resolutionTimer);
  }

  getState(): BattleState {
    return this.state;
  }

  getBattleLog(): string[] {
    return this.state.battleLog;
  }
}
