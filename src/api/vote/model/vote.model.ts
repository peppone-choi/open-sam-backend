import { Schema, model, Document } from 'mongoose';
import { IVote } from '../@types/vote.types';

export interface IVoteDocument extends Omit<IVote, 'id'>, Document {
  id: string;
}

const VoteSchema = new Schema<IVoteDocument>(
  {
    sessionId: { type: String, required: true },
    voteId: { type: Number, required: true },
    generalId: { type: String, required: true },
    nationId: { type: String, required: true },
    selection: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

VoteSchema.index({ sessionId: 1, voteId: 1 });
VoteSchema.index({ generalId: 1 });
VoteSchema.index({ nationId: 1 });

export const VoteModel = model<IVoteDocument>('Vote', VoteSchema);
