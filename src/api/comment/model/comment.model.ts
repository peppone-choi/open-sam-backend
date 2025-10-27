import { Schema, model, Document } from 'mongoose';

export interface ICommentDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const CommentSchema = new Schema<ICommentDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

CommentSchema.index({ sessionId: 1 });

export const CommentModel = model<ICommentDocument>('Comment', CommentSchema);
