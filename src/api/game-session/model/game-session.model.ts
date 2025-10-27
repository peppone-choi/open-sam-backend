import { Schema, model, Document } from 'mongoose';
import { IGameSession } from '../@types/game-session.types';

export interface IGameSessionDocument extends Omit<IGameSession, 'id'>, Document {
  id: string;
}

const GameSessionSchema = new Schema<IGameSessionDocument>(
  {
    scenarioId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    
    startYear: { type: Number, required: true },
    currentYear: { type: Number, required: true },
    currentMonth: { type: Number, required: true, default: 1 },
    
    mapName: { type: String },
    
    status: {
      type: String,
      enum: ['waiting', 'running', 'paused', 'finished'],
      required: true,
      default: 'waiting',
    },
    
    openDate: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    
    config: {
      joinRuinedNPCProp: { type: Number },
      npcBanMessageProb: { type: Number },
      defaultMaxGeneral: { type: Number },
      fiction: { type: Number },
      life: { type: Number },
    },
    
    events: [
      {
        target: {
          type: String,
          enum: ['month', 'destroy_nation', 'occupy_city', 'pre_month', 'united'],
        },
        priority: { type: Number },
        condition: { type: Schema.Types.Mixed },
        action: { type: Schema.Types.Mixed },
      },
    ],
    
    stats: {
      totalGenerals: { type: Number, default: 0 },
      totalCities: { type: Number, default: 0 },
      totalNations: { type: Number, default: 0 },
      activePlayers: { type: Number, default: 0 },
    },
    
    turnConfig: {
      turnDuration: { type: Number, required: true, default: 300 },
      lastTurnAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

GameSessionSchema.index({ status: 1 });
GameSessionSchema.index({ scenarioId: 1 });

export const GameSessionModel = model<IGameSessionDocument>('GameSession', GameSessionSchema);
