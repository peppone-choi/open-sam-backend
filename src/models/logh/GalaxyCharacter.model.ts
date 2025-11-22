import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

export type GalaxyOriginType = 'original' | 'generated';
export type GalaxyCharacterStatus = 'active' | 'offline' | 'arrested' | 'mia' | 'kia';

export interface ICommandCard {
  cardId: string;
  name: string;
  category: 'personal' | 'fleet' | 'logistics' | 'politics' | 'intel';
  commands: string[];
}

export interface IGalaxyCharacter extends Document {
  session_id: string;
  characterId: string;
  userId: string;
  displayName: string;
  originType: GalaxyOriginType;
  faction: GalaxyFactionCode;
  rank: string;
  title?: string;
  evaluationPoints: number;
  famePoints: number;
  reputation: {
    merit: number;
    honor: number;
  };
  commandPoints: {
    pcp: number;
    mcp: number;
    lastRecoveredAt: Date;
  };
  commandCards: ICommandCard[];
  parameters: {
    leadership: number;
    politics: number;
    logistics: number;
    intelligence: number;
    command: number;
    maneuver: number;
    attack: number;
    defense: number;
  };
  mailbox: {
    personal: string;
    roles: string[];
  };
  organizationNodeId?: string;
  flagshipId?: string;
  status: GalaxyCharacterStatus;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const CommandCardSchema = new Schema<ICommandCard>(
  {
    cardId: { type: String, required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['personal', 'fleet', 'logistics', 'politics', 'intel'],
      default: 'personal',
    },
    commands: { type: [String], default: [] },
  },
  { _id: false }
);

const GalaxyCharacterSchema = new Schema<IGalaxyCharacter>(
  {
    session_id: { type: String, required: true, index: true },
    characterId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    originType: {
      type: String,
      enum: ['original', 'generated'],
      default: 'generated',
    },
    faction: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
      required: true,
    },
    rank: { type: String, required: true },
    title: { type: String },
    evaluationPoints: { type: Number, default: 0 },
    famePoints: { type: Number, default: 0 },
    reputation: {
      merit: { type: Number, default: 0 },
      honor: { type: Number, default: 0 },
    },
    commandPoints: {
      pcp: { type: Number, default: 12, min: 0 },
      mcp: { type: Number, default: 12, min: 0 },
      lastRecoveredAt: { type: Date, default: Date.now },
    },
    commandCards: { type: [CommandCardSchema], default: [] },
    parameters: {
      leadership: { type: Number, default: 40 },
      politics: { type: Number, default: 40 },
      logistics: { type: Number, default: 40 },
      intelligence: { type: Number, default: 40 },
      command: { type: Number, default: 40 },
      maneuver: { type: Number, default: 40 },
      attack: { type: Number, default: 40 },
      defense: { type: Number, default: 40 },
    },
    mailbox: {
      personal: { type: String, required: true },
      roles: { type: [String], default: [] },
    },
    organizationNodeId: { type: String },
    flagshipId: { type: String },
    status: {
      type: String,
      enum: ['active', 'offline', 'arrested', 'mia', 'kia'],
      default: 'active',
    },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

GalaxyCharacterSchema.index({ session_id: 1, characterId: 1 }, { unique: true });
GalaxyCharacterSchema.index({ session_id: 1, faction: 1 });
GalaxyCharacterSchema.index({ organizationNodeId: 1 });

export const GalaxyCharacter =
  (mongoose.models.GalaxyCharacter as Model<IGalaxyCharacter> | undefined) || mongoose.model<IGalaxyCharacter>('GalaxyCharacter', GalaxyCharacterSchema);
