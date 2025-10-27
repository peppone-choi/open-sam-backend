import { Schema, model, Document } from 'mongoose';
import { IEvent } from '../@types/event.types';

export interface IEventDocument extends Omit<IEvent, 'id'>, Document {
  id: string;
}

const EventSchema = new Schema<IEventDocument>(
  {
    target: {
      type: String,
      enum: ['MONTH', 'OCCUPY_CITY', 'DESTROY_NATION', 'PRE_MONTH', 'UNITED'],
      required: true,
      default: 'MONTH',
    },
    priority: { type: Number, required: true, default: 1000 },
    condition: { type: Schema.Types.Mixed, required: true },
    action: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

EventSchema.index({ target: 1, priority: 1 });

export const EventModel = model<IEventDocument>('Event', EventSchema);
