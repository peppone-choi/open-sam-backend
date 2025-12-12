/**
 * GIN7 Scenario Session Model
 * 
 * 시나리오 플레이 세션 런타임 상태 저장
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { GameDate, ScenarioRuntimeState } from '../../types/gin7/scenario.types';

// ============================================================================
// Interface
// ============================================================================

export interface IScenarioSession extends Document {
  sessionId: string;
  scenarioId: string;
  playerId: string;
  
  // 현재 상태
  currentTurn: number;
  gameDate: GameDate;
  status: 'active' | 'paused' | 'victory' | 'defeat' | 'abandoned';
  
  // 선택한 세력
  playerFactionId: string;
  
  // 플래그 및 변수
  flags: Map<string, unknown>;
  variables: Map<string, number>;
  
  // 이벤트 추적
  triggeredEvents: string[];
  activeEvents: string[];
  
  // 대기 중인 선택지
  pendingChoices: {
    eventId: string;
    choiceIds: string[];
    deadline?: Date;
  }[];
  
  // 충족된 조건
  satisfiedConditions: string[];
  
  // 통계
  stats: {
    battlesWon: number;
    battlesLost: number;
    unitsLost: number;
    unitsKilled: number;
    charactersLost: number;
    turnsPlayed: number;
    playTimeMinutes: number;
  };
  
  // 저장/로드용 스냅샷
  snapshot?: {
    savedAt: Date;
    description?: string;
  };
  
  // 타임스탬프
  startedAt: Date;
  lastPlayedAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Schema
// ============================================================================

const GameDateSchema = new Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  day: { type: Number, required: true },
}, { _id: false });

const PendingChoiceSchema = new Schema({
  eventId: { type: String, required: true },
  choiceIds: [String],
  deadline: Date,
}, { _id: false });

const StatsSchema = new Schema({
  battlesWon: { type: Number, default: 0 },
  battlesLost: { type: Number, default: 0 },
  unitsLost: { type: Number, default: 0 },
  unitsKilled: { type: Number, default: 0 },
  charactersLost: { type: Number, default: 0 },
  turnsPlayed: { type: Number, default: 0 },
  playTimeMinutes: { type: Number, default: 0 },
}, { _id: false });

const ScenarioSessionSchema = new Schema<IScenarioSession>({
  sessionId: { type: String, required: true },
  scenarioId: { type: String, required: true },
  playerId: { type: String, required: true },
  
  currentTurn: { type: Number, default: 1 },
  gameDate: { type: GameDateSchema, required: true },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'victory', 'defeat', 'abandoned'],
    default: 'active'
  },
  
  playerFactionId: { type: String, required: true },
  
  flags: { type: Map, of: Schema.Types.Mixed, default: new Map() },
  variables: { type: Map, of: Number, default: new Map() },
  
  triggeredEvents: { type: [String], default: [] },
  activeEvents: { type: [String], default: [] },
  pendingChoices: { type: [PendingChoiceSchema], default: [] },
  
  satisfiedConditions: { type: [String], default: [] },
  
  stats: { type: StatsSchema, default: () => ({}) },
  
  snapshot: {
    savedAt: Date,
    description: String,
  },
  
  startedAt: { type: Date, default: Date.now },
  lastPlayedAt: { type: Date, default: Date.now },
  completedAt: Date,
}, {
  timestamps: true,
});

// ============================================================================
// Indexes
// ============================================================================

ScenarioSessionSchema.index({ sessionId: 1 }, { unique: true });
ScenarioSessionSchema.index({ playerId: 1, status: 1 });
ScenarioSessionSchema.index({ scenarioId: 1 });
ScenarioSessionSchema.index({ status: 1, lastPlayedAt: -1 });

// ============================================================================
// Export
// ============================================================================

export const ScenarioSession: Model<IScenarioSession> = 
  mongoose.models.ScenarioSession || mongoose.model<IScenarioSession>('ScenarioSession', ScenarioSessionSchema);















