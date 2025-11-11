// @ts-nocheck
import { MapGrid } from '../models/logh/MapGrid.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 맵 그리드 리포지토리
 */
class LoghMapGridRepository {
  async findBySession(sessionId: string) {
    return MapGrid.find({ session_id: sessionId });
  }

  async findByCoordinates(sessionId: string, x: number, y: number) {
    return MapGrid.findOne({ 
      session_id: sessionId, 
      x, 
      y 
    });
  }

  async findByType(sessionId: string, gridType: string) {
    return MapGrid.find({ 
      session_id: sessionId, 
      gridType 
    });
  }

  async findInRange(sessionId: string, minX: number, maxX: number, minY: number, maxY: number) {
    return MapGrid.find({
      session_id: sessionId,
      x: { $gte: minX, $lte: maxX },
      y: { $gte: minY, $lte: maxY }
    });
  }

  async findByFilter(filter: any) {
    return MapGrid.find(filter);
  }

  async findOneByFilter(filter: any) {
    return MapGrid.findOne(filter);
  }

  async create(data: any) {
    return MapGrid.create(data);
  }

  async updateByCoordinates(sessionId: string, x: number, y: number, update: any) {
    return MapGrid.updateOne(
      { session_id: sessionId, x, y },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return MapGrid.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return MapGrid.countDocuments(filter);
  }
}

export const loghMapGridRepository = new LoghMapGridRepository();
