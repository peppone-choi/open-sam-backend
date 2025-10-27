import { Schema, model, Document } from 'mongoose';

export interface INgHistoryDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const NgHistorySchema = new Schema<INgHistoryDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

NgHistorySchema.index({ sessionId: 1 });

export const NgHistoryModel = model<INgHistoryDocument>('NgHistory', NgHistorySchema);
