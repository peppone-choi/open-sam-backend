import { Schema, model, Document } from 'mongoose';

export interface INgBettingDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const NgBettingSchema = new Schema<INgBettingDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

NgBettingSchema.index({ sessionId: 1 });

export const NgBettingModel = model<INgBettingDocument>('NgBetting', NgBettingSchema);
