import { Schema, model, Document } from 'mongoose';
import { IStorage } from '../@types/storage.types';

export interface IStorageDocument extends Omit<IStorage, 'id'>, Document {
  id: string;
}

const StorageSchema = new Schema<IStorageDocument>(
  {
    namespace: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

StorageSchema.index({ namespace: 1, key: 1 }, { unique: true });

export const StorageModel = model<IStorageDocument>('Storage', StorageSchema);
