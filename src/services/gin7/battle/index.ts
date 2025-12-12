/**
 * Battle module exports
 */
export * from './RealtimeBattleEngine';
export { default as RealtimeBattleEngine } from './RealtimeBattleEngine';
export * from './BattleLogService';
export { default as BattleLogService } from './BattleLogService';
export * from './BattleAIService';
export { default as BattleAIService } from './BattleAIService';
export * from './BattleInitiationService';
export { battleInitiationService } from './BattleInitiationService';
export * from './BattleResultService';
export { battleResultService } from './BattleResultService';

// Phase 2: AI Delegation exports
export * from './AIProfileService';
export { aiProfileService } from './AIProfileService';
export * from './AIBattleController';
export { default as AIBattleController } from './AIBattleController';
export * from './DelegationService';
export { delegationService } from './DelegationService';

// Phase 3: Supply & Time Limit exports
export * from './BattleTimeLimitService';
export { battleTimeLimitService } from './BattleTimeLimitService';

// Phase 4: Advanced Features exports
export * from './ReinforcementService';
export { reinforcementService } from './ReinforcementService';
export * from './RetreatService';
export { retreatService } from './RetreatService';
export * from './PlanetaryBattleService';
export { planetaryBattleService } from './PlanetaryBattleService';
export * from './GroundCombatEngine';
export { groundCombatEngine } from './GroundCombatEngine';
