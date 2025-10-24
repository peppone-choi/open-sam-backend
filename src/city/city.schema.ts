import { Schema, model, Document } from 'mongoose';
import { ICity } from './city.types';

export interface ICityDocument extends Omit<ICity, '_id'>, Document {}

const CitySchema = new Schema<ICityDocument>({
  name: { type: String, required: true, index: true },
  nationId: { type: Schema.Types.ObjectId as any, ref: 'Nation', required: true, index: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  
  population: { type: Number, default: 10000 },
  agriculture: { type: Number, default: 50 },
  commerce: { type: Number, default: 50 },
  security: { type: Number, default: 50 },
  defense: { type: Number, default: 50 },
  
  soldiers: { type: Number, default: 1000 },
  gold: { type: Number, default: 5000 },
  food: { type: Number, default: 10000 },
}, { timestamps: true });

CitySchema.index({ x: 1, y: 1 }, { unique: true });

export const CityModel = model<ICityDocument>('City', CitySchema);
