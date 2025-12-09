/**
 * Faction AI Controller (Extended)
 * 
 * 진영 AI의 확장된 기능을 담당합니다:
 * - 전략 목표 우선순위
 * - 자원 할당 로직
 * - 외교 결정 로직
 * - 전쟁 계획 수립
 */

import { EventEmitter } from 'events';
import {
  FactionAIGoal,
  FactionGoalType,
  FactionResourceAllocation,
  FactionDiplomacyDecision,
  FactionWarPlan,
  StrategicContext,
  StrategicDecision,
  AIPersonality,
  AI_CONFIG,
} from '../../../types/gin7/npc-ai.types';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { Planet } from '../../../models/gin7/Planet';
import { logger } from '../../../common/logger';

// ============================================================
// Types
// ============================================================

export interface FactionAIState {
  factionId: string;
  sessionId: string;
  personality: AIPersonality;
  
  // Goals
  strategicGoals: FactionAIGoal[];
  
  // Resources
  resourceAllocation: FactionResourceAllocation;
  
  // Diplomacy
  pendingDiplomacy: FactionDiplomacyDecision[];
  
  // War Plans
  activeWarPlans: FactionWarPlan[];
  
  // Statistics
  lastEvaluationTick: number;
  totalDecisions: number;
}

export interface FactionEvaluationResult {
  factionId: string;
  goalsUpdated: number;
  decisionsGenerated: StrategicDecision[];
  warPlanChanges: string[];
  diplomacyActions: FactionDiplomacyDecision[];
}

// ============================================================
// Default Configurations
// ============================================================

export const DEFAULT_RESOURCE_ALLOCATION: FactionResourceAllocation = {
  military: 40,
  economy: 30,
  research: 15,
  diplomacy: 5,
  reserve: 10,
};

export const FACTION_AI_CONFIG = {
  GOAL_EVAL_INTERVAL: 20,           // 목표 평가 주기 (틱)
  MAX_ACTIVE_GOALS: 5,              // 최대 활성 목표 수
  WAR_DECLARATION_THRESHOLD: 1.5,   // 전쟁 선포 최소 전력비
  PEACE_OFFER_THRESHOLD: 0.6,       // 평화 제안 전력비
  ALLIANCE_REPUTATION_MIN: 50,      // 동맹 체결 최소 평판
};

// ============================================================
// Faction AI Controller
// ============================================================

export class FactionAIController extends EventEmitter {
  private factionStates: Map<string, FactionAIState> = new Map();
  
  constructor() {
    super();
  }
  
  // ============================================================
  // Faction Management
  // ============================================================
  
  /**
   * 진영 AI 등록
   */
  registerFaction(
    factionId: string,
    sessionId: string,
    personality: AIPersonality,
    customAllocation?: Partial<FactionResourceAllocation>
  ): FactionAIState {
    const state: FactionAIState = {
      factionId,
      sessionId,
      personality,
      strategicGoals: [],
      resourceAllocation: { ...DEFAULT_RESOURCE_ALLOCATION, ...customAllocation },
      pendingDiplomacy: [],
      activeWarPlans: [],
      lastEvaluationTick: 0,
      totalDecisions: 0,
    };
    
    // 기본 목표 설정
    this.initializeDefaultGoals(state);
    
    this.factionStates.set(factionId, state);
    
    logger.info('[FactionAI] Faction registered', { factionId, sessionId });
    
    return state;
  }
  
  /**
   * 진영 AI 등록 해제
   */
  unregisterFaction(factionId: string): void {
    this.factionStates.delete(factionId);
    logger.info('[FactionAI] Faction unregistered', { factionId });
  }
  
  /**
   * 진영 상태 가져오기
   */
  getFactionState(factionId: string): FactionAIState | undefined {
    return this.factionStates.get(factionId);
  }
  
  // ============================================================
  // Goal Management
  // ============================================================
  
  /**
   * 기본 목표 초기화
   */
  private initializeDefaultGoals(state: FactionAIState): void {
    // 기본 생존 목표
    state.strategicGoals.push({
      type: 'DEFEND_TERRITORY',
      priority: 90,
      progress: 0,
      parameters: { autoRenew: true },
    });
    
    // 경제 성장 목표
    state.strategicGoals.push({
      type: 'ECONOMIC_GROWTH',
      priority: 60,
      progress: 0,
      parameters: { targetGrowth: 10 },
    });
    
    // 군사력 강화 목표
    state.strategicGoals.push({
      type: 'BUILD_MILITARY',
      priority: 70,
      progress: 0,
      parameters: { targetFleets: 5 },
    });
  }
  
  /**
   * 전략 목표 추가
   */
  addStrategicGoal(factionId: string, goal: Omit<FactionAIGoal, 'progress'>): void {
    const state = this.factionStates.get(factionId);
    if (!state) return;
    
    const newGoal: FactionAIGoal = {
      ...goal,
      progress: 0,
    };
    
    // 최대 목표 수 체크
    if (state.strategicGoals.length >= FACTION_AI_CONFIG.MAX_ACTIVE_GOALS) {
      // 가장 낮은 우선순위 목표 제거
      state.strategicGoals.sort((a, b) => b.priority - a.priority);
      state.strategicGoals.pop();
    }
    
    state.strategicGoals.push(newGoal);
    state.strategicGoals.sort((a, b) => b.priority - a.priority);
    
    logger.debug('[FactionAI] Goal added', { factionId, goalType: goal.type });
  }
  
  /**
   * 목표 우선순위 재조정
   */
  reprioritizeGoals(factionId: string, context: StrategicContext): void {
    const state = this.factionStates.get(factionId);
    if (!state) return;
    
    for (const goal of state.strategicGoals) {
      // 상황에 따른 우선순위 동적 조정
      switch (goal.type) {
        case 'DEFEND_TERRITORY':
          // 적 위협이 높으면 방어 우선순위 상승
          const maxThreat = context.enemies.reduce(
            (max, e) => e.threatLevel === 'CRITICAL' ? 100 :
                       e.threatLevel === 'HIGH' ? Math.max(max, 80) :
                       e.threatLevel === 'MEDIUM' ? Math.max(max, 60) : max,
            0
          );
          goal.priority = Math.min(100, 70 + maxThreat * 0.3);
          break;
          
        case 'BUILD_MILITARY':
          // 군사력이 부족하면 우선순위 상승
          const totalEnemyPower = context.enemies.reduce(
            (sum, e) => sum + e.estimatedPower, 0
          );
          const powerRatio = context.military.combatPower / Math.max(totalEnemyPower, 1);
          goal.priority = powerRatio < 1 ? 85 : powerRatio < 1.5 ? 70 : 50;
          break;
          
        case 'ECONOMIC_GROWTH':
          // 자원이 부족하면 경제 우선순위 상승
          const resourceLow = context.resources.credits < 5000 ||
                             context.resources.minerals < 2000;
          goal.priority = resourceLow ? 75 : 55;
          break;
      }
    }
    
    // 재정렬
    state.strategicGoals.sort((a, b) => b.priority - a.priority);
  }
  
  // ============================================================
  // Resource Allocation
  // ============================================================
  
  /**
   * 자원 할당 업데이트
   */
  updateResourceAllocation(factionId: string, allocation: Partial<FactionResourceAllocation>): void {
    const state = this.factionStates.get(factionId);
    if (!state) return;
    
    state.resourceAllocation = { ...state.resourceAllocation, ...allocation };
    
    // 합계가 100%가 되도록 조정
    const total = Object.values(state.resourceAllocation).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      const factor = 100 / total;
      for (const key of Object.keys(state.resourceAllocation) as (keyof FactionResourceAllocation)[]) {
        state.resourceAllocation[key] *= factor;
      }
    }
    
    logger.debug('[FactionAI] Resource allocation updated', {
      factionId,
      allocation: state.resourceAllocation,
    });
  }
  
  /**
   * 상황에 따른 자동 자원 배분
   */
  autoAllocateResources(factionId: string, context: StrategicContext): void {
    const state = this.factionStates.get(factionId);
    if (!state) return;
    
    const personality = state.personality;
    const allocation: FactionResourceAllocation = { ...DEFAULT_RESOURCE_ALLOCATION };
    
    // 전쟁 중인 경우
    if (context.diplomacy.atWarWith.length > 0) {
      allocation.military = 50 + personality.aggression / 5;
      allocation.economy = 30 - personality.aggression / 10;
      allocation.research = 10;
      allocation.diplomacy = 5;
      allocation.reserve = 5;
    }
    
    // 평화 시
    else {
      allocation.military = 30;
      allocation.economy = 40;
      allocation.research = 20;
      allocation.diplomacy = 5;
      allocation.reserve = 5;
    }
    
    // 열세 상황 - 예비 증가
    const totalEnemyPower = context.enemies.reduce((sum, e) => sum + e.estimatedPower, 0);
    if (context.military.combatPower < totalEnemyPower * 0.8) {
      allocation.reserve = 15;
      allocation.military -= 5;
      allocation.economy -= 5;
    }
    
    this.updateResourceAllocation(factionId, allocation);
  }
  
  // ============================================================
  // Diplomacy
  // ============================================================
  
  /**
   * 외교 결정 평가
   */
  evaluateDiplomacy(factionId: string, context: StrategicContext): FactionDiplomacyDecision[] {
    const state = this.factionStates.get(factionId);
    if (!state) return [];
    
    const decisions: FactionDiplomacyDecision[] = [];
    const personality = state.personality;
    
    // 전쟁 선포 평가
    for (const enemyFaction of context.enemies) {
      // 이미 전쟁 중이면 스킵
      if (context.diplomacy.atWarWith.includes(enemyFaction.factionId)) continue;
      
      // 전력비가 충분하고 공격적이면 전쟁 고려
      const powerRatio = context.military.combatPower / Math.max(enemyFaction.estimatedPower, 1);
      
      if (powerRatio >= FACTION_AI_CONFIG.WAR_DECLARATION_THRESHOLD && 
          personality.aggression > 60) {
        decisions.push({
          type: 'DECLARE_WAR',
          targetFactionId: enemyFaction.factionId,
          urgency: personality.aggression,
          reasoning: `Power advantage (${powerRatio.toFixed(2)}x) against ${enemyFaction.factionId}`,
          expectedOutcome: 'Victory with acceptable losses',
        });
      }
    }
    
    // 평화 제안 평가
    for (const warFactionId of context.diplomacy.atWarWith) {
      const enemy = context.enemies.find(e => e.factionId === warFactionId);
      if (!enemy) continue;
      
      const powerRatio = context.military.combatPower / Math.max(enemy.estimatedPower, 1);
      
      // 열세하고 신중하면 평화 고려
      if (powerRatio <= FACTION_AI_CONFIG.PEACE_OFFER_THRESHOLD &&
          personality.caution > 60) {
        decisions.push({
          type: 'PROPOSE_PEACE',
          targetFactionId: warFactionId,
          urgency: 100 - powerRatio * 50,
          reasoning: `Disadvantageous war (${powerRatio.toFixed(2)}x power ratio)`,
          expectedOutcome: 'End hostilities, preserve forces',
        });
      }
    }
    
    // 동맹 제안 평가
    for (const neutralFactionId of context.diplomacy.neutral) {
      // 공통 적이 있으면 동맹 고려
      const hasCommonEnemy = context.diplomacy.atWarWith.some(
        warFactionId => true // 실제로는 중립 진영도 해당 적과 전쟁 중인지 체크
      );
      
      if (hasCommonEnemy && personality.loyalty > 50) {
        decisions.push({
          type: 'FORM_ALLIANCE',
          targetFactionId: neutralFactionId,
          urgency: 50,
          reasoning: 'Common enemy exists',
          expectedOutcome: 'Mutual defense pact',
        });
      }
    }
    
    state.pendingDiplomacy = decisions;
    return decisions;
  }
  
  // ============================================================
  // War Planning
  // ============================================================
  
  /**
   * 전쟁 계획 수립
   */
  createWarPlan(
    factionId: string,
    enemyFactionId: string,
    context: StrategicContext
  ): FactionWarPlan | null {
    const state = this.factionStates.get(factionId);
    if (!state) return null;
    
    const enemy = context.enemies.find(e => e.factionId === enemyFactionId);
    if (!enemy) return null;
    
    const powerRatio = context.military.combatPower / Math.max(enemy.estimatedPower, 1);
    
    // 전쟁 단계 결정
    let phase: FactionWarPlan['phase'];
    if (powerRatio > 1.5) phase = 'OFFENSIVE';
    else if (powerRatio > 1.0) phase = 'PREPARATION';
    else if (powerRatio > 0.7) phase = 'STALEMATE';
    else phase = 'DEFENSIVE';
    
    // 목표 설정
    const objectives: FactionAIGoal[] = [];
    
    // @ts-ignore - OFFENSIVE is determined dynamically but not in phase type
    if (phase === 'OFFENSIVE') {
      // 적 영토 점령 목표
      for (const planetId of enemy.knownPlanets.slice(0, 3)) {
        objectives.push({
          type: 'CONQUER_SYSTEM',
          priority: 80,
          targetId: planetId,
          progress: 0,
        });
      }
    }
    
    // 적 함대 격파 목표
    objectives.push({
      type: 'DESTROY_ENEMY_FLEET',
      priority: 90,
      targetId: enemyFactionId,
      progress: 0,
    });
    
    // 방어 목표
    objectives.push({
      type: 'DEFEND_TERRITORY',
      priority: 85,
      progress: 0,
    });
    
    // 성공 확률 계산
    const successProbability = Math.min(95, Math.max(5, powerRatio * 50));
    
    // 예상 기간 계산
    const estimatedDuration = Math.ceil(100 / (powerRatio * 10));
    
    const warPlan: FactionWarPlan = {
      warId: `war_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      enemyFactionId,
      phase,
      objectives,
      assignedFleets: context.military.idleFleets.slice(0, 3),
      estimatedDuration,
      successProbability,
    };
    
    // 기존 전쟁 계획 교체
    state.activeWarPlans = state.activeWarPlans.filter(
      wp => wp.enemyFactionId !== enemyFactionId
    );
    state.activeWarPlans.push(warPlan);
    
    logger.info('[FactionAI] War plan created', {
      factionId,
      enemyFactionId,
      phase,
      successProbability,
    });
    
    this.emit('WAR_PLAN_CREATED', warPlan);
    
    return warPlan;
  }
  
  /**
   * 전쟁 계획 업데이트
   */
  updateWarPlan(factionId: string, warId: string, context: StrategicContext): void {
    const state = this.factionStates.get(factionId);
    if (!state) return;
    
    const warPlan = state.activeWarPlans.find(wp => wp.warId === warId);
    if (!warPlan) return;
    
    const enemy = context.enemies.find(e => e.factionId === warPlan.enemyFactionId);
    if (!enemy) return;
    
    const powerRatio = context.military.combatPower / Math.max(enemy.estimatedPower, 1);
    
    // 전쟁 단계 재평가
    const oldPhase = warPlan.phase;
    
    if (powerRatio > 2.0) {
      warPlan.phase = 'VICTORY_PUSH';
    } else if (powerRatio > 1.3) {
      warPlan.phase = 'OFFENSIVE';
    } else if (powerRatio > 0.8) {
      warPlan.phase = 'STALEMATE';
    } else if (powerRatio > 0.5) {
      warPlan.phase = 'DEFENSIVE';
    } else {
      warPlan.phase = 'RETREAT';
    }
    
    // 성공 확률 재계산
    warPlan.successProbability = Math.min(95, Math.max(5, powerRatio * 50));
    
    if (oldPhase !== warPlan.phase) {
      logger.info('[FactionAI] War plan phase changed', {
        warId,
        oldPhase,
        newPhase: warPlan.phase,
      });
      
      this.emit('WAR_PLAN_UPDATED', warPlan);
    }
  }
  
  // ============================================================
  // Main Evaluation
  // ============================================================
  
  /**
   * 진영 AI 전체 평가
   */
  async evaluateFaction(
    factionId: string,
    context: StrategicContext,
    currentTick: number
  ): Promise<FactionEvaluationResult> {
    const state = this.factionStates.get(factionId);
    
    if (!state) {
      return {
        factionId,
        goalsUpdated: 0,
        decisionsGenerated: [],
        warPlanChanges: [],
        diplomacyActions: [],
      };
    }
    
    // 평가 주기 체크
    if (currentTick - state.lastEvaluationTick < FACTION_AI_CONFIG.GOAL_EVAL_INTERVAL) {
      return {
        factionId,
        goalsUpdated: 0,
        decisionsGenerated: [],
        warPlanChanges: [],
        diplomacyActions: [],
      };
    }
    
    state.lastEvaluationTick = currentTick;
    
    const result: FactionEvaluationResult = {
      factionId,
      goalsUpdated: 0,
      decisionsGenerated: [],
      warPlanChanges: [],
      diplomacyActions: [],
    };
    
    // 1. 목표 우선순위 재조정
    this.reprioritizeGoals(factionId, context);
    result.goalsUpdated = state.strategicGoals.length;
    
    // 2. 자원 자동 배분
    this.autoAllocateResources(factionId, context);
    
    // 3. 외교 평가
    result.diplomacyActions = this.evaluateDiplomacy(factionId, context);
    
    // 4. 전쟁 계획 업데이트
    for (const warPlan of state.activeWarPlans) {
      this.updateWarPlan(factionId, warPlan.warId, context);
      result.warPlanChanges.push(warPlan.warId);
    }
    
    // 5. 새 전쟁 계획 생성 (전쟁 선포 결정이 있는 경우)
    for (const diplomacy of result.diplomacyActions) {
      if (diplomacy.type === 'DECLARE_WAR') {
        const warPlan = this.createWarPlan(factionId, diplomacy.targetFactionId, context);
        if (warPlan) {
          result.warPlanChanges.push(warPlan.warId);
        }
      }
    }
    
    // 6. 전략 결정 생성
    result.decisionsGenerated = this.generateStrategicDecisions(factionId, context);
    
    state.totalDecisions += result.decisionsGenerated.length;
    
    logger.debug('[FactionAI] Evaluation complete', {
      factionId,
      goalsUpdated: result.goalsUpdated,
      decisions: result.decisionsGenerated.length,
      warPlans: result.warPlanChanges.length,
    });
    
    return result;
  }
  
  /**
   * 전략 결정 생성
   */
  private generateStrategicDecisions(
    factionId: string,
    context: StrategicContext
  ): StrategicDecision[] {
    const state = this.factionStates.get(factionId);
    if (!state) return [];
    
    const decisions: StrategicDecision[] = [];
    
    // 최우선 목표 기반 결정
    const topGoals = state.strategicGoals.slice(0, 3);
    
    for (const goal of topGoals) {
      const decision = this.goalToDecision(goal, context, state);
      if (decision) {
        decisions.push(decision);
      }
    }
    
    // 전쟁 계획 기반 결정
    for (const warPlan of state.activeWarPlans) {
      const warDecisions = this.warPlanToDecisions(warPlan, context, state);
      decisions.push(...warDecisions);
    }
    
    return decisions;
  }
  
  /**
   * 목표를 전략 결정으로 변환
   */
  private goalToDecision(
    goal: FactionAIGoal,
    context: StrategicContext,
    state: FactionAIState
  ): StrategicDecision | null {
    switch (goal.type) {
      case 'CONQUER_SYSTEM':
        if (context.military.idleFleets.length > 0) {
          return {
            type: 'ATTACK',
            priority: goal.priority,
            target: goal.targetId,
            fleetIds: context.military.idleFleets.slice(0, 2),
            reasoning: `Pursuing goal: Conquer ${goal.targetId}`,
          };
        }
        break;
        
      case 'DEFEND_TERRITORY':
        if (context.territory.frontlineSystems.length > 0) {
          return {
            type: 'DEFEND',
            priority: goal.priority,
            target: context.territory.frontlineSystems[0],
            fleetIds: context.military.idleFleets.slice(0, 1),
            reasoning: 'Defending border systems',
          };
        }
        break;
        
      case 'BUILD_MILITARY':
        return {
          type: 'BUILD_FLEET',
          priority: goal.priority,
          parameters: {
            shipClass: 'cruiser',
            count: 5,
          },
          reasoning: 'Building military strength',
        };
        
      case 'ECONOMIC_GROWTH':
        if (context.territory.ownedPlanets.length > 0) {
          return {
            type: 'BUILD_FACILITY',
            priority: goal.priority,
            target: context.territory.ownedPlanets[0],
            parameters: {
              facilityType: 'factory',
            },
            reasoning: 'Economic development',
          };
        }
        break;
    }
    
    return null;
  }
  
  /**
   * 전쟁 계획을 전략 결정들로 변환
   */
  private warPlanToDecisions(
    warPlan: FactionWarPlan,
    context: StrategicContext,
    state: FactionAIState
  ): StrategicDecision[] {
    const decisions: StrategicDecision[] = [];
    
    switch (warPlan.phase) {
      case 'OFFENSIVE':
      case 'VICTORY_PUSH':
        // 공세 결정
        const enemy = context.enemies.find(e => e.factionId === warPlan.enemyFactionId);
        if (enemy && enemy.knownPlanets.length > 0) {
          decisions.push({
            type: 'ATTACK',
            priority: 85,
            target: enemy.knownPlanets[0],
            fleetIds: warPlan.assignedFleets,
            reasoning: `War plan ${warPlan.warId}: Offensive against ${warPlan.enemyFactionId}`,
          });
        }
        break;
        
      case 'DEFENSIVE':
      case 'RETREAT':
        // 방어 결정
        if (context.territory.frontlineSystems.length > 0) {
          decisions.push({
            type: 'DEFEND',
            priority: 90,
            target: context.territory.frontlineSystems[0],
            fleetIds: warPlan.assignedFleets,
            reasoning: `War plan ${warPlan.warId}: Defensive posture`,
          });
        }
        break;
        
      case 'STALEMATE':
        // 증원 결정
        decisions.push({
          type: 'REINFORCE',
          priority: 75,
          target: context.territory.frontlineSystems[0],
          fleetIds: context.military.idleFleets.slice(0, 1),
          reasoning: `War plan ${warPlan.warId}: Reinforcing stalemate`,
        });
        break;
    }
    
    return decisions;
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 정리
   */
  destroy(): void {
    this.factionStates.clear();
    this.removeAllListeners();
    logger.info('[FactionAI] Controller destroyed');
  }
}

// Singleton export
export const factionAIController = new FactionAIController();

