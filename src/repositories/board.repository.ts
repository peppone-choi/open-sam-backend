// @ts-nocheck
import { Board } from '../models/board.model';
import { DeleteResult } from 'mongodb';

/**
 * 게시판 리포지토리
 */
class BoardRepository {
  async findBySession(sessionId: string) {
    return Board.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findById(boardId: string) {
    return Board.findById(boardId);
  }

  async create(data: any) {
    return Board.create(data);
  }

  async updateById(boardId: string, update: any) {
    return Board.updateOne({ _id: boardId }, { $set: update });
  }

  async deleteById(boardId: string): Promise<DeleteResult> {
    return Board.deleteOne({ _id: boardId });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Board.deleteMany({ session_id: sessionId });
  }
}

export const boardRepository = new BoardRepository();
