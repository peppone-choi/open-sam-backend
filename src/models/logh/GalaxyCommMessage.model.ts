import mongoose, { Schema, Document, Model } from 'mongoose';

export type GalaxyCommChannel = 'spot' | 'fleet' | 'grid' | 'global' | 'whisper';


export interface IGalaxyCommMessage extends Document {
  session_id: string;
  channelType: GalaxyCommChannel;
  scopeId?: string;
  senderCharacterId: string;
  senderName: string;
  message: string;
  addressBookLock?: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyCommMessageSchema = new Schema<IGalaxyCommMessage>(
  {
    session_id: { type: String, required: true, index: true },
    channelType: {
      type: String,
      enum: ['spot', 'fleet', 'grid', 'global', 'whisper'],
      required: true,
    },

    scopeId: { type: String },
    senderCharacterId: { type: String, required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
    addressBookLock: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

GalaxyCommMessageSchema.index({ session_id: 1, channelType: 1, createdAt: -1 });

export const GalaxyCommMessage =
  (mongoose.models.GalaxyCommMessage as Model<IGalaxyCommMessage> | undefined) || mongoose.model<IGalaxyCommMessage>('GalaxyCommMessage', GalaxyCommMessageSchema);
