import mongoose, { Schema, Document } from 'mongoose';

export interface IBannedEmail extends Document {
  email: string;
  reason?: string;
  createdAt: Date;
}

const BannedEmailSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const BannedEmail = mongoose.models.BannedEmail || mongoose.model<IBannedEmail>('BannedEmail', BannedEmailSchema);
