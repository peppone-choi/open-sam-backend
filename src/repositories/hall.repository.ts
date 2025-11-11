// @ts-nocheck
import { Hall } from '../models/hall.model';
import { DeleteResult } from 'mongodb';

/**
 * 명예의 전당 리포지토리
 */
class HallRepository {
  async findBySession(sessionId: string) {
    return Hall.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findByCategory(sessionId: string, category: string) {
    return Hall.find({ 
      session_id: sessionId, 
      category 
    }).sort({ rank: 1 });
  }

  async findById(hallId: string) {
    return Hall.findById(hallId);
  }

  async create(data: any) {
    return Hall.create(data);
  }

  async updateById(hallId: string, update: any) {
    return Hall.updateOne({ _id: hallId }, { $set: update });
  }

  async deleteById(hallId: string): Promise<DeleteResult> {
    return Hall.deleteOne({ _id: hallId });
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Hall.deleteMany({ session_id: sessionId });
  }
}

export const hallRepository = new HallRepository();
