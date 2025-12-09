/**
 * NPC AI Service
 * 
 * NPC 캐릭터의 AI 행동을 관리합니다:
 * - NPC 성격 유형 (공격적/방어적/균형)
 * - NPC 목표 설정
 * - NPC 의사결정 트리
 * - 플레이어와 상호작용
 */

import { EventEmitter } from 'events';
import {
  AIPersonalityType,
  NPCBehavior,
  AIPersonality,
  BehaviorStatus,
  TacticalDecision,
  StrategicDecision,
  AI_CONFIG,
  PERSONALITY_PRESETS,
} from '../../../types/gin7/npc-ai.types';
import {
  BehaviorTree,
  createBehaviorTree,
} from '../../../core/gin7/ai/BehaviorTree';
import { logger } from '../../../common/logger';

// ============================================================
// Types
// ============================================================

export interface NPCGoal {
  id: string;
  type: NPCGoalType;
  priority: number;           // 1-100
  target?: string;
  parameters?: Record<string, unknown>;
  progress: number;           // 0-100
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  deadline?: number;          // tick deadline
}

export type NPCGoalType =
  | 'SURVIVE'
  | 'ATTACK_TARGET'
  | 'DEFEND_LOCATION'
  | 'PATROL'
  | 'ESCORT'
  | 'GATHER_RESOURCES'
  | 'TRADE'
  | 'EXPLORE'
  | 'FLEE';

export interface NPCState {
  npcId: string;
  sessionId: string;
  factionId: string;
  behavior: NPCBehavior;
  currentGoals: NPCGoal[];
  relationshipWithPlayers: Map<string, NPCRelationship>;
  lastDecision?: TacticalDecision | StrategicDecision;
  lastDecisionTick: number;
}

export interface NPCRelationship {
  playerId: string;
  reputation: number;         // -100 to 100
  tradeHistory: number;       // 거래 횟수
  combatHistory: number;      // 전투 횟수
  lastInteraction: Date;
}

export interface NPCDecisionContext {
  npcState: NPCState;
  visibleEnemies: string[];
  visibleAllies: string[];
  nearbyResources: string[];
  currentHp: number;
  currentMorale: number;
  currentTick: number;
}

// ============================================================
// NPC Behavior Presets
// ============================================================

export const NPC_BEHAVIOR_PRESETS: Record<AIPersonalityType, NPCBehavior> = {
  [AIPersonalityType.AGGRESSIVE]: {
    personality: AIPersonalityType.AGGRESSIVE,
    priorities: ['ATTACK', 'ELIMINATE', 'DOMINATE'],
    riskTolerance: 80,
    preferredTactics: ['CHARGE', 'FOCUS_FIRE', 'FLANK'],
  },
  [AIPersonalityType.DEFENSIVE]: {
    personality: AIPersonalityType.DEFENSIVE,
    priorities: ['SURVIVE', 'PROTECT', 'HOLD'],
    riskTolerance: 30,
    preferredTactics: ['DEFENSIVE_FORMATION', 'COUNTERATTACK', 'RETREAT'],
  },
  [AIPersonalityType.BALANCED]: {
    personality: AIPersonalityType.BALANCED,
    priorities: ['ADAPT', 'OBJECTIVE', 'EFFICIENCY'],
    riskTolerance: 50,
    preferredTactics: ['ADAPT', 'MANEUVER', 'FOCUS_FIRE'],
  },
  [AIPersonalityType.CAUTIOUS]: {
    personality: AIPersonalityType.CAUTIOUS,
    priorities: ['SURVIVE', 'AVOID_RISK', 'OBSERVE'],
    riskTolerance: 20,
    preferredTactics: ['EVADE', 'DEFENSIVE_FORMATION', 'RETREAT'],
  },
  [AIPersonalityType.RECKLESS]: {
    personality: AIPersonalityType.RECKLESS,
    priorities: ['ATTACK', 'GLORY', 'NO_RETREAT'],
    riskTolerance: 95,
    preferredTactics: ['CHARGE', 'ALL_OUT_ATTACK', 'IGNORE_DEFENSE'],
  },
};

// ============================================================
// NPC AI Service
// ============================================================

export class NPCAIService extends EventEmitter {
  private npcStates: Map<string, NPCState> = new Map();
  private decisionTree: BehaviorTree;
  
  constructor() {
    super();
    this.decisionTree = this.buildDecisionTree();
  }
  
  // ============================================================
  // NPC Management
  // ============================================================
  
  /**
   * NPC 등록
   */
  registerNPC(
    npcId: string,
    sessionId: string,
    factionId: string,
    personalityType: AIPersonalityType = AIPersonalityType.BALANCED,
    customBehavior?: Partial<NPCBehavior>
  ): NPCState {
    const baseBehavior = NPC_BEHAVIOR_PRESETS[personalityType];
    const behavior: NPCBehavior = {
      ...baseBehavior,
      ...customBehavior,
    };
    
    const state: NPCState = {
      npcId,
      sessionId,
      factionId,
      behavior,
      currentGoals: [],
      relationshipWithPlayers: new Map(),
      lastDecisionTick: 0,
    };
    
    this.npcStates.set(npcId, state);
    
    logger.info('[NPCAI] NPC registered', {
      npcId,
      personality: personalityType,
    });
    
    return state;
  }
  
  /**
   * NPC 등록 해제
   */
  unregisterNPC(npcId: string): void {
    this.npcStates.delete(npcId);
    logger.info('[NPCAI] NPC unregistered', { npcId });
  }
  
  /**
   * NPC 상태 가져오기
   */
  getNPCState(npcId: string): NPCState | undefined {
    return this.npcStates.get(npcId);
  }
  
  // ============================================================
  // Goal Management
  // ============================================================
  
  /**
   * NPC에 목표 추가
   */
  addGoal(npcId: string, goal: Omit<NPCGoal, 'id' | 'createdAt' | 'status' | 'progress'>): NPCGoal | null {
    const state = this.npcStates.get(npcId);
    if (!state) return null;
    
    const newGoal: NPCGoal = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'PENDING',
      createdAt: new Date(),
    };
    
    // 우선순위에 따라 정렬하여 삽입
    state.currentGoals.push(newGoal);
    state.currentGoals.sort((a, b) => b.priority - a.priority);
    
    logger.debug('[NPCAI] Goal added', {
      npcId,
      goalId: newGoal.id,
      type: newGoal.type,
    });
    
    return newGoal;
  }
  
  /**
   * 목표 완료 처리
   */
  completeGoal(npcId: string, goalId: string): void {
    const state = this.npcStates.get(npcId);
    if (!state) return;
    
    const goal = state.currentGoals.find(g => g.id === goalId);
    if (goal) {
      goal.status = 'COMPLETED';
      goal.progress = 100;
      
      this.emit('GOAL_COMPLETED', { npcId, goal });
      
      logger.debug('[NPCAI] Goal completed', { npcId, goalId });
    }
  }
  
  /**
   * 목표 실패 처리
   */
  failGoal(npcId: string, goalId: string, reason?: string): void {
    const state = this.npcStates.get(npcId);
    if (!state) return;
    
    const goal = state.currentGoals.find(g => g.id === goalId);
    if (goal) {
      goal.status = 'FAILED';
      
      this.emit('GOAL_FAILED', { npcId, goal, reason });
      
      logger.debug('[NPCAI] Goal failed', { npcId, goalId, reason });
    }
  }
  
  /**
   * 현재 활성 목표 가져오기
   */
  getActiveGoal(npcId: string): NPCGoal | null {
    const state = this.npcStates.get(npcId);
    if (!state) return null;
    
    // 가장 높은 우선순위의 ACTIVE 또는 PENDING 목표
    return state.currentGoals.find(
      g => g.status === 'ACTIVE' || g.status === 'PENDING'
    ) || null;
  }
  
  // ============================================================
  // Decision Making
  // ============================================================
  
  /**
   * NPC 의사결정 수행
   */
  makeDecision(context: NPCDecisionContext): TacticalDecision | null {
    const { npcState } = context;
    
    // 결정 쿨다운 체크
    if (context.currentTick - npcState.lastDecisionTick < AI_CONFIG.TACTICAL_EVAL_INTERVAL) {
      return null;
    }
    
    // 행동 트리 실행
    const blackboard = this.createBlackboard(context) as any;
    const status = this.decisionTree.tick(blackboard);
    
    // 결정 추출
    const decision = (blackboard.tempData as Map<string, unknown>)?.get('decision') as TacticalDecision | undefined;
    
    if (decision) {
      npcState.lastDecision = decision;
      npcState.lastDecisionTick = context.currentTick;
      
      this.emit('DECISION_MADE', {
        npcId: npcState.npcId,
        decision,
      });
    }
    
    return decision || null;
  }
  
  /**
   * 상황에 따른 즉각 반응 결정
   */
  makeReactiveDecision(context: NPCDecisionContext): TacticalDecision | null {
    const { npcState, visibleEnemies, currentHp } = context;
    const behavior = npcState.behavior;
    
    // 위기 상황 체크
    const isInDanger = currentHp < 30 || visibleEnemies.length > 3;
    
    if (isInDanger) {
      // 성격에 따른 반응
      switch (behavior.personality) {
        case AIPersonalityType.CAUTIOUS:
        case AIPersonalityType.DEFENSIVE:
          return this.createRetreatDecision(npcState);
          
        case AIPersonalityType.RECKLESS:
          return this.createChargeDecision(npcState, visibleEnemies[0]);
          
        case AIPersonalityType.AGGRESSIVE:
          if (currentHp > 20) {
            return this.createFocusFireDecision(npcState, visibleEnemies[0]);
          }
          return this.createDefendDecision(npcState);
          
        case AIPersonalityType.BALANCED:
        default:
          if (currentHp > 40) {
            return this.createDefendDecision(npcState);
          }
          return this.createRetreatDecision(npcState);
      }
    }
    
    return null;
  }
  
  // ============================================================
  // Blackboard & Decision Tree
  // ============================================================
  
  /**
   * 블랙보드 생성
   */
  private createBlackboard(context: NPCDecisionContext): Record<string, unknown> {
    return {
      npcState: context.npcState,
      visibleEnemies: context.visibleEnemies,
      visibleAllies: context.visibleAllies,
      nearbyResources: context.nearbyResources,
      currentHp: context.currentHp,
      currentMorale: context.currentMorale,
      currentTick: context.currentTick,
      tempData: new Map<string, unknown>(),
    };
  }
  
  /**
   * 의사결정 트리 구축
   */
  private buildDecisionTree(): BehaviorTree {
    return createBehaviorTree('npc-ai', 'NPC Decision Tree')
      .selector('Main NPC Selector')
        // 1. 생존 체크 (최우선)
        .sequence('Survival Check')
          .condition('Is Low HP?', (bb: any) => bb.currentHp < 25)
          .action('Retreat', (bb: any) => {
            const decision = this.createRetreatDecision(bb.npcState);
            bb.tempData.set('decision', decision);
            return BehaviorStatus.SUCCESS;
          })
        .end()
        
        // 2. 목표 기반 행동
        .sequence('Goal-Based Action')
          .condition('Has Active Goal?', (bb: any) => {
            const goal = this.getActiveGoal(bb.npcState.npcId);
            bb.tempData.set('activeGoal', goal);
            return goal !== null;
          })
          .action('Pursue Goal', (bb: any) => {
            const goal = bb.tempData.get('activeGoal') as NPCGoal;
            const decision = this.createGoalDecision(bb.npcState, goal, bb);
            bb.tempData.set('decision', decision);
            return decision ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
          })
        .end()
        
        // 3. 적 대응
        .sequence('Enemy Response')
          .condition('Enemies Visible?', (bb: any) => bb.visibleEnemies.length > 0)
          .selector('Combat Decision')
            .sequence('Aggressive Response')
              .condition('Is Aggressive?', (bb: any) => 
                bb.npcState.behavior.riskTolerance > 60)
              .action('Attack', (bb: any) => {
                const decision = this.createAttackDecision(bb.npcState, bb.visibleEnemies[0]);
                bb.tempData.set('decision', decision);
                return BehaviorStatus.SUCCESS;
              })
            .end()
            .action('Defensive Response', (bb: any) => {
              const decision = this.createDefendDecision(bb.npcState);
              bb.tempData.set('decision', decision);
              return BehaviorStatus.SUCCESS;
            })
          .end()
        .end()
        
        // 4. 기본 행동 (순찰)
        .action('Default Patrol', (bb: any) => {
          const decision = this.createPatrolDecision(bb.npcState);
          bb.tempData.set('decision', decision);
          return BehaviorStatus.SUCCESS;
        })
      .end()
      .build();
  }
  
  // ============================================================
  // Decision Creators
  // ============================================================
  
  /**
   * 퇴각 결정 생성
   */
  private createRetreatDecision(npcState: NPCState): TacticalDecision {
    return {
      type: 'RETREAT',
      unitIds: [npcState.npcId],
      energyDistribution: {
        beam: 5,
        gun: 5,
        shield: 30,
        engine: 25,
        warp: 30,
        sensor: 5,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Retreating for survival`,
    };
  }
  
  /**
   * 돌격 결정 생성
   */
  private createChargeDecision(npcState: NPCState, targetId?: string): TacticalDecision {
    return {
      type: 'CHARGE',
      unitIds: [npcState.npcId],
      target: targetId,
      energyDistribution: {
        beam: 40,
        gun: 35,
        shield: 10,
        engine: 10,
        warp: 0,
        sensor: 5,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Charging at enemy`,
    };
  }
  
  /**
   * 집중 사격 결정 생성
   */
  private createFocusFireDecision(npcState: NPCState, targetId?: string): TacticalDecision {
    return {
      type: 'FOCUS_FIRE',
      unitIds: [npcState.npcId],
      target: targetId,
      energyDistribution: {
        beam: 35,
        gun: 30,
        shield: 15,
        engine: 10,
        warp: 0,
        sensor: 10,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Focus fire on target`,
    };
  }
  
  /**
   * 방어 결정 생성
   */
  private createDefendDecision(npcState: NPCState): TacticalDecision {
    return {
      type: 'CHANGE_FORMATION',
      unitIds: [npcState.npcId],
      formation: 'DEFENSIVE',
      energyDistribution: {
        beam: 15,
        gun: 15,
        shield: 40,
        engine: 15,
        warp: 10,
        sensor: 5,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Defensive stance`,
    };
  }
  
  /**
   * 공격 결정 생성
   */
  private createAttackDecision(npcState: NPCState, targetId?: string): TacticalDecision {
    return {
      type: 'ATTACK_TARGET',
      unitIds: [npcState.npcId],
      target: targetId,
      energyDistribution: {
        beam: 30,
        gun: 25,
        shield: 20,
        engine: 15,
        warp: 0,
        sensor: 10,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Attacking target`,
    };
  }
  
  /**
   * 순찰 결정 생성
   */
  private createPatrolDecision(npcState: NPCState): TacticalDecision {
    // 랜덤 순찰 위치
    const patrolTarget = {
      x: Math.random() * 10000 - 5000,
      y: 0,
      z: Math.random() * 10000 - 5000,
    };
    
    return {
      type: 'MOVE_POSITION',
      unitIds: [npcState.npcId],
      target: patrolTarget,
      energyDistribution: {
        beam: 10,
        gun: 10,
        shield: 25,
        engine: 30,
        warp: 0,
        sensor: 25,
      },
      reasoning: `[NPCAI ${npcState.npcId}] Patrolling`,
    };
  }
  
  /**
   * 목표 기반 결정 생성
   */
  private createGoalDecision(
    npcState: NPCState,
    goal: NPCGoal,
    blackboard: any
  ): TacticalDecision | null {
    switch (goal.type) {
      case 'ATTACK_TARGET':
        return this.createAttackDecision(npcState, goal.target);
        
      case 'DEFEND_LOCATION':
        return this.createDefendDecision(npcState);
        
      case 'FLEE':
        return this.createRetreatDecision(npcState);
        
      case 'PATROL':
        return this.createPatrolDecision(npcState);
        
      case 'SURVIVE':
        if (blackboard.currentHp < 50) {
          return this.createDefendDecision(npcState);
        }
        return null;
        
      default:
        return null;
    }
  }
  
  // ============================================================
  // Player Interaction
  // ============================================================
  
  /**
   * 플레이어와의 관계 업데이트
   */
  updateRelationship(
    npcId: string,
    playerId: string,
    reputationChange: number,
    interactionType: 'TRADE' | 'COMBAT' | 'DIPLOMACY'
  ): void {
    const state = this.npcStates.get(npcId);
    if (!state) return;
    
    let relationship = state.relationshipWithPlayers.get(playerId);
    
    if (!relationship) {
      relationship = {
        playerId,
        reputation: 0,
        tradeHistory: 0,
        combatHistory: 0,
        lastInteraction: new Date(),
      };
      state.relationshipWithPlayers.set(playerId, relationship);
    }
    
    // 평판 업데이트 (-100 ~ 100 범위 유지)
    relationship.reputation = Math.max(
      -100,
      Math.min(100, relationship.reputation + reputationChange)
    );
    
    // 상호작용 기록
    switch (interactionType) {
      case 'TRADE':
        relationship.tradeHistory++;
        break;
      case 'COMBAT':
        relationship.combatHistory++;
        break;
    }
    
    relationship.lastInteraction = new Date();
    
    this.emit('RELATIONSHIP_UPDATED', {
      npcId,
      playerId,
      relationship,
    });
  }
  
  /**
   * 플레이어에 대한 NPC 반응 결정
   */
  getReactionToPlayer(npcId: string, playerId: string): 'HOSTILE' | 'NEUTRAL' | 'FRIENDLY' {
    const state = this.npcStates.get(npcId);
    if (!state) return 'NEUTRAL';
    
    const relationship = state.relationshipWithPlayers.get(playerId);
    if (!relationship) return 'NEUTRAL';
    
    if (relationship.reputation >= 50) return 'FRIENDLY';
    if (relationship.reputation <= -50) return 'HOSTILE';
    return 'NEUTRAL';
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 정리
   */
  destroy(): void {
    this.npcStates.clear();
    this.removeAllListeners();
    logger.info('[NPCAI] Service destroyed');
  }
}

// Singleton export
export const npcAIService = new NPCAIService();





