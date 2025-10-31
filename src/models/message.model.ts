import mongoose, { Schema, Document } from 'mongoose';

/**
 * Message - message
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IMessage extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const MessageSchema = new Schema<IMessage>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'messages'
});

// 복합 인덱스 추가
MessageSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
