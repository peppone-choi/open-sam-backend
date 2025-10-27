import { Schema, model, Document } from 'mongoose';

export interface IGeneralAccessLogDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const GeneralAccessLogSchema = new Schema<IGeneralAccessLogDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

GeneralAccessLogSchema.index({ sessionId: 1 });

export const GeneralAccessLogModel = model<IGeneralAccessLogDocument>('GeneralAccessLog', GeneralAccessLogSchema);
