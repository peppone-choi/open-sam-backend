import { Schema, model, Document } from 'mongoose';

export interface IEventDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const EventSchema = new Schema<IEventDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

EventSchema.index({ sessionId: 1 });

export const EventModel = model<IEventDocument>('Event', EventSchema);
