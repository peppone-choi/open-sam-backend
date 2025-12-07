/**
 * NPC AI Services Index
 */

export * from './StrategicAI';
export * from './TacticalAI';
export * from './NPCFactionController';

import { strategicAIService, StrategicAIService } from './StrategicAI';
import { tacticalAIService, TacticalAIService } from './TacticalAI';
import { 
  NPCFactionController, 
  npcControllerManager, 
  NPCControllerConfig, 
  AIExecutionResult 
} from './NPCFactionController';

export {
  strategicAIService,
  StrategicAIService,
  tacticalAIService,
  TacticalAIService,
  NPCFactionController,
  npcControllerManager,
};

export type { NPCControllerConfig, AIExecutionResult };








