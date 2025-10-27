import { Schema, model, Document } from 'mongoose';
import { IMessage } from '../@types/message.types';

export interface IMessageDocument extends Omit<IMessage, 'id'>, Document {
  id: string;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    sessionId: { type: String, required: true },
    mailbox: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['private', 'national', 'public', 'diplomacy'], 
      required: true 
    },
    src: { type: String, required: true },
    dest: { type: String, required: true },
    time: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date, required: true },
    message: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ sessionId: 1, dest: 1 });
MessageSchema.index({ sessionId: 1, src: 1 });
MessageSchema.index({ validUntil: 1 });

export const MessageModel = model<IMessageDocument>('Message', MessageSchema);
