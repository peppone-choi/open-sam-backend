import { EventRepository } from '../repository/event.repository';
import { IEvent } from '../@types/event.types';

/**
 * Event Service
 * 
 * Manages in-game events with priority-based queuing and target-specific event handling
 */
export class EventService {
  constructor(private repository: EventRepository) {}

  async getById(id: string): Promise<IEvent | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IEvent[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByTarget(target: string, limit = 20, skip = 0): Promise<IEvent[]> {
    return await this.repository.findByTarget(target, limit, skip);
  }

  async create(data: Partial<IEvent>): Promise<IEvent> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IEvent>): Promise<IEvent | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
