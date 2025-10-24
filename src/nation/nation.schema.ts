import { Schema, model, Document } from 'mongoose';
import { INation } from './nation.types';

export interface INationDocument extends Omit<INation, '_id'>, Document {}

const NationSchema = new Schema<INationDocument>({
  name: { type: String, required: true, unique: true, index: true },
  color: { type: String, required: true },
  rulerId: { type: Schema.Types.ObjectId as any, ref: 'General', default: null },
  
  gold: { type: Number, default: 100000 },
  food: { type: Number, default: 100000 },
}, { timestamps: true });

export const NationModel = model<INationDocument>('Nation', NationSchema);
