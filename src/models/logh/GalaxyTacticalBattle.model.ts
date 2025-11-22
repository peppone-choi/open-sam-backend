import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

export interface ITacticalFactionState {
  code: GalaxyFactionCode | 'rebel';
  label: string;
  commanderIds: string[];
  unitCount: number;
  isRebel?: boolean;
}

export interface IPlanetState {
  name: string;
  occupied: boolean;
  occupiedBy?: GalaxyFactionCode | 'rebel';
}

export interface IGalaxyTacticalBattle extends Document {
  session_id: string;
  battleId: string;
  gridId: string;
  status: 'pending' | 'active' | 'resolved';
  factions: ITacticalFactionState[];
  planetStates: IPlanetState[];
  victoryCheck: {
    enemyPresence: boolean;
    occupiedAllPlanets: boolean;
    resolvedAt?: Date;
  };
  casualtyReport: Array<{
    faction: string;
    shipsLost: number;
    troopsLost: number;
  }>;
  rewards: Array<{
    characterId: string;
    fame: number;
    evaluation: number;
  }>;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const FactionStateSchema = new Schema<ITacticalFactionState>(
  {
    code: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
      required: true,
    },
    label: { type: String, required: true },
    commanderIds: { type: [String], default: [] },
    unitCount: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value <= 300,
        message: '진영별 참여 유닛 수는 최대 300기입니다.'
      },
    },
    isRebel: { type: Boolean, default: false },
  },
  { _id: false }
);

const PlanetStateSchema = new Schema<IPlanetState>(
  {
    name: { type: String, required: true },
    occupied: { type: Boolean, default: false },
    occupiedBy: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
    },
  },
  { _id: false }
);

const GalaxyTacticalBattleSchema = new Schema<IGalaxyTacticalBattle>(
  {
    session_id: { type: String, required: true, index: true },
    battleId: { type: String, required: true, unique: true },
    gridId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'resolved'],
      default: 'pending',
    },
    factions: {
      type: [FactionStateSchema],
      validate: {
        validator: (factions: ITacticalFactionState[]) => factions.length <= 2,
        message: '하나의 격자에서는 동시에 두 진영만 교전할 수 있습니다.',
      },
    },
    planetStates: { type: [PlanetStateSchema], default: [] },
    victoryCheck: {
      enemyPresence: { type: Boolean, default: true },
      occupiedAllPlanets: { type: Boolean, default: false },
      resolvedAt: { type: Date },
    },
    casualtyReport: {
      type: [
        {
          faction: { type: String, required: true },
          shipsLost: { type: Number, default: 0 },
          troopsLost: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    rewards: {
      type: [
        {
          characterId: { type: String, required: true },
          fame: { type: Number, default: 0 },
          evaluation: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

GalaxyTacticalBattleSchema.index({ session_id: 1, gridId: 1, status: 1 });

export const GalaxyTacticalBattle =
  (mongoose.models.GalaxyTacticalBattle as Model<IGalaxyTacticalBattle> | undefined) ||
  mongoose.model<IGalaxyTacticalBattle>('GalaxyTacticalBattle', GalaxyTacticalBattleSchema);
