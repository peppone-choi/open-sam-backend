import { Schema, model, Document } from 'mongoose';

export interface IRankDataDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const RankDataSchema = new Schema<IRankDataDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

RankDataSchema.index({ sessionId: 1 });

export const RankDataModel = model<IRankDataDocument>('RankData', RankDataSchema);
