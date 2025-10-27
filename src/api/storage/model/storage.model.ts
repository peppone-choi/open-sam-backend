import { Schema, model, Document } from 'mongoose';

export interface IStorageDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const StorageSchema = new Schema<IStorageDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

StorageSchema.index({ sessionId: 1 });

export const StorageModel = model<IStorageDocument>('Storage', StorageSchema);
