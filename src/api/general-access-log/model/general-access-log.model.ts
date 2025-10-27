import { Schema, model, Document } from 'mongoose';
import { IGeneralAccessLog } from '../@types/general-access-log.types';

export interface IGeneralAccessLogDocument extends Omit<IGeneralAccessLog, 'id'>, Document {
  id: string;
}

const GeneralAccessLogSchema = new Schema<IGeneralAccessLogDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    generalId: { type: String, required: true, index: true },
    userId: { type: String },
    lastRefresh: { type: Date },
    refresh: { type: Number, required: true, default: 0 },
    refreshTotal: { type: Number, required: true, default: 0 },
    refreshScore: { type: Number, required: true, default: 0 },
    refreshScoreTotal: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

GeneralAccessLogSchema.index({ generalId: 1 });
GeneralAccessLogSchema.index({ userId: 1 });
GeneralAccessLogSchema.index({ sessionId: 1, generalId: 1 });

export const GeneralAccessLogModel = model<IGeneralAccessLogDocument>('GeneralAccessLog', GeneralAccessLogSchema);
