import { Schema, model, Document } from 'mongoose';
import { INation } from '../@types/nation.types';

export interface INationDocument extends Omit<INation, 'id'>, Document {
  id: string;
}

const NationSchema = new Schema<INationDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    
    name: { type: String, required: true },
    color: { type: String, required: true },
    
    capital: { type: Number, required: true, default: 0 },
    capSet: { type: String, default: '' },
    
    genNum: { type: Number, required: true, default: 0 },
    gold: { type: Number, required: true, default: 0 },
    rice: { type: Number, required: true, default: 0 },
    
    bill: { type: Number, required: true, default: 0 },
    rate: { type: Number, required: true, default: 0 },
    rateTemp: { type: Number, required: true, default: 0 },
    
    secretLimit: { type: Number, required: true, default: 0 },
    chiefSet: { type: Number, required: true, default: 0 },
    scout: { type: Boolean, required: true, default: false },
    war: { type: Boolean, required: true, default: false },
    
    strategicCmdLimit: { type: Number, required: true, default: 0 },
    surLimit: { type: Number, required: true, default: 0 },
    
    tech: { type: Number, required: true, default: 0 },
    power: { type: Number, required: true, default: 0 },
    level: { type: Number, required: true, default: 1 },
    type: { type: String, required: true, default: 'che_중립' },
    
    spy: { type: Schema.Types.Mixed, default: {} },
    aux: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

NationSchema.index({ sessionId: 1, name: 1 });
NationSchema.index({ sessionId: 1, type: 1 });

export const NationModel = model<INationDocument>('Nation', NationSchema);
