import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Ground Combat State Model
 * 지상전 상태 및 점령 현황 관리
 */

export interface ISupplyBatch {
  batchId: string;
  type: 'fuel' | 'ammunition' | 'rations' | 'medical';
  quantity: number;
  location: string;
  assignedUnits: string[];
  status: 'available' | 'deployed' | 'exhausted';
}

export interface IWarehouseStock {
  warehouseId: string;
  planetId: string;
  faction: 'empire' | 'alliance' | 'rebel';
  inventory: {
    fuel: number;
    ammunition: number;
    rations: number;
    medical: number;
    equipment: number;
  };
  capacity: number;
  lastUpdated: Date;
}

export interface IOccupationStatus {
  planetId: string;
  planetName: string;
  controllingFaction: 'empire' | 'alliance' | 'rebel' | 'neutral';
  occupationProgress: number; // 0-100%
  defenseStrength: number;
  garrisonUnits: number;
  supplyLines: string[];
  status: 'contested' | 'secured' | 'under_siege';
}

export interface IGalaxyGroundCombat extends Document {
  session_id: string;
  battleId: string;
  gridCoordinates: { x: number; y: number };
  factions: Array<{
    code: 'empire' | 'alliance' | 'rebel';
    commanderIds: string[];
    groundUnits: number;
  }>;
  occupationStatus: IOccupationStatus[];
  supplyBatches: ISupplyBatch[];
  warehouseStocks: IWarehouseStock[];
  combatPhase: 'landing' | 'engagement' | 'occupation' | 'withdrawal' | 'completed';
  startedAt: Date;
  lastUpdateAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const SupplyBatchSchema = new Schema<ISupplyBatch>(
  {
    batchId: { type: String, required: true },
    type: { type: String, enum: ['fuel', 'ammunition', 'rations', 'medical'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
    assignedUnits: { type: [String], default: [] },
    status: { type: String, enum: ['available', 'deployed', 'exhausted'], default: 'available' },
  },
  { _id: false }
);

const WarehouseStockSchema = new Schema<IWarehouseStock>(
  {
    warehouseId: { type: String, required: true },
    planetId: { type: String, required: true },
    faction: { type: String, enum: ['empire', 'alliance', 'rebel'], required: true },
    inventory: {
      fuel: { type: Number, default: 0 },
      ammunition: { type: Number, default: 0 },
      rations: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      equipment: { type: Number, default: 0 },
    },
    capacity: { type: Number, required: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OccupationStatusSchema = new Schema<IOccupationStatus>(
  {
    planetId: { type: String, required: true },
    planetName: { type: String, required: true },
    controllingFaction: {
      type: String,
      enum: ['empire', 'alliance', 'rebel', 'neutral'],
      default: 'neutral',
    },
    occupationProgress: { type: Number, default: 0, min: 0, max: 100 },
    defenseStrength: { type: Number, default: 100 },
    garrisonUnits: { type: Number, default: 0 },
    supplyLines: { type: [String], default: [] },
    status: { type: String, enum: ['contested', 'secured', 'under_siege'], default: 'contested' },
  },
  { _id: false }
);

const GalaxyGroundCombatSchema = new Schema<IGalaxyGroundCombat>(
  {
    session_id: { type: String, required: true, index: true },
    battleId: { type: String, required: true, unique: true },
    gridCoordinates: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    factions: {
      type: [
        {
          code: { type: String, enum: ['empire', 'alliance', 'rebel'], required: true },
          commanderIds: { type: [String], default: [] },
          groundUnits: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    occupationStatus: { type: [OccupationStatusSchema], default: [] },
    supplyBatches: { type: [SupplyBatchSchema], default: [] },
    warehouseStocks: { type: [WarehouseStockSchema], default: [] },
    combatPhase: {
      type: String,
      enum: ['landing', 'engagement', 'occupation', 'withdrawal', 'completed'],
      default: 'landing',
    },
    startedAt: { type: Date, default: Date.now },
    lastUpdateAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

GalaxyGroundCombatSchema.index({ session_id: 1, battleId: 1 });
GalaxyGroundCombatSchema.index({ session_id: 1, 'gridCoordinates.x': 1, 'gridCoordinates.y': 1 });

export const GalaxyGroundCombat =
  (mongoose.models.GalaxyGroundCombat as Model<IGalaxyGroundCombat> | undefined) ||
  mongoose.model<IGalaxyGroundCombat>('GalaxyGroundCombat', GalaxyGroundCombatSchema);
