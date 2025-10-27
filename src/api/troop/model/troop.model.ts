import { Schema, model, Document } from 'mongoose';
import { ITroop } from '../@types/troop.types';

export interface ITroopDocument extends Omit<ITroop, 'id'>, Document {
  id: string;
}

const TroopSchema = new Schema<ITroopDocument>(
  {
    nation: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

TroopSchema.index({ nation: 1 });

export const TroopModel = model<ITroopDocument>('Troop', TroopSchema);
