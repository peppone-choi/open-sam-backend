/**
 * KVStorage 모델 - Mongoose 스키마
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IKVStorage extends Document {
  namespace: string;
  key: string;
  value: string; // JSON 문자열로 저장
  createdAt?: Date;
  updatedAt?: Date;
}

const KVStorageSchema = new Schema<IKVStorage>(
  {
    namespace: {
      type: String,
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// 복합 인덱스: namespace + key 조합은 유일해야 함
KVStorageSchema.index({ namespace: 1, key: 1 }, { unique: true });

export const KVStorageModel: Model<IKVStorage> = mongoose.model<IKVStorage>(
  'KVStorage',
  KVStorageSchema
);



