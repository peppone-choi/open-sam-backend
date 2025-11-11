// @ts-nocheck
import { Fleet } from '../models/logh/Fleet.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 함대 리포지토리
 */
class LoghFleetRepository {
  async findBySession(sessionId: string) {
    return Fleet.find({ session_id: sessionId });
  }

  async findByFleetId(sessionId: string, fleetId: string) {
    return Fleet.findOne({ 
      session_id: sessionId, 
      fleetId 
    });
  }

  async findByFaction(sessionId: string, faction: 'empire' | 'alliance' | 'neutral') {
    return Fleet.find({ 
      session_id: sessionId, 
      faction 
    });
  }

  async findByCommander(sessionId: string, commanderId: string) {
    return Fleet.find({ 
      session_id: sessionId, 
      commanderId 
    });
  }

  async findByGridPosition(sessionId: string, x: number, y: number) {
    return Fleet.find({ 
      session_id: sessionId,
      'strategicPosition.x': x,
      'strategicPosition.y': y
    });
  }

  async findInCombat(sessionId: string) {
    return Fleet.find({ 
      session_id: sessionId, 
      isInCombat: true 
    });
  }

  async findByFilter(filter: any) {
    return Fleet.find(filter);
  }

  async findOneByFilter(filter: any) {
    return Fleet.findOne(filter);
  }

  async create(data: any) {
    return Fleet.create(data);
  }

  async updateById(id: string, update: any) {
    return Fleet.updateOne({ _id: id }, { $set: update });
  }

  async updateByFleetId(sessionId: string, fleetId: string, update: any) {
    return Fleet.updateOne(
      { session_id: sessionId, fleetId },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Fleet.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return Fleet.countDocuments(filter);
  }
}

export const loghFleetRepository = new LoghFleetRepository();
