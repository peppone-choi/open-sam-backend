/**
 * GIN7 Messenger Session Model
 * 메신저 통화 세션 및 대화 로그 저장
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/** 메시지 로그 스키마 */
const MessengerLogEntrySchema = new Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['text', 'emoji', 'system'], default: 'text' },
}, { _id: false });

/** 메신저 세션 인터페이스 */
export interface IMessengerSession extends Document {
  /** 게임 세션 ID */
  sessionId: string;
  /** 발신자 캐릭터 ID */
  callerId: string;
  /** 발신자 이름 */
  callerName: string;
  /** 수신자 캐릭터 ID */
  receiverId: string;
  /** 수신자 이름 */
  receiverName: string;
  /** 시작 시간 (호출 시작) */
  startedAt: Date;
  /** 연결 시간 (수락 시점) */
  connectedAt?: Date;
  /** 종료 시간 */
  endedAt?: Date;
  /** 통화 상태 */
  status: 'calling' | 'connected' | 'ended' | 'rejected' | 'missed' | 'jammed';
  /** 종료 사유 */
  endReason?: string;
  /** 메시지 로그 */
  messages: Array<{
    senderId: string;
    senderName: string;
    text: string;
    timestamp: Date;
    type: 'text' | 'emoji' | 'system';
  }>;
  /** 통화 시간 (초) */
  duration?: number;
  /** 생성 시간 */
  createdAt: Date;
  /** 수정 시간 */
  updatedAt: Date;
}

/** 메신저 세션 스키마 */
const MessengerSessionSchema = new Schema<IMessengerSession>({
  sessionId: { type: String, required: true, index: true },
  callerId: { type: String, required: true, index: true },
  callerName: { type: String, required: true },
  receiverId: { type: String, required: true, index: true },
  receiverName: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
  connectedAt: { type: Date },
  endedAt: { type: Date },
  status: { 
    type: String, 
    enum: ['calling', 'connected', 'ended', 'rejected', 'missed', 'jammed'],
    default: 'calling',
    index: true,
  },
  endReason: { type: String },
  messages: [MessengerLogEntrySchema],
  duration: { type: Number },
}, {
  timestamps: true,
  collection: 'messenger_sessions',
});

/** 복합 인덱스: 게임 세션 + 참여자 */
MessengerSessionSchema.index({ sessionId: 1, callerId: 1, receiverId: 1 });
/** 복합 인덱스: 게임 세션 + 상태 + 시작시간 */
MessengerSessionSchema.index({ sessionId: 1, status: 1, startedAt: -1 });

/** 통화 종료 시 duration 계산 */
MessengerSessionSchema.pre('save', function(next) {
  if (this.endedAt && this.connectedAt) {
    this.duration = Math.floor((this.endedAt.getTime() - this.connectedAt.getTime()) / 1000);
  }
  next();
});

/** 특정 사용자의 최근 통화 기록 조회 */
MessengerSessionSchema.statics.findByCharacter = function(
  sessionId: string, 
  characterId: string, 
  limit = 20
) {
  return this.find({
    sessionId,
    $or: [
      { callerId: characterId },
      { receiverId: characterId },
    ],
  })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
};

/** 특정 두 사용자 간의 통화 기록 조회 */
MessengerSessionSchema.statics.findBetweenCharacters = function(
  sessionId: string,
  characterId1: string,
  characterId2: string,
  limit = 50
) {
  return this.find({
    sessionId,
    $or: [
      { callerId: characterId1, receiverId: characterId2 },
      { callerId: characterId2, receiverId: characterId1 },
    ],
  })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
};

/** 진행 중인 통화 세션 조회 */
MessengerSessionSchema.statics.findActiveSession = function(
  sessionId: string,
  characterId: string
) {
  return this.findOne({
    sessionId,
    status: { $in: ['calling', 'connected'] },
    $or: [
      { callerId: characterId },
      { receiverId: characterId },
    ],
  }).lean();
};

export interface IMessengerSessionModel extends Model<IMessengerSession> {
  findByCharacter(sessionId: string, characterId: string, limit?: number): Promise<IMessengerSession[]>;
  findBetweenCharacters(sessionId: string, characterId1: string, characterId2: string, limit?: number): Promise<IMessengerSession[]>;
  findActiveSession(sessionId: string, characterId: string): Promise<IMessengerSession | null>;
}

export const MessengerSession = mongoose.model<IMessengerSession, IMessengerSessionModel>(
  'MessengerSession', 
  MessengerSessionSchema
);














