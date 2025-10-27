import { Schema, model, Document } from 'mongoose';

export interface IVoteDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const VoteSchema = new Schema<IVoteDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

VoteSchema.index({ sessionId: 1 });

export const VoteModel = model<IVoteDocument>('Vote', VoteSchema);
