import { Schema, model, Document } from 'mongoose';
import { IBattleSession, BattleStatus, BattleMode } from '../@types/battle.types';

export interface IBattleSessionDocument extends Omit<IBattleSession, 'id'>, Document {
  id: string;
}

const BattleSessionSchema = new Schema<IBattleSessionDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    
    attackerNationId: { type: String, required: true },
    defenderNationId: { type: String, required: true },
    targetCityId: { type: String, required: true },
    
    mode: { 
      type: String, 
      enum: Object.values(BattleMode), 
      required: true,
      default: BattleMode.REALTIME 
    },
    
    gridSize: {
      width: { type: Number, default: 40 },
      height: { type: Number, default: 40 }
    },
    terrain: { type: Schema.Types.Mixed },
    
    attackerCommanders: { type: [String], default: [] },
    defenderCommanders: { type: [String], default: [] },
    
    status: { 
      type: String, 
      enum: Object.values(BattleStatus), 
      required: true,
      default: BattleStatus.PREPARING 
    },
    currentRound: { type: Number, default: 0 },
    currentTick: { type: Number, default: 0 },
    
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    lastTickAt: { type: Date },
    
    result: {
      winner: { type: String, enum: ['attacker', 'defender', 'draw'] },
      casualties: { type: Map, of: Number },
      capturedCommanders: { type: [String] },
      killedCommanders: { type: [String] }
    }
  },
  { timestamps: true }
);

// sessionId index already created via schema index: true
BattleSessionSchema.index({ status: 1 });
BattleSessionSchema.index({ attackerNationId: 1 });
BattleSessionSchema.index({ defenderNationId: 1 });
BattleSessionSchema.index({ targetCityId: 1 });

export const BattleSessionModel = model<IBattleSessionDocument>('BattleSession', BattleSessionSchema);
