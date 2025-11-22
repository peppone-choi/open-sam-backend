import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGalaxyCommHandshake extends Document {
  session_id: string;
  handshakeId: string;
  requesterCharacterId: string;
  targetCharacterId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyCommHandshakeSchema = new Schema<IGalaxyCommHandshake>(
  {
    session_id: { type: String, required: true, index: true },
    handshakeId: { type: String, required: true, unique: true },
    requesterCharacterId: { type: String, required: true },
    targetCharacterId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

GalaxyCommHandshakeSchema.index({ session_id: 1, requesterCharacterId: 1, status: 1 });

export const GalaxyCommHandshake =
  (mongoose.models.GalaxyCommHandshake as Model<IGalaxyCommHandshake> | undefined) || mongoose.model<IGalaxyCommHandshake>('GalaxyCommHandshake', GalaxyCommHandshakeSchema);
