import mongoose, { Schema, Document } from 'mongoose';
import { UnitType, TerrainType } from '../core/battle-calculator';
import { Formation } from '../services/battle/FormationSystem';
import { UnitTrait, FatigueLevel } from '../services/battle/TraitSystem';

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
  maxTroops: number;
  leadership: number;
  strength: number;
  intelligence: number;
  unitType: UnitType;
  morale: number;
  training: number;
  techLevel: number;
  nationId?: number;
  commanderId?: number | null;
  originType?: string;
  originStackId?: string;
  
  // 좌표 기반 위치 (800 x 600 맵)
  position: { x: number; y: number };
  velocity?: { x: number; y: number };
  facing?: number;  // 방향 (0~360도)
  targetPosition?: { x: number; y: number };
  
  // 물리 속성
  collisionRadius: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown?: number;
  lastAttackTime?: number;
  
  // 전술
  formation?: Formation;
  formationTransitionTimer?: number; // 포메이션 전환 타이머 (ms)
  formationVulnerable?: boolean; // 포메이션 전환 중 취약 상태
  stance?: 'aggressive' | 'defensive' | 'hold' | 'retreat';
  
  // 특수 상태
  isCharging?: boolean;
  isAIControlled?: boolean;
  isVolleyMode?: boolean;
  
  // 피로도 시스템 (토탈 워 기반)
  fatigue?: number;              // 피로도 (0-100)
  fatigueLevel?: FatigueLevel;   // 피로도 레벨
  
  // 특성 시스템
  traits?: UnitTrait[];          // 부대 특성 목록
  
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

export type BattleParticipantRole = 'FIELD_COMMANDER' | 'SUB_COMMANDER' | 'STAFF';

export interface IBattleParticipant {
  generalId: number;
  role: BattleParticipantRole;
  controlledUnitGeneralIds?: number[];
}
 
export interface IBattleMap {

  width: number;
  height: number;
  entryDirection: string;
  
  // 성 정보 (성 공방전)
  castle?: {
    center: { x: number; y: number };
    radius: number;
    gates: Array<{
      id: string;
      position: { x: number; y: number };
      width: number;
      height: number;
      hp: number;
      maxHp: number;
    }>;
    targetGateId?: string;
  };
  
  // 지형 요소
  terrain?: Array<{
    type: 'forest' | 'hill' | 'river';
    area?: { x: number; y: number; width: number; height: number };
    path?: Array<{ x: number; y: number }>;
  }>;
  
  // 배치 영역
  attackerZone: { x: [number, number]; y: [number, number] };
  defenderZone: { x: [number, number]; y: [number, number] };
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

  participants?: IBattleParticipant[];
  
  // 좌표 기반 맵 정보
  map: IBattleMap;
  
  // 실시간 전투 상태
  isRealtime?: boolean;
  tickRate?: number;
  lastTickTime?: Date;
  
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
  maxTroops: { type: Number, required: true },
  leadership: { type: Number, required: true },
  strength: { type: Number, required: true },
  intelligence: { type: Number, required: true },
  unitType: { type: String, enum: Object.values(UnitType), required: true },
  morale: { type: Number, default: 80 },
  training: { type: Number, default: 80 },
  techLevel: { type: Number, default: 50 },

  nationId: { type: Number },
  commanderId: { type: Number },
  originType: { type: String },
  originStackId: { type: String },
  
  // 좌표 기반 위치
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  velocity: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  facing: { type: Number, default: 0 },
  targetPosition: {
    x: { type: Number },
    y: { type: Number }
  },
  
  // 물리 속성
  collisionRadius: { type: Number, required: true },
  moveSpeed: { type: Number, required: true },
  attackRange: { type: Number, required: true },
  attackCooldown: { type: Number, default: 2000 },
  lastAttackTime: { type: Number, default: 0 },
  
  // 전술
  formation: { type: String, enum: Object.values(Formation), default: Formation.LINE },
  formationTransitionTimer: { type: Number, default: 0 },
  formationVulnerable: { type: Boolean, default: false },
  stance: { type: String, enum: ['aggressive', 'defensive', 'hold', 'retreat'], default: 'aggressive' },
  
  // 특수 상태
  isCharging: { type: Boolean, default: false },
  isAIControlled: { type: Boolean, default: false },
  isVolleyMode: { type: Boolean, default: false },
  
  // 피로도 시스템
  fatigue: { type: Number, default: 0, min: 0, max: 100 },
  fatigueLevel: { type: String, enum: Object.values(FatigueLevel), default: FatigueLevel.FRESH },
  
  // 특성 시스템
  traits: [{ type: String, enum: Object.values(UnitTrait) }],
  
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

const BattleMapSchema = new Schema({
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 },
  entryDirection: { type: String, required: true },
  
  castle: {
    center: {
      x: { type: Number },
      y: { type: Number }
    },
    radius: { type: Number },
    gates: [{
      id: { type: String },
      position: {
        x: { type: Number },
        y: { type: Number }
      },
      width: { type: Number },
      height: { type: Number },
      hp: { type: Number },
      maxHp: { type: Number }
    }],
    targetGateId: { type: String }
  },
  
  terrain: [{
    type: { type: String, enum: ['forest', 'hill', 'river'] },
    area: {
      x: { type: Number },
      y: { type: Number },
      width: { type: Number },
      height: { type: Number }
    },
    path: [{
      x: { type: Number },
      y: { type: Number }
    }]
  }],
  
  attackerZone: {
    x: [{ type: Number }],
    y: [{ type: Number }]
  },
  defenderZone: {
    x: [{ type: Number }],
    y: [{ type: Number }]
  }
}, { _id: false });

const BattleSchema = new Schema({
  session_id: { type: String, required: true },
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

  participants: [{
    generalId: { type: Number, required: true },
    role: { type: String, enum: ['FIELD_COMMANDER', 'SUB_COMMANDER', 'STAFF'], required: true },
    controlledUnitGeneralIds: [{ type: Number }]
  }],
  
  // 좌표 기반 맵
  map: { type: BattleMapSchema, required: true },
  
  // 실시간 전투
  isRealtime: { type: Boolean, default: false },
  tickRate: { type: Number, default: 20 },
  lastTickTime: { type: Date },
  
  winner: { type: String, enum: ['attacker', 'defender', 'draw'] },
  
  startedAt: { type: Date },
  completedAt: { type: Date }
}, {
  timestamps: true
});

BattleSchema.index({ session_id: 1, status: 1 });
BattleSchema.index({ session_id: 1, status: 1, startedAt: -1 });
BattleSchema.index({ attackerNationId: 1 });
BattleSchema.index({ defenderNationId: 1 });

export const Battle = mongoose.models.Battle || mongoose.model<IBattle>('Battle', BattleSchema);
