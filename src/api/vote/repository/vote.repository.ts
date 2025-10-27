import { VoteModel } from '../model/vote.model';
import { IVote } from '../@types/vote.types';

export class VoteRepository {
  async findById(id: string): Promise<IVote | null> {
    const vote = await VoteModel.findById(id).lean().exec();
    return vote as IVote | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IVote[]> {
    const votes = await VoteModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return votes as IVote[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IVote[]> {
    const votes = await VoteModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return votes as IVote[];
  }

  async findByVoteId(sessionId: string, voteId: number): Promise<IVote[]> {
    const votes = await VoteModel.find({ sessionId, voteId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return votes as IVote[];
  }

  async findByNationId(nationId: string, limit = 20, skip = 0): Promise<IVote[]> {
    const votes = await VoteModel.find({ nationId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return votes as IVote[];
  }

  async findByGeneralId(generalId: string): Promise<IVote[]> {
    const votes = await VoteModel.find({ generalId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return votes as IVote[];
  }

  async create(data: Partial<IVote>): Promise<IVote> {
    const vote = new VoteModel(data);
    await vote.save();
    return vote.toObject() as IVote;
  }

  async update(id: string, data: Partial<IVote>): Promise<IVote | null> {
    const vote = await VoteModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return vote ? (vote.toObject() as IVote) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await VoteModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await VoteModel.countDocuments(filter || {}).exec();
  }
}
