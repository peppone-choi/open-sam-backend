import mongoose, { Schema, Document } from 'mongoose';

export interface IGeneralLog extends Document {
  id: number;
  session_id: string;
  general_id: number;
  log_type: string;
  message: string;
  data: Record<string, any>;
  created_at: Date;
}

const GeneralLogSchema: Schema = new Schema({
  id: { type: Number, required: true },
  session_id: { type: String, required: true, index: true },
  general_id: { type: Number, required: true, index: true },
  log_type: { type: String, required: true, index: true },
  message: { type: String, default: '' },
  data: { type: Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: false,
  collection: 'general_log'
});

GeneralLogSchema.index({ session_id: 1, general_id: 1, log_type: 1 });
GeneralLogSchema.index({ id: -1 });

export const GeneralLog = mongoose.model<IGeneralLog>('GeneralLog', GeneralLogSchema);
