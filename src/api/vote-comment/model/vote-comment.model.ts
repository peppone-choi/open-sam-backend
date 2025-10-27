import { Schema, model, Document } from 'mongoose';
import { IVoteComment } from '../@types/vote-comment.types';

export interface IVoteCommentDocument extends Omit<IVoteComment, 'id'>, Document {
  id: string;
}

const VoteCommentSchema = new Schema<IVoteCommentDocument>(
  {
    sessionId: { type: String, required: true },
    voteId: { type: Number, required: true },
    generalId: { type: String, required: true },
    nationId: { type: String, required: true },
    generalName: { type: String, required: true },
    nationName: { type: String, required: true },
    text: { type: String, required: true },
    date: { type: Date },
  },
  {
    timestamps: true,
  }
);

VoteCommentSchema.index({ sessionId: 1, voteId: 1 });
VoteCommentSchema.index({ generalId: 1 });
VoteCommentSchema.index({ nationId: 1 });
VoteCommentSchema.index({ createdAt: -1 });

export const VoteCommentModel = model<IVoteCommentDocument>('VoteComment', VoteCommentSchema);
