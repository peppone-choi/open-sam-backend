import { Schema, model, Document } from 'mongoose';
import { IWorldHistory } from '../@types/world-history.types';

export interface IWorldHistoryDocument extends Omit<IWorldHistory, 'id'>, Document {
  id: string;
}

const WorldHistorySchema = new Schema<IWorldHistoryDocument>({
  sessionId: { type: String, required: true },
  nationId: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  text: { type: String, required: true },
}, { timestamps: true });

WorldHistorySchema.index({ sessionId: 1 });
WorldHistorySchema.index({ nationId: 1, year: 1, month: 1 });

export const WorldHistoryModel = model<IWorldHistoryDocument>('WorldHistory', WorldHistorySchema);
