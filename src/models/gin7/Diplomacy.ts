import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================
// Types (Copied/Adapted from DiplomacyService)
// ============================================================

export enum DiplomaticStatus {
  ALLIED = 'ALLIED',
  FRIENDLY = 'FRIENDLY',
  NEUTRAL = 'NEUTRAL',
  HOSTILE = 'HOSTILE',
  AT_WAR = 'AT_WAR',
  CEASEFIRE = 'CEASEFIRE',
}

export enum TreatyType {
  TRADE = 'TRADE',
  NON_AGGRESSION = 'NON_AGGRESSION',
  ALLIANCE = 'ALLIANCE',
  CEASEFIRE = 'CEASEFIRE',
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',
  TRIBUTE = 'TRIBUTE',
}

export interface TreatyTerms {
  description: string;
  tradeBonus?: number;
  tariffReduction?: number;
  tributeAmount?: number;
  tributeInterval?: number;
  mutualDefense?: boolean;
  noFirstStrike?: boolean;
  territoryAccess?: boolean;
  durationDays?: number;
}

export interface ITreaty {
  treatyId: string;
  type: TreatyType;
  parties: string[];
  terms: TreatyTerms;
  signedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  breakCost: number;
  renewalCount: number;
}

export interface IWarDeclaration {
  warId: string;
  sessionId: string;
  declaringFaction: string;
  targetFaction: string;
  declaredAt: Date;
  caususBelli: string;
  isActive: boolean;
  endedAt?: Date;
  victor?: string;
  peaceTreaty?: string;
}

export interface IDiplomaticMessage {
  messageId: string;
  sessionId: string;
  fromFactionId: string;
  toFactionId: string;
  fromCharacterId?: string;
  type: 'FORMAL' | 'INFORMAL' | 'ULTIMATUM' | 'PROPOSAL' | 'RESPONSE';
  subject: string;
  content: string;
  attachedTreatyId?: string;
  sentAt: Date;
  readAt?: Date;
  responseTo?: string;
}

// ============================================================
// Schemas
// ============================================================

const TreatyTermsSchema = new Schema<TreatyTerms>({
  description: { type: String, required: true },
  tradeBonus: Number,
  tariffReduction: Number,
  tributeAmount: Number,
  tributeInterval: Number,
  mutualDefense: Boolean,
  noFirstStrike: Boolean,
  territoryAccess: Boolean,
  durationDays: Number,
}, { _id: false });

const TreatySchema = new Schema<ITreaty>({
  treatyId: { type: String, required: true },
  type: { type: String, enum: Object.values(TreatyType), required: true },
  parties: [{ type: String, required: true }],
  terms: { type: TreatyTermsSchema, required: true },
  signedAt: { type: Date, default: Date.now },
  expiresAt: Date,
  isActive: { type: Boolean, default: false },
  breakCost: { type: Number, default: 0 },
  renewalCount: { type: Number, default: 0 },
}, { _id: false });

const WarDeclarationSchema = new Schema<IWarDeclaration>({
  warId: { type: String, required: true },
  sessionId: { type: String, required: true },
  declaringFaction: { type: String, required: true },
  targetFaction: { type: String, required: true },
  declaredAt: { type: Date, default: Date.now },
  caususBelli: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  endedAt: Date,
  victor: String,
  peaceTreaty: String,
}, { _id: false });

const DiplomaticMessageSchema = new Schema<IDiplomaticMessage>({
  messageId: { type: String, required: true },
  sessionId: { type: String, required: true },
  fromFactionId: { type: String, required: true },
  toFactionId: { type: String, required: true },
  fromCharacterId: String,
  type: { type: String, enum: ['FORMAL', 'INFORMAL', 'ULTIMATUM', 'PROPOSAL', 'RESPONSE'], required: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },
  attachedTreatyId: String,
  sentAt: { type: Date, default: Date.now },
  readAt: Date,
  responseTo: String,
}, { _id: false });

// Main Diplomacy Document (One per session to hold all diplomatic state or separate collections?)
// Given the previous design was in-memory maps per session, let's create a DiplomacyState model.

export interface IDiplomacyState extends Document {
  sessionId: string;
  treaties: ITreaty[];
  wars: IWarDeclaration[];
  messages: IDiplomaticMessage[];
  // Relations are stored in Faction model, but we can cache them or store history here?
  // DiplomacyService uses Faction.relations primarily.
}

const DiplomacyStateSchema = new Schema<IDiplomacyState>({
  sessionId: { type: String, required: true, unique: true },
  treaties: [TreatySchema],
  wars: [WarDeclarationSchema],
  messages: [DiplomaticMessageSchema],
}, {
  timestamps: true,
  collection: 'gin7_diplomacy_states'
});

export const DiplomacyState: Model<IDiplomacyState> = 
  mongoose.models.Gin7DiplomacyState || mongoose.model<IDiplomacyState>('Gin7DiplomacyState', DiplomacyStateSchema);





