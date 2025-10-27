import { Schema, model, Document } from 'mongoose';
import { ICity } from '../@types/city.types';

/**
 * City Mongoose Schema
 * schema.sql의 city 테이블 기반
 */
export interface ICityDocument extends Omit<ICity, 'id'>, Document {
  id: string;
}

const CitySchema = new Schema<ICityDocument>(
  {
    name: { type: String, required: true },
    level: { type: Number, required: true, default: 1 },
    nation: { type: String },
    
    // 보급/전선
    supply: { type: Number, required: true, default: 1 },
    front: { type: Boolean, required: true, default: false },
    
    // 인구
    pop: { type: Number, required: true },
    popMax: { type: Number, required: true },
    dead: { type: Number, required: true, default: 0 },
    
    // 내정 수치
    agri: { type: Number, required: true },
    agriMax: { type: Number, required: true },
    comm: { type: Number, required: true },
    commMax: { type: Number, required: true },
    secu: { type: Number, required: true },
    secuMax: { type: Number, required: true },
    trust: { type: Number, required: true },
    trade: { type: Number, default: 100 },
    
    // 방어 시설
    def: { type: Number, required: true },
    defMax: { type: Number, required: true },
    wall: { type: Number, required: true },
    wallMax: { type: Number, required: true },
    
    // 관리
    officerSet: { type: Number, required: true, default: 0 },
    state: { type: Number, required: true, default: 0 },
    region: { type: Number, required: true },
    term: { type: Number, required: true, default: 0 },
    
    // JSON 필드
    conflict: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// 인덱스
CitySchema.index({ nation: 1 });
CitySchema.index({ name: 1 });
CitySchema.index({ region: 1 });

export const CityModel = model<ICityDocument>('City', CitySchema);
