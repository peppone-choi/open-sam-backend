import mongoose, { Document, Schema, Model } from 'mongoose';

export const UNIT_OWNER_TYPES = ['city', 'general', 'nation', 'npc'] as const;
export type UnitOwnerType = typeof UNIT_OWNER_TYPES[number];

export interface IUnitStack {
  _id?: mongoose.Types.ObjectId | string;
  session_id: string;
  owner_type: UnitOwnerType;
  owner_id: string | number;
  commander_no?: number;
  commander_name?: string;

  crew_type_id: number;
  crew_type_name: string;
  crew_type_icon?: string;

  unit_size: number; // 기본 100명
  stack_count: number; // 보유한 유닛 수 (정수)

  train: number;
  morale: number;
  hp: number; // 현재 병력 수 (<= unit_size * stack_count)
  attack: number;
  defence: number;
  equipment?: Record<string, any>;
  status?: string;
  note?: string;
  city_id?: number;

  created_at?: Date;
  updated_at?: Date;
}

export type IUnitStackDocument = IUnitStack & Document;

const UnitStackSchema = new Schema<IUnitStackDocument>({
  session_id: { type: String, required: true, index: true },
  owner_type: { type: String, required: true, enum: UNIT_OWNER_TYPES },
  owner_id: { type: Schema.Types.Mixed, required: true, index: true },
  commander_no: { type: Number },
  commander_name: { type: String },

  crew_type_id: { type: Number, required: true },
  crew_type_name: { type: String, required: true },
  crew_type_icon: { type: String },

  unit_size: { type: Number, default: 100, min: 1 },
  stack_count: { type: Number, default: 1, min: 0 },

  train: { type: Number, default: 70 },
  morale: { type: Number, default: 70 },
  hp: { type: Number },
  attack: { type: Number, default: 0 },
  defence: { type: Number, default: 0 },
  equipment: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, default: 'active' },
  note: { type: String },
  city_id: { type: Number },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

UnitStackSchema.index({ session_id: 1, owner_type: 1, owner_id: 1 });
UnitStackSchema.index({ commander_no: 1 });
UnitStackSchema.index({ crew_type_id: 1 });
UnitStackSchema.index({ session_id: 1, owner_type: 1, city_id: 1 });

UnitStackSchema.pre('validate', function(this: IUnitStackDocument, next) {
  const unitSize = this.unit_size ?? 100;
  const stackCount = Math.max(0, this.stack_count ?? 0);
  this.stack_count = stackCount;
  const maxTroops = unitSize * stackCount;
  if (this.hp === undefined || this.hp === null) {
    this.hp = maxTroops;
  }
  this.hp = Math.max(0, Math.min(this.hp, maxTroops));
  next();
});

UnitStackSchema.virtual('troop_count').get(function(this: IUnitStackDocument) {
  if (typeof this.hp === 'number') {
    return this.hp;
  }
  const unitSize = this.unit_size ?? 100;
  const stack = this.stack_count ?? 0;
  return unitSize * stack;
});

export const UnitStack =
  (mongoose.models.UnitStack as Model<IUnitStackDocument> | undefined) ||
  mongoose.model<IUnitStackDocument>('UnitStack', UnitStackSchema);
