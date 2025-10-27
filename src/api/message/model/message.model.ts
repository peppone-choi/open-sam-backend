import { Schema, model, Document } from 'mongoose';

export interface IMessageDocument extends Document {
  sessionId: string;
  mailbox: number;
  type: 'private' | 'national' | 'public' | 'diplomacy';
  src: string;
  dest: string;
  time: Date;
  validUntil: Date;
  message: string;
}

const MessageSchema = new Schema<IMessageDocument>({
  sessionId: { type: String, required: true },
  mailbox: { type: Number, required: true },
  type: { type: String, enum: ['private', 'national', 'public', 'diplomacy'], required: true },
  src: { type: String, required: true },
  dest: { type: String, required: true },
  time: { type: Date, default: Date.now },
  validUntil: { type: Date, default: () => new Date('9999-12-31') },
  message: { type: String, required: true },
}, { timestamps: true });

MessageSchema.index({ sessionId: 1, mailbox: 1, time: -1 });

export const MessageModel = model<IMessageDocument>('Message', MessageSchema);
