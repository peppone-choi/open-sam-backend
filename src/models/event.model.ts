import mongoose, { Schema, Document } from 'mongoose';

/**
 * Event - event
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IEvent extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const EventSchema = new Schema<IEvent>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'events'
});

// 복합 인덱스 추가
EventSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const Event = mongoose.model<IEvent>('Event', EventSchema);
