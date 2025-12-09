/**
 * NPC Faction Controller
 * 
 * NPC 진영의 AI를 틱 단위로 실행하고 관리합니다.
 * - 전략 AI 평가 및 명령 실행
 * - 전투 AI 평가 및 명령 실행
 * - AI 상태 관리 및 로깅
 */

import { EventEmitter } from 'events';
import { 
  AIBlackboard,
  AIPersonality,
  StrategicContext,
  StrategicDecision,
  TacticalContext,
  TacticalDecision,
  AI_CONFIG,
  PERSONALITY_PRESETS,
} from '../../../types/gin7/npc-ai.types';
import { NPCFaction, INPCFaction } from '../../../models/gin7/NPCFaction';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { Planet } from '../../../models/gin7/Planet';
import { StarSystem } from '../../../models/gin7/StarSystem';
import { Gin7GameSession as GameSession } from '../../../models/gin7/GameSession';
import { strategicAIService } from './StrategicAI';
import { tacticalAIService } from './TacticalAI';
import { TacticalSession, tacticalSessionManager } from '../TacticalSession';
import { TacticalCommand } from '../../../types/gin7/tactical.types';
import { logger } from '../../../common/logger';

// ============================================================
// Types
// ============================================================

export interface NPCControllerConfig {
  sessionId: string;
  strategicEvalInterval?: number;  // 전략 평가 주기 (틱)
  tacticalEvalInterval?: number;   // 전술 평가 주기 (틱)
}

export interface AIExecutionResult {
  factionId: string;
  strategicDecisions: StrategicDecision[];
  tacticalDecisions: TacticalDecision[];
  executedCommands: number;
  errors: string[];
}

// ============================================================
// NPC Faction Controller
// ============================================================

export class NPCFactionController extends EventEmitter {
  private sessionId: string;
  private blackboards: Map<string, AIBlackboard> = new Map();
  private strategicEvalInterval: number;
  private tacticalEvalInterval: number;
  private isProcessing: boolean = false;
  
  constructor(config: NPCControllerConfig) {
    super();
    this.sessionId = config.sessionId;
    this.strategicEvalInterval = config.strategicEvalInterval || AI_CONFIG.STRATEGIC_EVAL_INTERVAL;
    this.tacticalEvalInterval = config.tacticalEvalInterval || AI_CONFIG.TACTICAL_EVAL_INTERVAL;
  }
  
  /**
   * 컨트롤러 초기화 - 모든 NPC 진영의 Blackboard 생성
   */
  async initialize(): Promise<void> {
    logger.info('[NPCController] Initializing', { sessionId: this.sessionId });
    
    // 세션의 NPC 진영 로드
    const npcFactions = await NPCFaction.findBySession(this.sessionId);
    
    for (const faction of npcFactions) {
      const blackboard = this.createBlackboard(faction);
      this.blackboards.set(faction.factionId, blackboard);
      
      logger.debug('[NPCController] Faction initialized', {
        factionId: faction.factionId,
        preset: faction.personalityPresetId,
        difficulty: faction.aiDifficulty,
      });
    }
    
    logger.info('[NPCController] Initialized', {
      sessionId: this.sessionId,
      factionCount: npcFactions.length,
    });
  }
  
  /**
   * Blackboard 생성
   */
  private createBlackboard(faction: INPCFaction): AIBlackboard {
    return {
      personality: faction.personality,
      currentStrategicDecisions: [],
      currentTacticalDecisions: [],
      tempData: new Map(),
      lastEvaluationTick: 0,
      lastDecisions: [],
      decisionHistory: [],
    };
  }
  
  /**
   * 틱 처리 - 모든 NPC 진영 AI 평가 및 실행
   */
  async processTick(currentTick: number): Promise<AIExecutionResult[]> {
    if (this.isProcessing) {
      logger.warn('[NPCController] Already processing, skipping tick', { currentTick });
      return [];
    }
    
    this.isProcessing = true;
    const results: AIExecutionResult[] = [];
    
    try {
      const npcFactions = await NPCFaction.findBySession(this.sessionId);
      
      for (const faction of npcFactions) {
        if (!faction.aiEnabled) continue;
        
        try {
          const result = await this.processFaction(faction, currentTick);
          results.push(result);
        } catch (error) {
          logger.error('[NPCController] Faction processing error', {
            factionId: faction.factionId,
            error,
          });
          results.push({
            factionId: faction.factionId,
            strategicDecisions: [],
            tacticalDecisions: [],
            executedCommands: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
    
    return results;
  }
  
  /**
   * 개별 진영 AI 처리
   */
  private async processFaction(
    faction: INPCFaction, 
    currentTick: number
  ): Promise<AIExecutionResult> {
    const result: AIExecutionResult = {
      factionId: faction.factionId,
      strategicDecisions: [],
      tacticalDecisions: [],
      executedCommands: 0,
      errors: [],
    };
    
    // Blackboard 가져오기 또는 생성
    let blackboard = this.blackboards.get(faction.factionId);
    if (!blackboard) {
      blackboard = this.createBlackboard(faction);
      this.blackboards.set(faction.factionId, blackboard);
    }
    
    // 난이도 보정 적용
    const difficultyMod = AI_CONFIG.DIFFICULTY[faction.aiDifficulty];
    const effectiveTick = currentTick - difficultyMod.reactionDelay;
    
    // 1. 전략 AI 평가 (주기적)
    if (effectiveTick % this.strategicEvalInterval === 0) {
      try {
        await this.updateStrategicContext(blackboard, faction, currentTick);
        const decisions = await strategicAIService.evaluate(blackboard);
        result.strategicDecisions = decisions;
        
        // 전략 결정 실행
        for (const decision of decisions) {
          const executed = await this.executeStrategicDecision(faction, decision);
          if (executed) result.executedCommands++;
        }
      } catch (error) {
        result.errors.push(`Strategic AI error: ${error}`);
      }
    }
    
    // 2. 전투 AI 평가 (전투 중인 경우)
    const battles = this.getActiveBattles(faction.factionId);
    for (const battle of battles) {
      if (effectiveTick % this.tacticalEvalInterval === 0) {
        try {
          this.updateTacticalContext(blackboard, battle, faction.factionId);
          const decisions = tacticalAIService.evaluate(blackboard);
          result.tacticalDecisions.push(...decisions);
          
          // 전술 결정 실행
          for (const decision of decisions) {
            const executed = await this.executeTacticalDecision(battle, faction.factionId, decision);
            if (executed) result.executedCommands++;
          }
        } catch (error) {
          result.errors.push(`Tactical AI error: ${error}`);
        }
      }
    }
    
    // 3. 통계 업데이트
    faction.lastTickProcessed = currentTick;
    faction.lastEvaluationTime = new Date();
    faction.stats.decisionsTotal += result.strategicDecisions.length + result.tacticalDecisions.length;
    await faction.save();
    
    return result;
  }
  
  /**
   * 전략 컨텍스트 업데이트
   */
  private async updateStrategicContext(
    blackboard: AIBlackboard,
    faction: INPCFaction,
    currentTick: number
  ): Promise<void> {
    // 자원 정보 (실제로는 국고 모델에서 가져옴)
    const resources = {
      credits: 100000,
      minerals: 50000,
      food: 30000,
      fuel: 20000,
      shipParts: 10000,
    };
    
    // 영토 정보
    const ownedPlanets = await Planet.find({
      sessionId: this.sessionId,
      ownerFactionId: faction.factionId,
    }).lean();
    
    const ownedSystems = [...new Set(ownedPlanets.map(p => p.systemId))];
    
    // 적 진영 정보
    const gameSession = await GameSession.findOne({ sessionId: this.sessionId }).lean();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allFactions = (gameSession as any)?.factions || [];
    const atWarWith = allFactions
      .filter(f => f.factionId !== faction.factionId && f.isAtWar)
      .map(f => f.factionId);
    
    // 군사력 (임시 값)
    const fleets = await Fleet.find({
      sessionId: this.sessionId,
      factionId: faction.factionId,
    }).lean();
    
    const military = {
      totalFleets: fleets.length,
      totalShips: fleets.reduce((sum, f) => sum + f.totalShips, 0),
      combatPower: 10000, // 실제로는 계산 필요
      idleFleets: fleets.filter(f => f.status === 'IDLE').map(f => f.fleetId),
      fleetsBySystem: new Map<string, string[]>(),
    };
    
    blackboard.strategicContext = {
      sessionId: this.sessionId,
      factionId: faction.factionId,
      currentTick,
      resources,
      territory: {
        ownedPlanets: ownedPlanets.map(p => p.planetId),
        ownedSystems,
        borderPlanets: [],
        frontlineSystems: [],
      },
      military,
      enemies: [],
      diplomacy: {
        atWarWith,
        allies: [],
        neutral: [],
      },
    };
    
    blackboard.currentStrategicDecisions = [];
  }
  
  /**
   * 전술 컨텍스트 업데이트
   */
  private updateTacticalContext(
    blackboard: AIBlackboard,
    battle: TacticalSession,
    factionId: string
  ): void {
    const units = battle.getUnits();
    const ownUnits = units.filter(u => u.factionId === factionId && !u.isDestroyed);
    const enemyUnits = units.filter(u => u.factionId !== factionId && !u.isDestroyed);
    
    const ownTotalPower = ownUnits.reduce((sum, u) => sum + u.shipCount * 10, 0);
    const enemyTotalPower = enemyUnits.reduce((sum, u) => sum + u.shipCount * 10, 0);
    
    const ownAverageHp = ownUnits.length > 0
      ? ownUnits.reduce((sum, u) => sum + (u.hp / u.maxHp * 100), 0) / ownUnits.length
      : 0;
    const enemyAverageHp = enemyUnits.length > 0
      ? enemyUnits.reduce((sum, u) => sum + (u.hp / u.maxHp * 100), 0) / enemyUnits.length
      : 0;
    const ownAverageMorale = ownUnits.length > 0
      ? ownUnits.reduce((sum, u) => sum + u.morale, 0) / ownUnits.length
      : 0;
    
    blackboard.tacticalContext = {
      battleId: battle.getBattleId(),
      factionId,
      currentTick: battle.getTick(),
      ownUnits: ownUnits.map(u => ({
        unitId: u.id,
        shipClass: u.shipClass,
        shipCount: u.shipCount,
        hpPercent: (u.hp / u.maxHp) * 100,
        morale: u.morale,
        combatPower: u.shipCount * 10,
        hasTarget: !!u.targetId,
        isRetreating: false, // 실제로는 상태 체크
        isChaos: u.isChaos,
      })),
      enemyUnits: enemyUnits.map(u => ({
        unitId: u.id,
        shipClass: u.shipClass,
        shipCount: u.shipCount,
        hpPercent: (u.hp / u.maxHp) * 100,
        morale: u.morale,
        combatPower: u.shipCount * 10,
        hasTarget: !!u.targetId,
        isRetreating: false,
        isChaos: u.isChaos,
      })),
      ownTotalPower,
      ownAverageHp,
      ownAverageMorale,
      enemyTotalPower,
      enemyAverageHp,
      battlePhase: 'OPENING',
      ticksElapsed: battle.getTick(),
      advantageRatio: ownTotalPower / Math.max(enemyTotalPower, 1),
      currentFormation: 'LINE',
      currentTargeting: 'DEFAULT',
      warpChargeLevel: 0,
    };
    
    blackboard.currentTacticalDecisions = [];
  }
  
  /**
   * 활성 전투 목록 가져오기
   */
  private getActiveBattles(factionId: string): TacticalSession[] {
    const sessions = tacticalSessionManager.getSessionsByGameSession(this.sessionId);
    return sessions.filter(s => {
      const participants = s.getParticipants();
      return participants.some(p => p.factionId === factionId) && 
             s.getStatus() === 'RUNNING';
    });
  }
  
  /**
   * 전략 결정 실행
   */
  private async executeStrategicDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<boolean> {
    logger.info('[NPCController] Executing strategic decision', {
      factionId: faction.factionId,
      type: decision.type,
      target: decision.target,
    });
    
    try {
      switch (decision.type) {
        case 'ATTACK':
          await this.executeAttackDecision(faction, decision);
          faction.stats.attacksLaunched++;
          break;
          
        case 'DEFEND':
          await this.executeDefendDecision(faction, decision);
          faction.stats.defensesOrdered++;
          break;
          
        case 'REINFORCE':
          await this.executeReinforceDecision(faction, decision);
          break;
          
        case 'BUILD_FLEET':
          await this.executeBuildFleetDecision(faction, decision);
          break;
          
        case 'BUILD_FACILITY':
          await this.executeBuildFacilityDecision(faction, decision);
          break;
          
        case 'WAIT':
          // 대기 - 특별한 동작 없음
          break;
          
        default:
          logger.warn('[NPCController] Unknown strategic decision type', { type: decision.type });
          return false;
      }
      
      // 이벤트 발생
      this.emit('STRATEGIC_DECISION_EXECUTED', {
        factionId: faction.factionId,
        decision,
      });
      
      return true;
    } catch (error) {
      logger.error('[NPCController] Strategic decision execution error', { error, decision });
      return false;
    }
  }
  
  /**
   * 공격 결정 실행
   */
  private async executeAttackDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<void> {
    if (!decision.fleetIds || !decision.target) return;
    
    // 함대 이동 명령 (실제로는 FleetService 호출)
    for (const fleetId of decision.fleetIds) {
      await Fleet.updateOne(
        { fleetId, sessionId: this.sessionId },
        {
          status: 'MOVING',
          'statusData.destination': decision.target,
          'statusData.mission': 'ATTACK',
        }
      );
    }
    
    logger.info('[NPCController] Attack ordered', {
      factionId: faction.factionId,
      fleets: decision.fleetIds,
      target: decision.target,
    });
  }
  
  /**
   * 방어 결정 실행
   */
  private async executeDefendDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<void> {
    if (!decision.fleetIds || !decision.target) return;
    
    // 함대 방어 배치 (실제로는 FleetService 호출)
    for (const fleetId of decision.fleetIds) {
      await Fleet.updateOne(
        { fleetId, sessionId: this.sessionId },
        {
          status: 'MOVING',
          'statusData.destination': decision.target,
          'statusData.mission': 'DEFEND',
        }
      );
    }
  }
  
  /**
   * 증원 결정 실행
   */
  private async executeReinforceDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<void> {
    if (!decision.fleetIds || !decision.target) return;
    
    for (const fleetId of decision.fleetIds) {
      await Fleet.updateOne(
        { fleetId, sessionId: this.sessionId },
        {
          status: 'MOVING',
          'statusData.destination': decision.target,
          'statusData.mission': 'REINFORCE',
        }
      );
    }
  }
  
  /**
   * 함대 건조 결정 실행
   */
  private async executeBuildFleetDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<void> {
    // 실제로는 ProductionService 호출
    logger.info('[NPCController] Fleet build ordered', {
      factionId: faction.factionId,
      params: decision.parameters,
    });
  }
  
  /**
   * 시설 건설 결정 실행
   */
  private async executeBuildFacilityDecision(
    faction: INPCFaction,
    decision: StrategicDecision
  ): Promise<void> {
    // 실제로는 FacilityService 호출
    logger.info('[NPCController] Facility build ordered', {
      factionId: faction.factionId,
      target: decision.target,
      params: decision.parameters,
    });
  }
  
  /**
   * 전술 결정 실행
   */
  private async executeTacticalDecision(
    battle: TacticalSession,
    factionId: string,
    decision: TacticalDecision
  ): Promise<boolean> {
    logger.debug('[NPCController] Executing tactical decision', {
      battleId: battle.getBattleId(),
      factionId,
      type: decision.type,
    });
    
    try {
      const command = this.convertToTacticalCommand(decision);
      if (!command) return false;
      
      const success = battle.queueCommand(factionId, 'AI', command);
      
      if (success) {
        this.emit('TACTICAL_DECISION_EXECUTED', {
          battleId: battle.getBattleId(),
          factionId,
          decision,
        });
      }
      
      return success;
    } catch (error) {
      logger.error('[NPCController] Tactical decision execution error', { error, decision });
      return false;
    }
  }
  
  /**
   * TacticalDecision을 TacticalCommand로 변환
   */
  private convertToTacticalCommand(decision: TacticalDecision): TacticalCommand | null {
    switch (decision.type) {
      case 'ATTACK_TARGET':
      case 'FOCUS_FIRE':
        if (typeof decision.target !== 'string') return null;
        return {
          type: 'ATTACK',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { targetId: decision.target },
        };
        
      case 'MOVE_POSITION':
        if (typeof decision.target === 'string') return null;
        return {
          type: 'MOVE',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { targetPosition: decision.target! },
        };
        
      case 'CHANGE_FORMATION':
        return {
          type: 'FORMATION',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { formation: decision.formation as any },
        };
        
      case 'CHANGE_ENERGY':
        if (!decision.energyDistribution) return null;
        return {
          type: 'ENERGY_DISTRIBUTION',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { distribution: decision.energyDistribution },
        };
        
      case 'RETREAT':
        return {
          type: 'RETREAT',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: {},
        };
        
      case 'HOLD_POSITION':
        return {
          type: 'STOP',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { holdPosition: true },
        };
        
      case 'CHARGE':
        // 돌격 = 적에게 이동 + 공격
        return {
          type: 'ATTACK',
          unitIds: decision.unitIds,
          timestamp: Date.now(),
          data: { targetId: '', attackType: 'ALL' },
        };
        
      default:
        return null;
    }
  }
  
  /**
   * 정리
   */
  destroy(): void {
    this.blackboards.clear();
    this.removeAllListeners();
    logger.info('[NPCController] Destroyed', { sessionId: this.sessionId });
  }
}

// ============================================================
// Controller Manager (Singleton)
// ============================================================

class NPCControllerManager {
  private controllers: Map<string, NPCFactionController> = new Map();
  
  async getOrCreate(sessionId: string): Promise<NPCFactionController> {
    let controller = this.controllers.get(sessionId);
    
    if (!controller) {
      controller = new NPCFactionController({ sessionId });
      await controller.initialize();
      this.controllers.set(sessionId, controller);
    }
    
    return controller;
  }
  
  get(sessionId: string): NPCFactionController | undefined {
    return this.controllers.get(sessionId);
  }
  
  remove(sessionId: string): void {
    const controller = this.controllers.get(sessionId);
    if (controller) {
      controller.destroy();
      this.controllers.delete(sessionId);
    }
  }
  
  getAll(): NPCFactionController[] {
    return Array.from(this.controllers.values());
  }
}

export const npcControllerManager = new NPCControllerManager();

