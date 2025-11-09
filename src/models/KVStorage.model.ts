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

// 모델이 이미 컴파일되었는지 확인하고, 없을 때만 생성
// 기존 모델이 있어도 스키마에 namespace 필드가 없으면 재생성
let KVStorageModel: Model<IKVStorage>;

if (mongoose.models['KVStorage']) {
  const existingModel = mongoose.models['KVStorage'] as Model<IKVStorage>;
  // 스키마에 namespace 필드가 있는지 확인
  const schema = existingModel.schema;
  if (schema.paths['namespace']) {
    KVStorageModel = existingModel;
  } else {
    // namespace 필드가 없으면 모델 삭제 후 재생성
    Reflect.deleteProperty(mongoose.models, 'KVStorage');
    Reflect.deleteProperty(mongoose.connection.models, 'KVStorage');
    KVStorageModel = mongoose.model<IKVStorage>('KVStorage', KVStorageSchema);
  }
} else {
  KVStorageModel = mongoose.model<IKVStorage>('KVStorage', KVStorageSchema);
}

export { KVStorageModel };



