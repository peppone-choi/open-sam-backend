import { Schema, model, Document } from 'mongoose';
import { IComment } from '../@types/comment.types';

export interface ICommentDocument extends Omit<IComment, 'id'>, Document {
  id: string;
}

const CommentSchema = new Schema<ICommentDocument>(
  {
    sessionId: { type: String, required: true },
    nationNo: { type: String, required: true },
    isSecret: { type: Boolean, required: true, default: false },
    date: { type: Date, required: true, default: Date.now },
    documentNo: { type: String, required: true },
    generalNo: { type: String, required: true },
    author: { type: String, required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

CommentSchema.index({ sessionId: 1, documentNo: 1 });
CommentSchema.index({ sessionId: 1, generalNo: 1 });
CommentSchema.index({ date: -1 });

export const CommentModel = model<ICommentDocument>('Comment', CommentSchema);
