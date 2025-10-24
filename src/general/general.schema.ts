import { Schema, model, Document } from 'mongoose';
import { IGeneral } from './general.types';

export interface IGeneralDocument extends Omit<IGeneral, '_id'>, Document {}

const GeneralSchema = new Schema<IGeneralDocument>({
  name: { type: String, required: true, index: true },
  nationId: { type: Schema.Types.ObjectId as any, ref: 'Nation', required: true, index: true },
  cityId: { type: Schema.Types.ObjectId as any, ref: 'City', default: null, index: true },
  
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  
  command: { type: Number, required: true },
  strength: { type: Number, required: true },
  intelligence: { type: Number, required: true },
  leadership: { type: Number, required: true },
  
  pcp: { type: Number, default: 10 },
  pcpMax: { type: Number, default: 10 },
  mcp: { type: Number, default: 0 },
  mcpMax: { type: Number, default: 0 },
  
  hp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  
  positionId: { type: Schema.Types.ObjectId as any, ref: 'Position', default: null },
}, { timestamps: true });

export const GeneralModel = model<IGeneralDocument>('General', GeneralSchema);
