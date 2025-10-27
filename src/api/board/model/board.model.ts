import { Schema, model, Document } from 'mongoose';

export interface IBoardDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const BoardSchema = new Schema<IBoardDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

BoardSchema.index({ sessionId: 1 });

export const BoardModel = model<IBoardDocument>('Board', BoardSchema);
