import mongoose, { Schema, Document } from 'mongoose';

export type ActionType = 'move' | 'attack' | 'defend' | 'skill' | 'wait';
export type ActionStatus = 'pending' | 'validated' | 'executed' | 'failed' | 'cancelled';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface MovementPath {
  from: Position3D;
  to: Position3D;
  waypoints: Position3D[];
  cost: number;
}

export interface AttackTarget {
  type: 'unit' | 'building' | 'position';
  unitId?: string;
  buildingId?: string;
  position?: Position3D;
}

export interface SkillUsage {
  skillId: string;
  skillName: string;
  target?: AttackTarget;
  area?: Position3D[];
  cost?: {
    mp?: number;
    morale?: number;
    special?: Record<string, number>;
  };
}

export interface ActionResult {
  success: boolean;
  damage?: number;
  healing?: number;
  effectsApplied?: string[];
  casualties?: number;
  moraleLoss?: number;
  terrainChanged?: boolean;
  message?: string;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface IBattleAction extends Document {
  session_id: string;
  battle_id: string;
  turn: number;
  
  unit_id: string;
  general_id: number;
  general_name: string;
  
  action_type: ActionType;
  
  movement?: MovementPath;
  
  attack?: AttackTarget;
  
  skill?: SkillUsage;
  
  defend?: {
    defensive_stance: boolean;
    formation?: string;
  };
  
  status: ActionStatus;
  
  validation_errors?: ValidationError[];
  
  result?: ActionResult;
  
  submitted_at: Date;
  executed_at?: Date;
  
  priority: number;
  
  metadata?: Record<string, any>;
  
  created_at: Date;
  updated_at: Date;
}

const Position3DSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, required: true, default: 0 }
}, { _id: false });

const MovementPathSchema = new Schema({
  from: { type: Position3DSchema, required: true },
  to: { type: Position3DSchema, required: true },
  waypoints: { type: [Position3DSchema], default: [] },
  cost: { type: Number, required: true }
}, { _id: false });

const AttackTargetSchema = new Schema({
  type: { 
    type: String, 
    enum: ['unit', 'building', 'position'],
    required: true 
  },
  unitId: { type: String },
  buildingId: { type: String },
  position: { type: Position3DSchema }
}, { _id: false });

const SkillUsageSchema = new Schema({
  skillId: { type: String, required: true },
  skillName: { type: String, required: true },
  target: { type: AttackTargetSchema },
  area: { type: [Position3DSchema] },
  cost: {
    mp: { type: Number },
    morale: { type: Number },
    special: { type: Schema.Types.Mixed }
  }
}, { _id: false });

const ActionResultSchema = new Schema({
  success: { type: Boolean, required: true },
  damage: { type: Number },
  healing: { type: Number },
  effectsApplied: { type: [String] },
  casualties: { type: Number },
  moraleLoss: { type: Number },
  terrainChanged: { type: Boolean },
  message: { type: String }
}, { _id: false });

const ValidationErrorSchema = new Schema({
  code: { type: String, required: true },
  message: { type: String, required: true },
  field: { type: String }
}, { _id: false });

const BattleActionSchema = new Schema<IBattleAction>({
  session_id: { type: String, required: true },
  battle_id: { type: String, required: true },
  turn: { type: Number, required: true },
  
  unit_id: { type: String, required: true },
  general_id: { type: Number, required: true },
  general_name: { type: String, required: true },
  
  action_type: { 
    type: String, 
    enum: ['move', 'attack', 'defend', 'skill', 'wait'],
    required: true 
  },
  
  movement: { type: MovementPathSchema },
  
  attack: { type: AttackTargetSchema },
  
  skill: { type: SkillUsageSchema },
  
  defend: {
    defensive_stance: { type: Boolean },
    formation: { type: String }
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'validated', 'executed', 'failed', 'cancelled'],
    default: 'pending' 
  },
  
  validation_errors: { type: [ValidationErrorSchema] },
  
  result: { type: ActionResultSchema },
  
  submitted_at: { type: Date, default: Date.now },
  executed_at: { type: Date },
  
  priority: { type: Number, default: 0 },
  
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

BattleActionSchema.index({ session_id: 1, battle_id: 1, turn: 1 });
BattleActionSchema.index({ battle_id: 1, turn: 1, status: 1 });
BattleActionSchema.index({ unit_id: 1, turn: 1 });
BattleActionSchema.index({ general_id: 1, battle_id: 1 });
BattleActionSchema.index({ submitted_at: 1 });

export const BattleAction = mongoose.model<IBattleAction>('BattleAction', BattleActionSchema);
