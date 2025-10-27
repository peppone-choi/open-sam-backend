import { Schema, model, Document } from 'mongoose';
import { INation } from '../@types/nation.types';

/**
 * Nation Mongoose Schema
 * schema.sql의 nation 테이블 기반
 */
export interface INationDocument extends Omit<INation, 'id'>, Document {
  id: string;
}

const NationSchema = new Schema<INationDocument>(
  {
    name: { type: String, required: true },
    color: { type: String, required: true },
    
    // 수도
    capital: { type: Number, default: 0 },
    capSet: { type: String, default: '0' },
    
    // 인구 & 자원
    genNum: { type: Number, default: 1 },
    gold: { type: Number, default: 0 },
    rice: { type: Number, default: 0 },
    
    // 세율
    bill: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    rateTemp: { type: Number, default: 0 },
    
    // 외교/정보
    secretLimit: { type: Number, default: 3 },
    chiefSet: { type: Number, required: true, default: 0 },
    scout: { type: Boolean, default: false },
    war: { type: Boolean, default: false },
    
    // 커맨드
    strategicCmdLimit: { type: Number, default: 36 },
    surLimit: { type: Number, default: 72 },
    
    // 국력
    tech: { type: Number, default: 0 },
    power: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    type: { type: String, required: true, default: 'che_중립' },
    
    // JSON 필드
    spy: { type: Schema.Types.Mixed, default: {} },
    aux: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// 인덱스
NationSchema.index({ name: 1 });
NationSchema.index({ type: 1 });

export const NationModel = model<INationDocument>('Nation', NationSchema);
