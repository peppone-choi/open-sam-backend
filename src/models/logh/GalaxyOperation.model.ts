import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGalaxyOperationParticipant {
  characterId: string;
  fleetId?: string;
  role: 'author' | 'executor' | 'logistics' | 'observer';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export interface IGalaxyOperation extends Document {
  session_id: string;
  operationId: string;
  code: string;
  authorCharacterId: string;
  cardType: string;
  objectiveType: 'assault' | 'defense' | 'occupation' | 'sweep' | 'logistics' | 'escort' | 'resupply';
  targetGrid: { x: number; y: number };
  cpCost: { pcp: number; mcp: number; substituted?: boolean };
  timeline: {
    waitHours: number;
    executionHours: number;
    issuedAt: Date;
  };
  logistics: {
    fuelCrates: number;
    supplyHours: number;
    unitBatchLimit: number;
    planetsTouched: string[];
  };
  terrainRisk?: {
    terrainType: string;
    hazardLevel: number;
    impassable: boolean;
  };
  participants: IGalaxyOperationParticipant[];
  status: 'draft' | 'issued' | 'approved' | 'executing' | 'completed' | 'aborted';
  auditTrail: Array<{ note: string; createdAt: Date; author: string }>;
  createdAt?: Date;
  updatedAt?: Date;
}

const ParticipantSchema = new Schema<IGalaxyOperationParticipant>(
  {
    characterId: { type: String, required: true },
    fleetId: { type: String },
    role: {
      type: String,
      enum: ['author', 'executor', 'logistics', 'observer'],
      default: 'executor',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
  },
  { _id: false }
);

const GalaxyOperationSchema = new Schema<IGalaxyOperation>(
  {
    session_id: { type: String, required: true, index: true },
    operationId: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    authorCharacterId: { type: String, required: true },
    cardType: { type: String, required: true },
    objectiveType: {
      type: String,
      enum: ['assault', 'defense', 'occupation', 'sweep', 'logistics', 'escort', 'resupply'],
      default: 'assault',
    },
    targetGrid: {
      x: { type: Number, required: true, min: 0 },
      y: { type: Number, required: true, min: 0 },
    },
    cpCost: {
      pcp: { type: Number, default: 0 },
      mcp: { type: Number, default: 0 },
      substituted: { type: Boolean, default: false },
    },
    timeline: {
      waitHours: { type: Number, default: 1 },
      executionHours: { type: Number, default: 6 },
      issuedAt: { type: Date, default: Date.now },
    },
    logistics: {
      fuelCrates: { type: Number, default: 0 },
      supplyHours: { type: Number, default: 0 },
      unitBatchLimit: { type: Number, default: 300, max: 300 },
      planetsTouched: { type: [String], default: [] },
    },
    terrainRisk: {
      terrainType: { type: String, default: 'normal' },
      hazardLevel: { type: Number, default: 0 },
      impassable: { type: Boolean, default: false },
    },
    participants: { type: [ParticipantSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'issued', 'approved', 'executing', 'completed', 'aborted'],
      default: 'draft',
    },
    auditTrail: {
      type: [
        {
          note: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          author: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

GalaxyOperationSchema.index({ session_id: 1, code: 1 });
GalaxyOperationSchema.index({ session_id: 1, authorCharacterId: 1 });

export const GalaxyOperation =
  (mongoose.models.GalaxyOperation as Model<IGalaxyOperation> | undefined) || mongoose.model<IGalaxyOperation>('GalaxyOperation', GalaxyOperationSchema);
