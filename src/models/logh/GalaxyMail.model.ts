import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGalaxyMail extends Document {
  session_id: string;
  mailId: string;
  fromCharacterId: string;
  fromName: string;
  fromAddress: string; // personal or job-based address
  toCharacterId: string;
  toName: string;
  toAddress: string;
  subject: string;
  body: string;
  isRead: boolean;
  replyToMailId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyMailSchema = new Schema<IGalaxyMail>(
  {
    session_id: { type: String, required: true, index: true },
    mailId: { type: String, required: true, unique: true },
    fromCharacterId: { type: String, required: true },
    fromName: { type: String, required: true },
    fromAddress: { type: String, required: true },
    toCharacterId: { type: String, required: true },
    toName: { type: String, required: true },
    toAddress: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    isRead: { type: Boolean, default: false },
    replyToMailId: { type: String },
  },
  {
    timestamps: true,
  }
);

GalaxyMailSchema.index({ session_id: 1, toCharacterId: 1, createdAt: -1 });
GalaxyMailSchema.index({ session_id: 1, fromCharacterId: 1, createdAt: -1 });

export const GalaxyMail =
  (mongoose.models.GalaxyMail as Model<IGalaxyMail> | undefined) || mongoose.model<IGalaxyMail>('GalaxyMail', GalaxyMailSchema);
