// @ts-nocheck
import { VoteComment } from '../models/vote_comment.model';
import { DeleteResult } from 'mongodb';

/**
 * 투표 댓글 리포지토리
 */
class VoteCommentRepository {
  async findBySession(sessionId: string) {
    return VoteComment.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findByVote(sessionId: string, voteId: string) {
    return VoteComment.find({ 
      session_id: sessionId, 
      vote_id: voteId 
    }).sort({ created_at: 1 });
  }

  async create(data: any) {
    return VoteComment.create(data);
  }

  async deleteById(commentId: string): Promise<DeleteResult> {
    return VoteComment.deleteOne({ _id: commentId });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return VoteComment.deleteMany({ session_id: sessionId });
  }
}

export const voteCommentRepository = new VoteCommentRepository();
