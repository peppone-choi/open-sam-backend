import mongoose, { Schema, Document } from 'mongoose';
import { TurnHistorySchema, BattleUnitSchema, BattleMapSchema, IBattleUnit, ITurnHistory, IBattleMap } from './battle.model';

export interface IBattleLog extends Document {
  battleId: string;
  session_id: string;
  
  attackerNationId: number;
  defenderNationId: number;
  
  winner: string;
  
  map: IBattleMap;
  initialAttackerUnits: IBattleUnit[];
  initialDefenderUnits: IBattleUnit[];
  
  turnHistory: ITurnHistory[];
  
  totalTurns: number;
  createdAt: Date;
}

const BattleLogSchema = new Schema({
  battleId: { type: String, required: true, unique: true, index: true },
  session_id: { type: String, required: true, index: true },
  
  attackerNationId: { type: Number, required: true },
  defenderNationId: { type: Number, required: true },
  
  winner: { type: String },
  
  map: { type: BattleMapSchema, required: true },
  initialAttackerUnits: [BattleUnitSchema],
  initialDefenderUnits: [BattleUnitSchema],
  
  turnHistory: [TurnHistorySchema],
  
  totalTurns: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const BattleLog = mongoose.models.BattleLog || mongoose.model<IBattleLog>('BattleLog', BattleLogSchema);






