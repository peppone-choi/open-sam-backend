import { Schema, model, Document } from 'mongoose';

export interface IReservedOpenDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const ReservedOpenSchema = new Schema<IReservedOpenDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

ReservedOpenSchema.index({ sessionId: 1 });

export const ReservedOpenModel = model<IReservedOpenDocument>('ReservedOpen', ReservedOpenSchema);
