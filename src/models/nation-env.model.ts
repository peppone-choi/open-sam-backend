import mongoose, { Schema, Document } from 'mongoose';

export interface INationEnv extends Document {
  session_id: string;
  namespace: number; // nation ID
  key: string;
  value: any; // JSON value
}

const NationEnvSchema: Schema = new Schema({
  session_id: { type: String, required: true, index: true },
  namespace: { type: Number, required: true },
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true }
}, {
  timestamps: true,
  collection: 'nation_env'
});

NationEnvSchema.index({ session_id: 1, namespace: 1, key: 1 }, { unique: true });

export const NationEnv = mongoose.models.NationEnv || mongoose.model<INationEnv>('NationEnv', NationEnvSchema);

