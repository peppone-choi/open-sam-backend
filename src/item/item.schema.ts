import { Schema, model, Document } from 'mongoose';
import { IItem } from './item.types';

export interface IItemDocument extends Omit<IItem, '_id'>, Document {}

const ItemSchema = new Schema<IItemDocument>({
  name: { type: String, required: true },
  type: { type: String, enum: ['weapon', 'armor', 'accessory'], required: true },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  effects: { type: Map, of: Number, default: new Map() },
  ownerId: { type: Schema.Types.ObjectId as any, ref: 'General', default: null },
}, { timestamps: true });

export const ItemModel = model<IItemDocument>('Item', ItemSchema);
