import mongoose, { Schema, Document } from 'mongoose';
import { UnitType, TerrainType } from '../core/battle-calculator';

export enum BattleStatus {
  PREPARING = 'preparing',
  DEPLOYING = 'deploying',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum BattlePhase {
  PLANNING = 'planning',
  RESOLUTION = 'resolution'
}

export interface IBattleUnit {
  generalId: number;
  generalName: string;
  troops: number;
  leadership: number;
  strength: number;
  intelligence: number;
  unitType: UnitType;
  morale: number;
  training: number;
  techLevel: number;
  position?: { x: number; y: number };
  specialSkills?: string[];
}

export interface ITurnAction {
  generalId: number;
  action: 'move' | 'attack' | 'skill' | 'defend' | 'retreat';
  target?: { x: number; y: number };
  targetGeneralId?: number;
  skillId?: string;
}

export interface ITurnHistory {
  turnNumber: number;
  timestamp: Date;
  actions: ITurnAction[];
  results: {
    attackerDamage: number;
    defenderDamage: number;
    events: string[];
  };
  battleLog: string[];
}

export interface IBattle extends Document {
  session_id: string;
  battleId: string;
  
  attackerNationId: number;
  defenderNationId: number;
  
  targetCityId: number;
  terrain: TerrainType;
  
  attackerUnits: IBattleUnit[];
  defenderUnits: IBattleUnit[];
  
  status: BattleStatus;
  currentPhase: BattlePhase;
  currentTurn: number;
  maxTurns: number;
  
  planningTimeLimit: number;
  resolutionTimeLimit: number;
  
  currentTurnActions: ITurnAction[];
  readyPlayers: number[];
  
  turnHistory: ITurnHistory[];
  
  winner?: 'attacker' | 'defender' | 'draw';
  
  startedAt?: Date;
  completedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const BattleUnitSchema = new Schema({
  generalId: { type: Number, required: true },
  generalName: { type: String, required: true },
  troops: { type: Number, required: true },
  leadership: { type: Number, required: true },
  strength: { type: Number, required: true },
  intelligence: { type: Number, required: true },
  unitType: { type: String, enum: Object.values(UnitType), required: true },
  morale: { type: Number, default: 80 },
  training: { type: Number, default: 80 },
  techLevel: { type: Number, default: 50 },
  position: {
    x: { type: Number },
    y: { type: Number }
  },
  specialSkills: [{ type: String }]
}, { _id: false });

const TurnActionSchema = new Schema({
  generalId: { type: Number, required: true },
  action: { type: String, enum: ['move', 'attack', 'skill', 'defend', 'retreat'], required: true },
  target: {
    x: { type: Number },
    y: { type: Number }
  },
  targetGeneralId: { type: Number },
  skillId: { type: String }
}, { _id: false });

const TurnHistorySchema = new Schema({
  turnNumber: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  actions: [TurnActionSchema],
  results: {
    attackerDamage: { type: Number },
    defenderDamage: { type: Number },
    events: [{ type: String }]
  },
  battleLog: [{ type: String }]
}, { _id: false });

const BattleSchema = new Schema({
  session_id: { type: String, required: true, index: true },
  battleId: { type: String, required: true, unique: true, index: true },
  
  attackerNationId: { type: Number, required: true },
  defenderNationId: { type: Number, required: true },
  
  targetCityId: { type: Number, required: true },
  terrain: { type: String, enum: Object.values(TerrainType), default: TerrainType.PLAINS },
  
  attackerUnits: [BattleUnitSchema],
  defenderUnits: [BattleUnitSchema],
  
  status: { type: String, enum: Object.values(BattleStatus), default: BattleStatus.PREPARING },
  currentPhase: { type: String, enum: Object.values(BattlePhase), default: BattlePhase.PLANNING },
  currentTurn: { type: Number, default: 0 },
  maxTurns: { type: Number, default: 15 },
  
  planningTimeLimit: { type: Number, default: 90 },
  resolutionTimeLimit: { type: Number, default: 10 },
  
  currentTurnActions: [TurnActionSchema],
  readyPlayers: [{ type: Number }],
  
  turnHistory: [TurnHistorySchema],
  
  winner: { type: String, enum: ['attacker', 'defender', 'draw'] },
  
  startedAt: { type: Date },
  completedAt: { type: Date }
}, {
  timestamps: true
});

BattleSchema.index({ session_id: 1, status: 1 });
BattleSchema.index({ attackerNationId: 1 });
BattleSchema.index({ defenderNationId: 1 });

export const Battle = mongoose.model<IBattle>('Battle', BattleSchema);
