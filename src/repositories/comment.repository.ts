// @ts-nocheck
import { Comment } from '../models/comment.model';
import { DeleteResult } from 'mongodb';

/**
 * 댓글 리포지토리
 */
class CommentRepository {
  async findBySession(sessionId: string) {
    return Comment.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findByBoard(sessionId: string, boardId: string) {
    return Comment.find({ 
      session_id: sessionId, 
      board_id: boardId 
    }).sort({ created_at: 1 });
  }

  async create(data: any) {
    return Comment.create(data);
  }

  async deleteById(commentId: string): Promise<DeleteResult> {
    return Comment.deleteOne({ _id: commentId });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Comment.deleteMany({ session_id: sessionId });
  }
}

export const commentRepository = new CommentRepository();
