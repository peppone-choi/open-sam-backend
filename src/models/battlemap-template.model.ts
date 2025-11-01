import mongoose, { Schema, Document } from 'mongoose';

export interface ITerrainTile {
  x: number;
  y: number;
  type: 'plain' | 'forest' | 'hill' | 'mountain' | 'water' | 'wall' | 'gate' | 'road';
  elevation?: number;
  height?: number;
}

export interface IPosition {
  x: number;
  y: number;
}

export interface ICastle {
  centerX: number;
  centerY: number;
  walls: IPosition[];
  gates: IPosition[];
  throne: IPosition;
}

export interface IMapExit {
  direction: 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
  position: IPosition;
  connectedCity?: number;
}

export interface IDeployment {
  attacker: IPosition[];
  defender: IPosition[];
}

export interface IStrategicPoint {
  name: string;
  position: IPosition;
  bonus: string;
}

export interface IBattleMapTemplate extends Document {
  session_id: string;
  city_id: number;
  
  name: string;
  width: number;
  height: number;
  
  terrain: ITerrainTile[];
  castle: ICastle;
  exits: IMapExit[];
  deployment: IDeployment;
  strategicPoints?: IStrategicPoint[];
  
  created_at: Date;
  updated_at: Date;
}

const TerrainTileSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['plain', 'forest', 'hill', 'mountain', 'water', 'wall', 'gate', 'road'],
    required: true 
  },
  elevation: { type: Number, default: 0 },
  height: { type: Number, default: 0 }
}, { _id: false });

const PositionSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
}, { _id: false });

const CastleSchema = new Schema({
  centerX: { type: Number, required: true },
  centerY: { type: Number, required: true },
  walls: [PositionSchema],
  gates: [PositionSchema],
  throne: PositionSchema
}, { _id: false });

const MapExitSchema = new Schema({
  direction: { 
    type: String, 
    enum: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    required: true 
  },
  position: { type: PositionSchema, required: true },
  connectedCity: { type: Number }
}, { _id: false });

const DeploymentSchema = new Schema({
  attacker: [PositionSchema],
  defender: [PositionSchema]
}, { _id: false });

const StrategicPointSchema = new Schema({
  name: { type: String, required: true },
  position: { type: PositionSchema, required: true },
  bonus: { type: String, required: true }
}, { _id: false });

const BattleMapTemplateSchema = new Schema<IBattleMapTemplate>({
  session_id: { type: String, required: true },
  city_id: { type: Number, required: true },
  
  name: { type: String, required: true },
  width: { type: Number, default: 40 },
  height: { type: Number, default: 40 },
  
  terrain: [TerrainTileSchema],
  castle: { type: CastleSchema, required: true },
  exits: [MapExitSchema],
  deployment: { type: DeploymentSchema, required: true },
  strategicPoints: [StrategicPointSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

BattleMapTemplateSchema.index({ session_id: 1, city_id: 1 }, { unique: true });
BattleMapTemplateSchema.index({ session_id: 1 });

export const BattleMapTemplate = mongoose.model<IBattleMapTemplate>('BattleMapTemplate', BattleMapTemplateSchema);
