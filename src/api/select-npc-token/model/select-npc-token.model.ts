import { Schema, model, Document } from 'mongoose';

export interface ISelectNpcTokenDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const SelectNpcTokenSchema = new Schema<ISelectNpcTokenDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

SelectNpcTokenSchema.index({ sessionId: 1 });

export const SelectNpcTokenModel = model<ISelectNpcTokenDocument>('SelectNpcToken', SelectNpcTokenSchema);
