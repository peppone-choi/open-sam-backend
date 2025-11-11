// @ts-nocheck
import { TacticalMap } from '../models/logh/TacticalMap.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 전술 맵 리포지토리
 */
class LoghTacticalMapRepository {
  async findBySession(sessionId: string) {
    return TacticalMap.find({ session_id: sessionId });
  }

  async findByMapId(sessionId: string, tacticalMapId: string) {
    return TacticalMap.findOne({ 
      session_id: sessionId, 
      tacticalMapId 
    });
  }

  async findActive(sessionId: string) {
    return TacticalMap.find({ 
      session_id: sessionId, 
      isActive: true 
    });
  }

  async findByGridPosition(sessionId: string, gridX: number, gridY: number) {
    return TacticalMap.find({ 
      session_id: sessionId, 
      gridX, 
      gridY 
    });
  }

  async findByFilter(filter: any) {
    return TacticalMap.find(filter);
  }

  async findOneByFilter(filter: any) {
    return TacticalMap.findOne(filter);
  }

  async create(data: any) {
    return TacticalMap.create(data);
  }

  async updateById(id: string, update: any) {
    return TacticalMap.updateOne({ _id: id }, { $set: update });
  }

  async updateByMapId(sessionId: string, tacticalMapId: string, update: any) {
    return TacticalMap.updateOne(
      { session_id: sessionId, tacticalMapId },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return TacticalMap.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return TacticalMap.countDocuments(filter);
  }
}

export const loghTacticalMapRepository = new LoghTacticalMapRepository();
