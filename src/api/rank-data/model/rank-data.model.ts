import { Schema, model, Document } from 'mongoose';
import { IRankData } from '../@types/rank-data.types';

export interface IRankDataDocument extends Omit<IRankData, 'id'>, Document {
  id: string;
}

const RankDataSchema = new Schema<IRankDataDocument>(
  {
    nationId: { type: String, required: true, default: '0' },
    generalId: { type: String, required: true },
    type: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

RankDataSchema.index({ generalId: 1, type: 1 }, { unique: true });
RankDataSchema.index({ type: 1, value: 1 });
RankDataSchema.index({ nationId: 1, type: 1, value: 1 });

export const RankDataModel = model<IRankDataDocument>('RankData', RankDataSchema);
