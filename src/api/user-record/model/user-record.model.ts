import { Schema, model, Document } from 'mongoose';

export interface IUserRecordDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const UserRecordSchema = new Schema<IUserRecordDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

UserRecordSchema.index({ sessionId: 1 });

export const UserRecordModel = model<IUserRecordDocument>('UserRecord', UserRecordSchema);
