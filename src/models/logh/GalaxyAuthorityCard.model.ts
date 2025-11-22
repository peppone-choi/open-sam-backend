import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

export type AuthorityCardCategory =
  | 'personal'
  | 'fleet'
  | 'logistics'
  | 'politics'
  | 'intel';

export interface ICommandPermission {
  code: string;
  label?: string;
  cpCost?: {
    pcp?: number;
    mcp?: number;
  };
}

export interface IGalaxyAuthorityCard extends Document {
  session_id: string;
  cardId: string;
  templateId: string;
  faction: GalaxyFactionCode;
  title: string;
  category: AuthorityCardCategory;
  commandCodes: string[];
  commandGroups: string[];
  manualRef: string;
  description?: string;
  mailAlias?: string;
  organizationNodeId?: string;
  holderCharacterId?: string;
  holderUserId?: string;
  status: 'available' | 'assigned' | 'locked' | 'revoked';
  maxHolders: number;
  permissions?: ICommandPermission[];
  metadata?: Record<string, any>;
  lastIssuedAt?: Date;
  lastRevokedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyAuthorityCardSchema = new Schema<IGalaxyAuthorityCard>(
  {
    session_id: { type: String, required: true, index: true },
    cardId: { type: String, required: true },
    templateId: { type: String, required: true },
    faction: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
      required: true,
    },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['personal', 'fleet', 'logistics', 'politics', 'intel'],
      default: 'personal',
    },
    commandCodes: { type: [String], default: [] },
    commandGroups: { type: [String], default: [] },
    manualRef: { type: String, required: true },
    description: { type: String },
    mailAlias: { type: String },
    organizationNodeId: { type: String },
    holderCharacterId: { type: String, index: true },
    holderUserId: { type: String },
    status: {
      type: String,
      enum: ['available', 'assigned', 'locked', 'revoked'],
      default: 'available',
    },
    maxHolders: { type: Number, default: 1, min: 1 },
    permissions: [
      {
        code: { type: String, required: true },
        label: { type: String },
        cpCost: {
          pcp: { type: Number, default: 0 },
          mcp: { type: Number, default: 0 },
        },
      },
    ],
    metadata: { type: Schema.Types.Mixed },
    lastIssuedAt: { type: Date },
    lastRevokedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

GalaxyAuthorityCardSchema.index(
  { session_id: 1, cardId: 1 },
  { unique: true }
);

GalaxyAuthorityCardSchema.index({ session_id: 1, templateId: 1 });

export const GalaxyAuthorityCard =
  (mongoose.models.GalaxyAuthorityCard as Model<IGalaxyAuthorityCard> | undefined) || mongoose.model<IGalaxyAuthorityCard>('GalaxyAuthorityCard', GalaxyAuthorityCardSchema);
