import { Schema, model, Document } from 'mongoose';

export interface IGeneralRecordDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const GeneralRecordSchema = new Schema<IGeneralRecordDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

GeneralRecordSchema.index({ sessionId: 1 });

export const GeneralRecordModel = model<IGeneralRecordDocument>('GeneralRecord', GeneralRecordSchema);
