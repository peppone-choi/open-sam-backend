import { Schema, model, Document } from 'mongoose';
import { ISelectPool } from '../@types/select-pool.types';

export interface ISelectPoolDocument extends Omit<ISelectPool, 'id'>, Document {
  id: string;
}

const SelectPoolSchema = new Schema<ISelectPoolDocument>(
  {
    sessionId: { type: String, required: true },
    uniqueName: { type: String, required: true },
    owner: { type: String },
    generalId: { type: String },
    reservedUntil: { type: Date },
    info: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

SelectPoolSchema.index({ sessionId: 1, uniqueName: 1 }, { unique: true });
SelectPoolSchema.index({ owner: 1 });
SelectPoolSchema.index({ reservedUntil: 1 });

export const SelectPoolModel = model<ISelectPoolDocument>('SelectPool', SelectPoolSchema);
