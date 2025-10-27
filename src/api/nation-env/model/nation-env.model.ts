import { Schema, model, Document } from 'mongoose';

export interface INationEnvDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const NationEnvSchema = new Schema<INationEnvDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

NationEnvSchema.index({ sessionId: 1 });

export const NationEnvModel = model<INationEnvDocument>('NationEnv', NationEnvSchema);
