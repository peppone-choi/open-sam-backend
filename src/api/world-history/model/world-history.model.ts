import { Schema, model, Document } from 'mongoose';

export interface IWorldHistoryDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const WorldHistorySchema = new Schema<IWorldHistoryDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

WorldHistorySchema.index({ sessionId: 1 });

export const WorldHistoryModel = model<IWorldHistoryDocument>('WorldHistory', WorldHistorySchema);
