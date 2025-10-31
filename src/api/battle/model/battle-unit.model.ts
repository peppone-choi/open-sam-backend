import { Schema, model, Document } from 'mongoose';
import { IBattleUnit } from '../@types/battle.types';

export interface IBattleUnitDocument extends Omit<IBattleUnit, 'id'>, Document {
  id: string;
}

const BattleUnitSchema = new Schema<IBattleUnitDocument>(
  {
    battleId: { type: String, required: true, index: true },
    
    commanderId: { type: String, required: true, index: true },
    
    troops_reserved: { type: Number, required: true },
    troops_current: { type: Number, required: true },
    unitType: { type: Number, required: true },
    
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    },
    
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    speed: { type: Number, required: true },
    morale: { type: Number, required: true, default: 100 },
    
    status: { 
      type: String, 
      enum: ['active', 'retreating', 'routed', 'destroyed'],
      required: true,
      default: 'active'
    }
  },
  { timestamps: true }
);

BattleUnitSchema.index({ battleId: 1, commanderId: 1 });
BattleUnitSchema.index({ battleId: 1, status: 1 });
BattleUnitSchema.index({ position: 1 });

export const BattleUnitModel = model<IBattleUnitDocument>('BattleUnit', BattleUnitSchema);
