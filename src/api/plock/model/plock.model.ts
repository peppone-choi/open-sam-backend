import { Schema, model, Document } from 'mongoose';

export interface IPlockDocument extends Document {
  sessionId: string;
  type: 'GAME' | 'ETC' | 'TOURNAMENT';
  plock: boolean;
  lockTime: Date;
}

const PlockSchema = new Schema<IPlockDocument>({
  sessionId: { type: String, required: true },
  type: { type: String, enum: ['GAME', 'ETC', 'TOURNAMENT'], required: true },
  plock: { type: Boolean, default: false },
  lockTime: { type: Date, required: true },
}, { timestamps: true });

PlockSchema.index({ sessionId: 1, type: 1 }, { unique: true });

export const PlockModel = model<IPlockDocument>('Plock', PlockSchema);
