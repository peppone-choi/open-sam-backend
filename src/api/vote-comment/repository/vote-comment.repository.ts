import { VoteCommentModel } from '../model/vote-comment.model';
import { IVoteComment } from '../@types/vote-comment.types';

export class VoteCommentRepository {
  async findById(id: string): Promise<IVoteComment | null> {
    const comment = await VoteCommentModel.findById(id).lean().exec();
    return comment as IVoteComment | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IVoteComment[]> {
    const comments = await VoteCommentModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return comments as IVoteComment[];
  }

  async findByVoteId(sessionId: string, voteId: number, limit = 20, skip = 0): Promise<IVoteComment[]> {
    const comments = await VoteCommentModel.find({ sessionId, voteId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return comments as IVoteComment[];
  }

  async findByGeneralId(generalId: string, limit = 20, skip = 0): Promise<IVoteComment[]> {
    const comments = await VoteCommentModel.find({ generalId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return comments as IVoteComment[];
  }

  async findByNationId(nationId: string, limit = 20, skip = 0): Promise<IVoteComment[]> {
    const comments = await VoteCommentModel.find({ nationId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return comments as IVoteComment[];
  }

  async create(data: Partial<IVoteComment>): Promise<IVoteComment> {
    const comment = new VoteCommentModel(data);
    await comment.save();
    return comment.toObject() as IVoteComment;
  }

  async update(id: string, data: Partial<IVoteComment>): Promise<IVoteComment | null> {
    const comment = await VoteCommentModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return comment ? (comment.toObject() as IVoteComment) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await VoteCommentModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await VoteCommentModel.countDocuments(filter || {}).exec();
  }
}
