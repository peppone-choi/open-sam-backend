import { Schema, model, Document } from 'mongoose';

export interface ISelectPoolDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const SelectPoolSchema = new Schema<ISelectPoolDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

SelectPoolSchema.index({ sessionId: 1 });

export const SelectPoolModel = model<ISelectPoolDocument>('SelectPool', SelectPoolSchema);
