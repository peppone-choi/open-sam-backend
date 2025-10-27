import { Schema, model, Document } from 'mongoose';
import { IPlock } from '../@types/plock.types';

export interface IPlockDocument extends Omit<IPlock, 'id'>, Document {
  id: string;
}

const PlockSchema = new Schema<IPlockDocument>(
  {
    type: {
      type: String,
      enum: ['GAME', 'ETC', 'TOURNAMENT'],
      required: true,
      unique: true,
      default: 'GAME',
    },
    plock: { type: Number, required: true, default: 0 },
    locktime: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
  }
);

PlockSchema.index({ type: 1 });

export const PlockModel = model<IPlockDocument>('Plock', PlockSchema);
