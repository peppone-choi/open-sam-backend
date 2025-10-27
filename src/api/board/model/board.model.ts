import { Schema, model, Document } from 'mongoose';
import { IBoard } from '../@types/board.types';

export interface IBoardDocument extends Omit<IBoard, 'id'>, Document {
  id: string;
}

const BoardSchema = new Schema<IBoardDocument>(
  {
    sessionId: { type: String, required: true },
    nationNo: { type: String, required: true },
    isSecret: { type: Boolean, required: true, default: false },
    date: { type: Date, required: true, default: Date.now },
    generalNo: { type: String, required: true },
    author: { type: String, required: true },
    authorIcon: { type: String },
    title: { type: String, required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

BoardSchema.index({ sessionId: 1, nationNo: 1 });
BoardSchema.index({ sessionId: 1, generalNo: 1 });
BoardSchema.index({ date: -1 });

export const BoardModel = model<IBoardDocument>('Board', BoardSchema);
