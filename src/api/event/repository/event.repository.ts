import { EventModel, IEventDocument } from '../model/event.model';
import { IEvent } from '../@types/event.types';

export class EventRepository {
  async findById(id: string): Promise<IEvent | null> {
    const event = await EventModel.findById(id).lean().exec();
    return event as IEvent | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IEvent[]> {
    const events = await EventModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ priority: 1, createdAt: 1 })
      .lean()
      .exec();
    
    return events as IEvent[];
  }

  async findByTarget(target: string, limit = 20, skip = 0): Promise<IEvent[]> {
    const events = await EventModel.find({ target })
      .limit(limit)
      .skip(skip)
      .sort({ priority: 1 })
      .lean()
      .exec();
    
    return events as IEvent[];
  }

  async create(data: Partial<IEvent>): Promise<IEvent> {
    const event = new EventModel(data);
    await event.save();
    return event.toObject() as IEvent;
  }

  async update(id: string, data: Partial<IEvent>): Promise<IEvent | null> {
    const event = await EventModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return event ? (event.toObject() as IEvent) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await EventModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await EventModel.countDocuments(filter || {}).exec();
  }
}
