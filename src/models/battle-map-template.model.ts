import mongoose, { Schema, Document } from 'mongoose';
import { Direction } from './battle-instance.model';

export type TerrainType = 'plain' | 'forest' | 'hill' | 'wall' | 'gate' | 'water' | 'road';

export interface Position {
  x: number;
  y: number;
}

export interface IBattleMapTemplate extends Document {
  session_id: string;
  city_id: number;
  
  name: string;
  width: number;
  height: number;
  
  terrain: {
    x: number;
    y: number;
    type: TerrainType;
    elevation?: number;
  }[];
  
  castle: {
    centerX: number;
    centerY: number;
    walls: Position[];
    gates: Position[];
    throne: Position;
  };
  
  exits: {
    direction: Direction;
    position: Position;
    connectedCity: number;
  }[];
  
  deployment: {
    attacker: Position[];
    defender: Position[];
  };
  
  strategicPoints?: {
    name: string;
    position: Position;
    bonus: string;
  }[];
  
  created_at: Date;
  updated_at: Date;
}

const BattleMapTemplateSchema = new Schema<IBattleMapTemplate>({
  session_id: { type: String, required: true },
  city_id: { type: Number, required: true },
  
  name: { type: String, required: true },
  width: { type: Number, default: 40 },
  height: { type: Number, default: 40 },
  
  terrain: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['plain', 'forest', 'hill', 'wall', 'gate', 'water', 'road'],
      required: true 
    },
    elevation: { type: Number }
  }],
  
  castle: {
    centerX: { type: Number, required: true },
    centerY: { type: Number, required: true },
    walls: [{ 
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }],
    gates: [{ 
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }],
    throne: { 
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }
  },
  
  exits: [{
    direction: { 
      type: String, 
      enum: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
      required: true 
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    },
    connectedCity: { type: Number, required: true }
  }],
  
  deployment: {
    attacker: [{ 
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }],
    defender: [{ 
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }]
  },
  
  strategicPoints: [{
    name: { type: String, required: true },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    },
    bonus: { type: String, required: true }
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

BattleMapTemplateSchema.index({ session_id: 1, city_id: 1 }, { unique: true });

export const BattleMapTemplate = mongoose.models.BattleMapTemplate || mongoose.model<IBattleMapTemplate>('BattleMapTemplate', BattleMapTemplateSchema);
