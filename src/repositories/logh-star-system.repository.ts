// @ts-nocheck
import { StarSystem } from '../models/logh/StarSystem.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 항성계 리포지토리
 */
class LoghStarSystemRepository {
  async findBySession(sessionId: string) {
    return StarSystem.find({ session_id: sessionId });
  }

  async findBySystemId(sessionId: string, systemId: string) {
    return StarSystem.findOne({ 
      session_id: sessionId, 
      systemId 
    });
  }

  async findByName(sessionId: string, name: string) {
    return StarSystem.findOne({ 
      session_id: sessionId, 
      name 
    });
  }

  async findByFaction(sessionId: string, controlledBy: 'empire' | 'alliance' | 'neutral') {
    return StarSystem.find({ 
      session_id: sessionId, 
      controlledBy 
    });
  }

  async findByGridPosition(sessionId: string, x: number, y: number) {
    return StarSystem.findOne({ 
      session_id: sessionId,
      'gridPosition.x': x,
      'gridPosition.y': y
    });
  }

  async findByFilter(filter: any) {
    return StarSystem.find(filter);
  }

  async findOneByFilter(filter: any) {
    return StarSystem.findOne(filter);
  }

  async create(data: any) {
    return StarSystem.create(data);
  }

  async updateById(id: string, update: any) {
    return StarSystem.updateOne({ _id: id }, { $set: update });
  }

  async updateBySystemId(sessionId: string, systemId: string, update: any) {
    return StarSystem.updateOne(
      { session_id: sessionId, systemId },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return StarSystem.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return StarSystem.countDocuments(filter);
  }
}

export const loghStarSystemRepository = new LoghStarSystemRepository();
