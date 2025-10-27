import { Schema, model, Document } from 'mongoose';
import { INationEnv } from '../@types/nation-env.types';

export interface INationEnvDocument extends Omit<INationEnv, 'id'>, Document {
  id: string;
}

const NationEnvSchema = new Schema<INationEnvDocument>(
  {
    namespace: { type: Number, required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

NationEnvSchema.index({ namespace: 1, key: 1 }, { unique: true });
NationEnvSchema.index({ namespace: 1 });

export const NationEnvModel = model<INationEnvDocument>('NationEnv', NationEnvSchema);
