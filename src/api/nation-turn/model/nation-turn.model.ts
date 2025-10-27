import { Schema, model, Document } from 'mongoose';
import { INationTurn } from '../@types/nation-turn.types';

export interface INationTurnDocument extends Omit<INationTurn, 'id'>, Document {
  id: string;
}

const NationTurnSchema = new Schema<INationTurnDocument>(
  {
    sessionId: { type: String, required: true },
    nationId: { type: String, required: true },
    officerLevel: { type: Number, required: true, default: 0 },
    turnIdx: { type: Number, required: true },
    action: { type: String, required: true },
    arg: { type: Schema.Types.Mixed, default: {} },
    brief: { type: String },
  },
  {
    timestamps: true,
  }
);

NationTurnSchema.index({ sessionId: 1, nationId: 1 });
NationTurnSchema.index({ turnIdx: 1 });
NationTurnSchema.index({ nationId: 1, turnIdx: 1 });

export const NationTurnModel = model<INationTurnDocument>('NationTurn', NationTurnSchema);
