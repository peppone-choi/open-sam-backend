/**
 * NPC Faction Model
 * NPC 진영의 AI 상태와 설정을 저장합니다.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { 
  AIPersonality, 
  NPCFactionState,
  PERSONALITY_PRESETS,
} from '../../types/gin7/npc-ai.types';

// ============================================================
// Interfaces
// ============================================================

export interface INPCFaction extends Document {
  factionId: string;
  sessionId: string;
  
  // AI 설정
  aiEnabled: boolean;
  aiDifficulty: 'EASY' | 'NORMAL' | 'HARD' | 'BRUTAL';
  personalityPresetId: string;
  personality: AIPersonality;
  
  // AI 트리 ID
  strategicTreeId: string;
  tacticalTreeId: string;
  
  // 통계
  stats: {
    decisionsTotal: number;
    attacksLaunched: number;
    defensesOrdered: number;
    battlesWon: number;
    battlesLost: number;
    planetsConquered: number;
    planetsLost: number;
  };
  
  // 메타데이터
  lastTickProcessed: number;
  lastEvaluationTime: Date;
  data: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Schema
// ============================================================

const AIPersonalitySchema = new Schema<AIPersonality>({
  aggression: { type: Number, default: 50, min: 0, max: 100 },
  caution: { type: Number, default: 50, min: 0, max: 100 },
  creativity: { type: Number, default: 50, min: 0, max: 100 },
  loyalty: { type: Number, default: 100, min: 0, max: 100 },
  patience: { type: Number, default: 50, min: 0, max: 100 },
  prefersFlanking: { type: Boolean, default: false },
  prefersDefensive: { type: Boolean, default: false },
  prefersGuerrilla: { type: Boolean, default: false },
  willRetreat: { type: Boolean, default: true },
  acceptsSurrender: { type: Boolean, default: true },
}, { _id: false });

const NPCFactionSchema = new Schema<INPCFaction>({
  factionId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  aiEnabled: { type: Boolean, default: true },
  aiDifficulty: { 
    type: String, 
    enum: ['EASY', 'NORMAL', 'HARD', 'BRUTAL'],
    default: 'NORMAL',
  },
  personalityPresetId: { type: String, default: 'BALANCED_AI' },
  personality: { type: AIPersonalitySchema, required: true },
  
  strategicTreeId: { type: String, default: 'strategic-ai' },
  tacticalTreeId: { type: String, default: 'tactical-ai' },
  
  stats: {
    decisionsTotal: { type: Number, default: 0 },
    attacksLaunched: { type: Number, default: 0 },
    defensesOrdered: { type: Number, default: 0 },
    battlesWon: { type: Number, default: 0 },
    battlesLost: { type: Number, default: 0 },
    planetsConquered: { type: Number, default: 0 },
    planetsLost: { type: Number, default: 0 },
  },
  
  lastTickProcessed: { type: Number, default: 0 },
  lastEvaluationTime: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// Indexes
NPCFactionSchema.index({ factionId: 1, sessionId: 1 }, { unique: true });
NPCFactionSchema.index({ sessionId: 1, aiEnabled: 1 });

// ============================================================
// Static Methods
// ============================================================

NPCFactionSchema.statics.createWithPreset = async function(
  sessionId: string,
  factionId: string,
  presetId: string = 'BALANCED_AI',
  difficulty: INPCFaction['aiDifficulty'] = 'NORMAL'
): Promise<INPCFaction> {
  const preset = PERSONALITY_PRESETS[presetId] || PERSONALITY_PRESETS.BALANCED_AI;
  
  return this.create({
    sessionId,
    factionId,
    aiEnabled: true,
    aiDifficulty: difficulty,
    personalityPresetId: presetId,
    personality: { ...preset.personality },
  });
};

NPCFactionSchema.statics.findBySession = function(sessionId: string) {
  return this.find({ sessionId, aiEnabled: true });
};

// ============================================================
// Instance Methods
// ============================================================

NPCFactionSchema.methods.setPersonalityPreset = function(presetId: string): void {
  const preset = PERSONALITY_PRESETS[presetId];
  if (preset) {
    this.personalityPresetId = presetId;
    this.personality = { ...preset.personality };
  }
};

NPCFactionSchema.methods.incrementStat = function(
  statKey: keyof INPCFaction['stats'],
  amount: number = 1
): void {
  this.stats[statKey] = (this.stats[statKey] || 0) + amount;
};

// ============================================================
// Export
// ============================================================

interface INPCFactionModel extends Model<INPCFaction> {
  createWithPreset(
    sessionId: string,
    factionId: string,
    presetId?: string,
    difficulty?: INPCFaction['aiDifficulty']
  ): Promise<INPCFaction>;
  findBySession(sessionId: string): mongoose.Query<INPCFaction[], INPCFaction>;
}

export const NPCFaction: INPCFactionModel = 
  mongoose.models.NPCFaction as INPCFactionModel || 
  mongoose.model<INPCFaction, INPCFactionModel>('NPCFaction', NPCFactionSchema);








