import mongoose, { Schema, Document, Model } from 'mongoose';

export type GalaxyFactionCode = 'empire' | 'alliance' | 'rebel';

export interface IEconomyState {
  status: 'stub' | 'active';
  treasury: number;
  taxRate: number;
  supplyBudget: number;
  tradeIndex: number;
  lastTick: Date | null;
  note?: string;
}

export interface IGalaxySession extends Document {
  session_id: string;
  code: string;
  title: string;
  maxPlayers: number;
  activePlayers: number;
  factions: Array<{
    name: GalaxyFactionCode;
    slots: number;
    activePlayers: number;
    status: 'open' | 'locked' | 'archived';
  }>;
  timeScale: {
    realSeconds: number;
    gameSeconds: number;
  };
  reentryPolicy: {
    allowOriginalCharacter: boolean;
    factionLock: boolean;
  };
  logisticWindowHours: number;
  victoryState?: {
    type: 'decisive' | 'limited' | 'local' | 'defeat' | null;
    achievedAt?: Date;
  };
  notifications: Array<{
    message: string;
    createdAt: Date;
    manualRef?: string;
  }>;
  economyState: IEconomyState;
  status: 'preparing' | 'running' | 'ended' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxySessionSchema = new Schema<IGalaxySession>(
  {
    session_id: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    maxPlayers: { type: Number, default: 2000, min: 2, max: 2000 },
    activePlayers: { type: Number, default: 0, min: 0 },
    factions: {
      type: [
        {
          name: {
            type: String,
            enum: ['empire', 'alliance', 'rebel'],
            required: true,
          },
          slots: { type: Number, default: 1000, min: 1 },
          activePlayers: { type: Number, default: 0, min: 0 },
          status: {
            type: String,
            enum: ['open', 'locked', 'archived'],
            default: 'open',
          },
        },
      ],
      default: [
        { name: 'empire', slots: 1000, activePlayers: 0, status: 'open' },
        { name: 'alliance', slots: 1000, activePlayers: 0, status: 'open' },
      ],
    },
    timeScale: {
      realSeconds: { type: Number, default: 1, min: 1 },
      gameSeconds: { type: Number, default: 24, min: 1 },
    },
    reentryPolicy: {
      allowOriginalCharacter: { type: Boolean, default: false },
      factionLock: { type: Boolean, default: true },
    },
    logisticWindowHours: { type: Number, default: 72, min: 1 },
    victoryState: {
      type: {
        type: String,
        enum: ['decisive', 'limited', 'local', 'defeat', null],
        default: null,
      },
      achievedAt: { type: Date },
    },
    notifications: {
      type: [
        {
          message: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          manualRef: { type: String },
        },
      ],
      default: [],
    },
    economyState: {
      status: {
        type: String,
        enum: ['stub', 'active'],
        default: 'active',
      },
      treasury: { type: Number, default: 5_000_000 },
      taxRate: { type: Number, default: 0.12 },
      supplyBudget: { type: Number, default: 2_000_000 },
      tradeIndex: { type: Number, default: 1.0 },
      lastTick: { type: Date, default: null },
      note: {
        type: String,
        default: 'Initialized from GalaxySession economyState.',
      },
    },
    status: {
      type: String,
      enum: ['preparing', 'running', 'ended', 'archived'],
      default: 'preparing',
    },
  },
  {
    timestamps: true,
  }
);

GalaxySessionSchema.index({ session_id: 1 });
GalaxySessionSchema.index({ code: 1 });

export const GalaxySession =
  (mongoose.models.GalaxySession as Model<IGalaxySession> | undefined) || mongoose.model<IGalaxySession>('GalaxySession', GalaxySessionSchema);
