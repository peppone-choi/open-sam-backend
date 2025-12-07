/**
 * GIN7 Scenario Model
 * 
 * 시나리오 정의 및 런타임 상태 저장
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ScenarioMeta,
  ScenarioFaction,
  ScenarioInitialState,
  GameCondition,
  ScenarioEvent,
  ScriptedBattle,
} from '../../types/gin7/scenario.types';

// ============================================================================
// Scenario Definition Interface
// ============================================================================

export interface IScenario extends Document {
  // 메타데이터
  meta: ScenarioMeta;
  
  // 세력 정의
  factions: ScenarioFaction[];
  
  // 초기 상태
  initialState: ScenarioInitialState;
  
  // 승리/패배 조건
  victoryConditions: GameCondition[];
  defeatConditions: GameCondition[];
  
  // 이벤트
  events: ScenarioEvent[];
  
  // 스크립트 전투
  scriptedBattles?: ScriptedBattle[];
  
  // 추가 데이터
  customData?: Record<string, unknown>;
  
  // 상태
  isPublished: boolean;
  isOfficial: boolean;
}

// ============================================================================
// Schema Definition
// ============================================================================

const GameConditionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  description: String,
  targetFactionId: String,
  params: Schema.Types.Mixed,
  priority: Number,
  hidden: Boolean,
}, { _id: false });

const EventTriggerSchema = new Schema({
  type: { type: String, required: true },
  params: Schema.Types.Mixed,
}, { _id: false });

const EventActionSchema = new Schema({
  type: { type: String, required: true },
  params: Schema.Types.Mixed,
  delay: Number,
}, { _id: false });

const EventChoiceSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  conditions: Schema.Types.Mixed,
  actions: [EventActionSchema],
  consequences: String,
}, { _id: false });

const ScenarioEventSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  trigger: { type: EventTriggerSchema, required: true },
  conditions: Schema.Types.Mixed,
  actions: [EventActionSchema],
  choices: [EventChoiceSchema],
  once: Boolean,
  repeatable: Boolean,
  repeatDelay: Number,
  priority: Number,
  enabled: { type: Boolean, default: true },
}, { _id: false });

const FleetCompositionSchema = new Schema({
  battleships: { type: Number, default: 0 },
  cruisers: { type: Number, default: 0 },
  destroyers: { type: Number, default: 0 },
  carriers: { type: Number, default: 0 },
  frigates: { type: Number, default: 0 },
  transports: { type: Number, default: 0 },
  fighters: { type: Number, default: 0 },
}, { _id: false });

const FleetStateSchema = new Schema({
  fleetId: { type: String, required: true },
  name: { type: String, required: true },
  factionId: { type: String, required: true },
  commanderId: { type: String, required: true },
  locationId: { type: String, required: true },
  composition: FleetCompositionSchema,
  formation: String,
  morale: { type: Number, default: 100 },
  supply: { type: Number, default: 100 },
}, { _id: false });

const CharacterStateSchema = new Schema({
  characterId: { type: String, required: true },
  templateId: String,
  name: { type: String, required: true },
  factionId: { type: String, required: true },
  locationId: { type: String, required: true },
  locationType: { type: String, enum: ['planet', 'fleet', 'base'], default: 'fleet' },
  rank: String,
  position: String,
  statsOverride: {
    command: Number,
    might: Number,
    intellect: Number,
    politics: Number,
    charm: Number,
  },
  traits: [String],
  skills: [String],
}, { _id: false });

const TerritoryStateSchema = new Schema({
  starSystemId: { type: String, required: true },
  planetId: String,
  ownerId: { type: String, required: true },
  support: Number,
  publicOrder: Number,
  population: Number,
}, { _id: false });

const InitialStateSchema = new Schema({
  gameDate: {
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    day: { type: Number, required: true },
  },
  territories: [TerritoryStateSchema],
  characters: [CharacterStateSchema],
  fleets: [FleetStateSchema],
  facilities: Schema.Types.Mixed,
  resources: Schema.Types.Mixed,
}, { _id: false });

const FactionSchema = new Schema({
  factionId: { type: String, required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['empire', 'alliance', 'fezzan', 'neutral', 'custom'],
    default: 'custom'
  },
  isPlayable: { type: Boolean, default: true },
  aiPersonality: String,
  color: { type: String, default: '#888888' },
  emblemUrl: String,
}, { _id: false });

const MetaSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  nameEn: String,
  description: String,
  author: { type: String, default: 'System' },
  version: { type: String, default: '1.0.0' },
  difficulty: { 
    type: String, 
    enum: ['easy', 'normal', 'hard', 'nightmare'],
    default: 'normal'
  },
  estimatedTurns: { type: Number, default: 30 },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const BattleSpecialRuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  type: { type: String, required: true },
  params: Schema.Types.Mixed,
}, { _id: false });

const ScriptedBattleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  attackerFactionId: { type: String, required: true },
  defenderFactionId: { type: String, required: true },
  attackerFleets: [FleetStateSchema],
  defenderFleets: [FleetStateSchema],
  battleType: { 
    type: String, 
    enum: ['space', 'ground', 'siege'],
    default: 'space'
  },
  mapId: String,
  specialRules: [BattleSpecialRuleSchema],
  battleEvents: [ScenarioEventSchema],
  victoryConditions: [GameConditionSchema],
  defeatConditions: [GameConditionSchema],
}, { _id: false });

const ScenarioSchema = new Schema<IScenario>({
  meta: { type: MetaSchema, required: true },
  factions: { type: [FactionSchema], required: true },
  initialState: { type: InitialStateSchema, required: true },
  victoryConditions: { type: [GameConditionSchema], required: true },
  defeatConditions: { type: [GameConditionSchema], required: true },
  events: { type: [ScenarioEventSchema], default: [] },
  scriptedBattles: [ScriptedBattleSchema],
  customData: Schema.Types.Mixed,
  isPublished: { type: Boolean, default: false },
  isOfficial: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// ============================================================================
// Indexes
// ============================================================================

ScenarioSchema.index({ 'meta.id': 1 }, { unique: true });
ScenarioSchema.index({ 'meta.name': 'text', 'meta.description': 'text' });
ScenarioSchema.index({ isPublished: 1, isOfficial: 1 });
ScenarioSchema.index({ 'meta.tags': 1 });
ScenarioSchema.index({ 'meta.difficulty': 1 });

// ============================================================================
// Export
// ============================================================================

export const Scenario: Model<IScenario> = 
  mongoose.models.Scenario || mongoose.model<IScenario>('Scenario', ScenarioSchema);








