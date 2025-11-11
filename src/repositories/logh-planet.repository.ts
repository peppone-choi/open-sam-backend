// @ts-nocheck
import { Planet } from '../models/logh/Planet.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 행성 리포지토리
 */
class LoghPlanetRepository {
  async findBySession(sessionId: string) {
    return Planet.find({ session_id: sessionId });
  }

  async findByPlanetId(sessionId: string, planetId: string) {
    return Planet.findOne({ 
      session_id: sessionId, 
      planetId 
    });
  }

  async findByName(sessionId: string, name: string) {
    return Planet.findOne({ 
      session_id: sessionId, 
      name 
    });
  }

  async findByStarSystem(sessionId: string, starSystemId: string) {
    return Planet.find({ 
      session_id: sessionId, 
      starSystemId 
    });
  }

  async findByFaction(sessionId: string, controlledBy: 'empire' | 'alliance' | 'neutral') {
    return Planet.find({ 
      session_id: sessionId, 
      controlledBy 
    });
  }

  async findCapitals(sessionId: string) {
    return Planet.find({ 
      session_id: sessionId, 
      isCapital: true 
    });
  }

  async findByFilter(filter: any) {
    return Planet.find(filter);
  }

  async findOneByFilter(filter: any) {
    return Planet.findOne(filter);
  }

  async create(data: any) {
    return Planet.create(data);
  }

  async updateById(id: string, update: any) {
    return Planet.updateOne({ _id: id }, { $set: update });
  }

  async updateByPlanetId(sessionId: string, planetId: string, update: any) {
    return Planet.updateOne(
      { session_id: sessionId, planetId },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Planet.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return Planet.countDocuments(filter);
  }
}

export const loghPlanetRepository = new LoghPlanetRepository();
