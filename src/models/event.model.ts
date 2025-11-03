import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  session_id: string;
  target: 'MONTH' | 'OCCUPY_CITY' | 'DESTROY_NATION' | 'PRE_MONTH' | 'UNITED';
  priority: number;
  condition: any; // JSON
  action: any; // JSON
}

const EventSchema = new Schema<IEvent>({
  session_id: { type: String, required: true, index: true },
  target: { type: String, enum: ['MONTH', 'OCCUPY_CITY', 'DESTROY_NATION', 'PRE_MONTH', 'UNITED'], required: true },
  priority: { type: Number, default: 1000 },
  condition: { type: Schema.Types.Mixed, required: true },
  action: { type: Schema.Types.Mixed, required: true }
}, {
  collection: 'events'
});

EventSchema.index({ session_id: 1, target: 1, priority: -1, _id: 1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);
