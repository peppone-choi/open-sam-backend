import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHistoryStatSnapshot {
  leadership?: number;
  strength?: number;
  intelligence?: number;
  politics?: number;
  charm?: number;
}

export interface IHistoryRecordSnapshot {
  merit?: number;
  experience?: number;
  battles?: number;
  wins?: number;
  losses?: number;
  kills?: number;
  deaths?: number;
}

export interface IHistoryGeneralSnapshot {
  general_no: number;
  name: string;
  owner?: string | number | null;
  nation_id?: number;
  nation_name?: string;
  city_id?: number;
  officer_level?: number;
  picture?: string;
  stats?: IHistoryStatSnapshot;
  records?: IHistoryRecordSnapshot;
}

export interface IHistoryTerritorySnapshot {
  city_id: number;
  name?: string;
  nation_id: number;
}

export interface IHistory extends Document {
  session_id: string;
  season: number;
  scenario?: string | number | null;
  winner_nation_id: number;
  winner_nation_name: string;
  year?: number;
  month?: number;
  unified_at?: Date;
  ruler?: IHistoryGeneralSnapshot;
  generals: IHistoryGeneralSnapshot[];
  territories?: IHistoryTerritorySnapshot[];
  meta?: Record<string, any>;
}

const StatSchema = new Schema<IHistoryStatSnapshot>(
  {
    leadership: Number,
    strength: Number,
    intelligence: Number,
    politics: Number,
    charm: Number
  },
  { _id: false }
);

const RecordSchema = new Schema<IHistoryRecordSnapshot>(
  {
    merit: Number,
    experience: Number,
    battles: Number,
    wins: Number,
    losses: Number,
    kills: Number,
    deaths: Number
  },
  { _id: false }
);

const GeneralSnapshotSchema = new Schema<IHistoryGeneralSnapshot>(
  {
    general_no: { type: Number, required: true },
    name: { type: String, required: true },
    owner: { type: Schema.Types.Mixed },
    nation_id: Number,
    nation_name: String,
    city_id: Number,
    officer_level: Number,
    picture: String,
    stats: { type: StatSchema, default: {} },
    records: { type: RecordSchema, default: {} }
  },
  { _id: false }
);

const TerritorySchema = new Schema<IHistoryTerritorySnapshot>(
  {
    city_id: { type: Number, required: true },
    name: String,
    nation_id: { type: Number, required: true }
  },
  { _id: false }
);

const HistorySchema = new Schema<IHistory>(
  {
    session_id: { type: String, required: true, index: true },
    season: { type: Number, default: 1 },
    scenario: { type: Schema.Types.Mixed },
    winner_nation_id: { type: Number, required: true },
    winner_nation_name: { type: String, required: true },
    year: Number,
    month: Number,
    unified_at: { type: Date, default: Date.now },
    ruler: GeneralSnapshotSchema,
    generals: { type: [GeneralSnapshotSchema], default: [] },
    territories: { type: [TerritorySchema], default: [] },
    meta: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

HistorySchema.index(
  { session_id: 1, season: 1, winner_nation_id: 1, year: -1, month: -1 },
  { unique: true }
);

HistorySchema.index({ session_id: 1, createdAt: -1 });

export const History =
  mongoose.models.History || mongoose.model<IHistory>('History', HistorySchema);


