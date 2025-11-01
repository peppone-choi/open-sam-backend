import mongoose, { Schema, Document } from 'mongoose';

export type Direction = 
  | 'north' | 'northeast' | 'east' | 'southeast'
  | 'south' | 'southwest' | 'west' | 'northwest';

export type BattlePhase = 'preparing' | 'planning' | 'resolution' | 'finished';
export type BattleStatus = 'preparing' | 'active' | 'finished';
export type Winner = 'attacker' | 'defender';

export interface IBattleInstance extends Document {
  session_id: string;
  battle_id: string;
  
  map_template_id?: mongoose.Types.ObjectId;
  city_id: number;
  city_name: string;
  
  attacker: {
    nation_id: number;
    nation_name: string;
    generals: number[];
    entry_direction: Direction;
    entry_exit_id?: string;
  };
  
  defender: {
    nation_id: number;
    nation_name: string;
    generals: number[];
    city_defense: boolean;
  };
  
  current_turn: number;
  phase: BattlePhase;
  status: BattleStatus;
  winner?: Winner;
  
  turn_seconds: number;
  resolution_seconds: number;
  turn_limit: number;
  time_cap_seconds: number;
  
  planning_deadline?: Date;
  
  turn_history: {
    turn: number;
    actions: any[];
    events: string[];
  }[];
  
  afk_tracking: {
    general_id: number;
    afk_turns: number;
    ai_controlled: boolean;
  }[];
  
  started_at: Date;
  finished_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const BattleInstanceSchema = new Schema<IBattleInstance>({
  session_id: { type: String, required: true },
  battle_id: { type: String, required: true, unique: true },
  
  map_template_id: { type: Schema.Types.ObjectId },
  city_id: { type: Number, required: true },
  city_name: { type: String, required: true },
  
  attacker: {
    nation_id: { type: Number, required: true },
    nation_name: { type: String, required: true },
    generals: [{ type: Number }],
    entry_direction: { 
      type: String, 
      enum: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
      required: true 
    },
    entry_exit_id: { type: String }
  },
  
  defender: {
    nation_id: { type: Number, required: true },
    nation_name: { type: String, required: true },
    generals: [{ type: Number }],
    city_defense: { type: Boolean, default: true }
  },
  
  current_turn: { type: Number, default: 0 },
  phase: { 
    type: String, 
    enum: ['preparing', 'planning', 'resolution', 'finished'],
    default: 'preparing' 
  },
  status: { 
    type: String, 
    enum: ['preparing', 'active', 'finished'],
    default: 'preparing' 
  },
  winner: { 
    type: String, 
    enum: ['attacker', 'defender']
  },
  
  turn_seconds: { type: Number, default: 90 },
  resolution_seconds: { type: Number, default: 10 },
  turn_limit: { type: Number, default: 15 },
  time_cap_seconds: { type: Number, default: 1500 },
  
  planning_deadline: { type: Date },
  
  turn_history: [{
    turn: { type: Number, required: true },
    actions: [{ type: Schema.Types.Mixed }],
    events: [{ type: String }]
  }],
  
  afk_tracking: [{
    general_id: { type: Number, required: true },
    afk_turns: { type: Number, default: 0 },
    ai_controlled: { type: Boolean, default: false }
  }],
  
  started_at: { type: Date, default: Date.now },
  finished_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

BattleInstanceSchema.index({ session_id: 1, battle_id: 1 }, { unique: true });
BattleInstanceSchema.index({ session_id: 1, status: 1 });
BattleInstanceSchema.index({ 'attacker.generals': 1 });
BattleInstanceSchema.index({ 'defender.generals': 1 });

export const BattleInstance = mongoose.model<IBattleInstance>('BattleInstance', BattleInstanceSchema);
