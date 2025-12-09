/**
 * NPC AI Services Index
 * 
 * AI 시스템 모듈:
 * - StrategicAI: 전략적 결정 (침공, 방어, 내정)
 * - TacticalAI: 전술적 결정 (진형, 타겟팅, 에너지)
 * - NPCFactionController: NPC 진영 AI 컨트롤러
 * - OfflineAIService: 오프라인 플레이어 AI
 * - NPCAIService: 범용 NPC AI
 * - FactionAIController: 진영 AI 확장 (목표, 자원, 외교, 전쟁 계획)
 * - AdmiralPersonalityService: 제독 성격 시스템
 */

// Re-export all modules
export * from './StrategicAI';
export * from './TacticalAI';
export * from './NPCFactionController';
export * from './OfflineAIService';
export * from './NPCAIService';
export * from './FactionAIController';
export * from './AdmiralPersonalityService';

// Strategic AI
import { strategicAIService, StrategicAIService } from './StrategicAI';

// Tactical AI
import { tacticalAIService, TacticalAIService } from './TacticalAI';

// NPC Faction Controller
import { 
  NPCFactionController, 
  npcControllerManager, 
  NPCControllerConfig, 
  AIExecutionResult 
} from './NPCFactionController';

// Offline AI Service
import {
  OfflineAIService,
  offlineAIService,
  OfflinePlayerConfig,
  OfflineEvaluationResult,
  DEFAULT_OFFLINE_MODE,
  OFFLINE_CONFIG,
} from './OfflineAIService';

// NPC AI Service
import {
  NPCAIService,
  npcAIService,
  NPCGoal,
  NPCGoalType,
  NPCState,
  NPCRelationship,
  NPCDecisionContext,
  NPC_BEHAVIOR_PRESETS,
} from './NPCAIService';

// Faction AI Controller
import {
  FactionAIController,
  factionAIController,
  FactionAIState,
  FactionEvaluationResult,
  DEFAULT_RESOURCE_ALLOCATION,
  FACTION_AI_CONFIG,
} from './FactionAIController';

// Admiral Personality Service
import {
  AdmiralPersonalityService,
  admiralPersonalityService,
  HISTORICAL_ADMIRALS,
} from './AdmiralPersonalityService';

// Named exports
export {
  // Strategic AI
  strategicAIService,
  StrategicAIService,
  
  // Tactical AI
  tacticalAIService,
  TacticalAIService,
  
  // NPC Faction Controller
  NPCFactionController,
  npcControllerManager,
  
  // Offline AI
  OfflineAIService,
  offlineAIService,
  DEFAULT_OFFLINE_MODE,
  OFFLINE_CONFIG,
  
  // NPC AI
  NPCAIService,
  npcAIService,
  NPC_BEHAVIOR_PRESETS,
  
  // Faction AI
  FactionAIController,
  factionAIController,
  DEFAULT_RESOURCE_ALLOCATION,
  FACTION_AI_CONFIG,
  
  // Admiral Personality
  AdmiralPersonalityService,
  admiralPersonalityService,
  HISTORICAL_ADMIRALS,
};

// Type exports
export type { 
  NPCControllerConfig, 
  AIExecutionResult,
  OfflinePlayerConfig,
  OfflineEvaluationResult,
  NPCGoal,
  NPCGoalType,
  NPCState,
  NPCRelationship,
  NPCDecisionContext,
  FactionAIState,
  FactionEvaluationResult,
};









