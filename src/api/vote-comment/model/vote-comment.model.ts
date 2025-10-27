import { Schema, model, Document } from 'mongoose';

export interface IVoteCommentDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const VoteCommentSchema = new Schema<IVoteCommentDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

VoteCommentSchema.index({ sessionId: 1 });

export const VoteCommentModel = model<IVoteCommentDocument>('VoteComment', VoteCommentSchema);
