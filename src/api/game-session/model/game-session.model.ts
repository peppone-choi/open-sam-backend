import { Schema, model, Document } from 'mongoose';
import { IGameSession } from '../@types/game-session.types';

/**
 * GameSession Document Interface
 */
export interface IGameSessionDocument extends Omit<IGameSession, 'id'>, Document {
  id: string;
}

/**
 * GameSession Schema
 * 
 * Entity 시스템과 독립적인 세션 메타데이터
 * - scenarioId는 Entity의 scenario 필드와 1:1 매칭
 * - gameMode/turnInterval은 CQRS 패턴을 위해 유지
 */
const GameSessionSchema = new Schema<IGameSessionDocument>(
  {
    // 시나리오 정보 (Entity scenario와 매칭)
    scenarioId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    
    // 게임 설정
    startYear: { type: Number, required: true },
    currentYear: { type: Number, required: true },
    currentMonth: { type: Number, required: true, default: 1 },
    
    // 맵 정보
    mapName: { type: String },
    
    // 게임 상태
    status: {
      type: String,
      enum: ['waiting', 'running', 'paused', 'finished'],
      required: true,
      default: 'waiting',
    },
    
    // 게임 모드 (CQRS 턴제/실시간)
    gameMode: {
      type: String,
      enum: ['turnBased', 'realtime'],
      required: true,
      default: 'turnBased',
    },
    turnInterval: { type: Number, required: true, default: 300 },
    
    // 시작/종료 시간
    openDate: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    
    // 설정값 (scenario.json의 const)
    config: {
      joinRuinedNPCProp: { type: Number },
      npcBanMessageProb: { type: Number },
      defaultMaxGeneral: { type: Number },
      fiction: { type: Number },
      life: { type: Number },
    },
    
    // 이벤트 (scenario.json의 events)
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
    
    // 통계 (Entity 기반 동적 계산)
    stats: {
      totalGenerals: { type: Number, default: 0 },
      totalCities: { type: Number, default: 0 },
      totalNations: { type: Number, default: 0 },
      activePlayers: { type: Number, default: 0 },
    },
    
    // 턴 설정
    turnConfig: {
      turnDuration: { type: Number, required: true, default: 300 },
      lastTurnAt: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: 'game_sessions',
  }
);

// 인덱스
GameSessionSchema.index({ status: 1 });
GameSessionSchema.index({ scenarioId: 1 });
GameSessionSchema.index({ gameMode: 1 });
GameSessionSchema.index({ createdAt: -1 });

export const GameSessionModel = model<IGameSessionDocument>('GameSession', GameSessionSchema);
