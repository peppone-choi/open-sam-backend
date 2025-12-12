import mongoose, { Schema, Document } from 'mongoose';

/**
 * 전투 리플레이 데이터 모델
 * ProcessWar.ts에서 전투 종료 후 저장되는 리플레이 로그
 */

export interface IReplayAction {
  type: 'attack' | 'skill' | 'move' | 'retreat' | 'win' | 'lose' | 'phase' | 'info';
  phase?: number;
  actorId: number | string;
  targetId?: number | string;
  damage?: number;
  moraleDamage?: number;
  message?: string;
  detail?: any;
}

export interface IReplayTurn {
  turnNumber: number;
  actions: IReplayAction[];
  snapshot?: {
    attackerCrew: number;
    defenderCrew: number;
  };
}

export interface IReplayMetadata {
  sessionId: string;
  battleId: string;
  date: Date;
  seed: string;
  attacker: {
    id: number;
    name: string;
    nationId: number;
    nationName: string;
    generalName: string;
    crew: number;
    crewType: string;
  };
  defender: {
    cityId: number;
    cityName: string;
    nationId: number;
    nationName: string;
    defenders: {
      id: number;
      name: string;
      crew: number;
      crewType: string;
    }[];
  };
}

export interface IBattleReplay extends Document {
  version: string;
  metadata: IReplayMetadata;
  turns: IReplayTurn[];
  createdAt: Date;
  updatedAt: Date;
}

const ReplayActionSchema = new Schema({
  type: { type: String, enum: ['attack', 'skill', 'move', 'retreat', 'win', 'lose', 'phase', 'info'], required: true },
  phase: { type: Number },
  actorId: { type: Schema.Types.Mixed, required: true },
  targetId: { type: Schema.Types.Mixed },
  damage: { type: Number },
  moraleDamage: { type: Number },
  message: { type: String },
  detail: { type: Schema.Types.Mixed },
}, { _id: false });

const ReplayTurnSchema = new Schema({
  turnNumber: { type: Number, required: true },
  actions: [ReplayActionSchema],
  snapshot: {
    attackerCrew: { type: Number },
    defenderCrew: { type: Number },
  },
}, { _id: false });

const ReplayMetadataSchema = new Schema({
  sessionId: { type: String, required: true },
  battleId: { type: String, required: true },
  date: { type: Date, required: true },
  seed: { type: String, required: true },
  attacker: {
    id: { type: Number, required: true },
    name: { type: String },
    nationId: { type: Number },
    nationName: { type: String },
    generalName: { type: String },
    crew: { type: Number },
    crewType: { type: String },
  },
  defender: {
    cityId: { type: Number },
    cityName: { type: String },
    nationId: { type: Number },
    nationName: { type: String },
    defenders: [{
      id: { type: Number },
      name: { type: String },
      crew: { type: Number },
      crewType: { type: String },
    }],
  },
}, { _id: false });

const BattleReplaySchema = new Schema({
  version: { type: String, default: '1.0' },
  metadata: { type: ReplayMetadataSchema, required: true },
  turns: [ReplayTurnSchema],
}, {
  timestamps: true,
  collection: 'battle_replay',
});

// 인덱스: sessionId + battleId로 조회가 빈번
BattleReplaySchema.index({ 'metadata.sessionId': 1, 'metadata.battleId': 1 }, { unique: true });
BattleReplaySchema.index({ 'metadata.sessionId': 1, 'metadata.date': -1 });
BattleReplaySchema.index({ 'metadata.attacker.id': 1 });
BattleReplaySchema.index({ 'metadata.defender.cityId': 1 });

export const BattleReplay = mongoose.model<IBattleReplay>('BattleReplay', BattleReplaySchema);







