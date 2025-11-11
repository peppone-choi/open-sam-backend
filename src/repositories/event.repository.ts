// @ts-nocheck
import { Event } from '../models/event.model';
import { DeleteResult } from 'mongodb';

/**
 * 이벤트 리포지토리
 */
class EventRepository {
  async findBySession(sessionId: string) {
    return Event.find({ session_id: sessionId }).sort({ created_at: -1 });
  }

  async findRecent(sessionId: string, limit: number = 50) {
    return Event.find({ session_id: sessionId })
      .sort({ created_at: -1 })
      .limit(limit);
  }

  async create(data: any) {
    return Event.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return Event.deleteMany({ session_id: sessionId });
  }
}

export const eventRepository = new EventRepository();
