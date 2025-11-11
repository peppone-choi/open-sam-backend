// @ts-nocheck
import { LoghCommander } from '../models/logh/Commander.model';
import { DeleteResult } from 'mongodb';

/**
 * LOGH 커맨더 리포지토리
 */
class LoghCommanderRepository {
  async findBySession(sessionId: string) {
    return LoghCommander.find({ session_id: sessionId });
  }

  async findByNo(sessionId: string, commanderNo: number) {
    return LoghCommander.findOne({ 
      session_id: sessionId, 
      no: commanderNo 
    });
  }

  async findByFaction(sessionId: string, faction: 'empire' | 'alliance') {
    return LoghCommander.find({ 
      session_id: sessionId, 
      faction 
    });
  }

  async findByOwner(sessionId: string, owner: string) {
    return LoghCommander.find({ 
      session_id: sessionId, 
      owner 
    });
  }

  async findByFilter(filter: any) {
    return LoghCommander.find(filter);
  }

  async findOneByFilter(filter: any) {
    return LoghCommander.findOne(filter);
  }

  async create(data: any) {
    return LoghCommander.create(data);
  }

  async updateById(id: string, update: any) {
    return LoghCommander.updateOne({ _id: id }, { $set: update });
  }

  async updateByNo(sessionId: string, commanderNo: number, update: any) {
    return LoghCommander.updateOne(
      { session_id: sessionId, no: commanderNo },
      { $set: update }
    );
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return LoghCommander.deleteMany({ session_id: sessionId });
  }

  async countByFilter(filter: any): Promise<number> {
    return LoghCommander.countDocuments(filter);
  }
}

export const loghCommanderRepository = new LoghCommanderRepository();
