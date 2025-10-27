import { Schema, model, Document } from 'mongoose';
import { INgBetting } from '../@types/ng-betting.types';

export interface INgBettingDocument extends Omit<INgBetting, 'id'>, Document {
  id: string;
}

const NgBettingSchema = new Schema<INgBettingDocument>(
  {
    sessionId: { type: String, required: true },
    bettingId: { type: Number, required: true },
    generalId: { type: String, required: true },
    userId: { type: String },
    bettingType: { type: Schema.Types.Mixed, required: true },
    amount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

NgBettingSchema.index({ sessionId: 1, bettingId: 1 });
NgBettingSchema.index({ generalId: 1 });
NgBettingSchema.index({ userId: 1 });

export const NgBettingModel = model<INgBettingDocument>('NgBetting', NgBettingSchema);
