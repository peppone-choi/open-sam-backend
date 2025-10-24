import { Schema, model, Document } from 'mongoose';
import { ICommand } from './command.types';

export interface ICommandDocument extends Omit<ICommand, '_id'>, Document {}

const CommandSchema = new Schema<ICommandDocument>({
  generalId: { type: Schema.Types.ObjectId as any, ref: 'General', required: true, index: true },
  type: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending', 
    index: true 
  },
  payload: { type: Schema.Types.Mixed, default: {} },
  scheduledAt: { type: Date, required: true, index: true },
  executedAt: { type: Date, default: null },
}, { timestamps: true });

export const CommandModel = model<ICommandDocument>('Command', CommandSchema);
