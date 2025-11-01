import mongoose, { Schema, Document } from 'mongoose';

export interface IKVStorage extends Document {
  session_id: string;
  storage_id?: string;
  key?: string;
  data?: Record<string, any>;
  value?: Record<string, any>;
}

const KVStorageSchema: Schema = new Schema({
  session_id: { type: String, required: true, index: true },
  storage_id: { type: String },
  key: { type: String },
  data: { type: Schema.Types.Mixed, default: {} },
  value: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'kv_storage'
});

KVStorageSchema.index({ session_id: 1, storage_id: 1 }, { unique: true });

export const KVStorage = mongoose.model<IKVStorage>('KVStorage', KVStorageSchema);
