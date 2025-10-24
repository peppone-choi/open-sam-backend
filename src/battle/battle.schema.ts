import { Schema, model, Document } from 'mongoose';
import { IBattle } from './battle.types';

export interface IBattleDocument extends Omit<IBattle, '_id'>, Document {}

const BattleSchema = new Schema<IBattleDocument>({
  attackerNationId: { type: Schema.Types.ObjectId as any, ref: 'Nation', required: true },
  defenderNationId: { type: Schema.Types.ObjectId as any, ref: 'Nation', required: true },
  cityId: { type: Schema.Types.ObjectId as any, ref: 'City', required: true },
  status: { type: String, enum: ['ongoing', 'attacker_won', 'defender_won'], default: 'ongoing' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
}, { timestamps: true });

export const BattleModel = model<IBattleDocument>('Battle', BattleSchema);
