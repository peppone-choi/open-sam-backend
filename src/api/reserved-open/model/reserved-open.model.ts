import { Schema, model, Document } from 'mongoose';
import { IReservedOpen } from '../@types/reserved-open.types';

export interface IReservedOpenDocument extends Omit<IReservedOpen, 'id'>, Document {
  id: string;
}

const ReservedOpenSchema = new Schema<IReservedOpenDocument>(
  {
    options: { type: Schema.Types.Mixed, default: {} },
    date: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

ReservedOpenSchema.index({ date: 1 });

export const ReservedOpenModel = model<IReservedOpenDocument>('ReservedOpen', ReservedOpenSchema);
