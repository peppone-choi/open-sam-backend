import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

export interface IGalaxyOrganizationNode extends Document {
  session_id: string;
  faction: GalaxyFactionCode;
  nodeId: string;
  parentNodeId?: string;
  title: string;
  authorityScope: {
    cards: string[];
    commandLimit?: number;
  };
  minRank: string;
  occupantCharacterId?: string;
  mailAlias?: string;
  status: 'vacant' | 'occupied' | 'locked';
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyOrganizationSchema = new Schema<IGalaxyOrganizationNode>(
  {
    session_id: { type: String, required: true, index: true },
    faction: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
      required: true,
    },
    nodeId: { type: String, required: true },
    parentNodeId: { type: String },
    title: { type: String, required: true },
    authorityScope: {
      cards: { type: [String], default: [] },
      commandLimit: { type: Number, default: 16 },
    },
    minRank: { type: String, required: true },
    occupantCharacterId: { type: String },
    mailAlias: { type: String },
    status: {
      type: String,
      enum: ['vacant', 'occupied', 'locked'],
      default: 'vacant',
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

GalaxyOrganizationSchema.index(
  { session_id: 1, nodeId: 1 },
  { unique: true }
);
GalaxyOrganizationSchema.index({ session_id: 1, faction: 1, status: 1 });

export const GalaxyOrganizationNode =
  (mongoose.models.GalaxyOrganizationNode as Model<IGalaxyOrganizationNode> | undefined) || mongoose.model<IGalaxyOrganizationNode>('GalaxyOrganizationNode', GalaxyOrganizationSchema);
