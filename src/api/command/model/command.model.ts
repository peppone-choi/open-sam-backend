import { Schema, model, Document } from 'mongoose';
import { ICommand, CommandType, CommandStatus } from '../@types/command.types';

/**
 * Command Mongoose Document
 * 
 * Entity 시스템과 호환되는 MongoDB 모델
 */
export interface ICommandDocument extends Omit<ICommand, 'id'>, Document {
  id: string;
}

/**
 * Command Schema
 * 
 * generalId → commanderId로 변경
 * sessionId 인덱스 추가
 */
const CommandSchema = new Schema<ICommandDocument>(
  {
    // 게임 세션
    sessionId: { 
      type: String, 
      required: true, 
      index: true,
      default: 'default',
    },

    // 지휘관 ID (generalId → commanderId)
    commanderId: { 
      type: String, 
      required: true,
      index: true,
    },

    // 명령 타입
    type: {
      type: String,
      enum: Object.values(CommandType),
      required: true,
      index: true,
    },

    // 명령 상태
    status: {
      type: String,
      enum: Object.values(CommandStatus),
      required: true,
      default: CommandStatus.PENDING,
      index: true,
    },

    // 커맨드 페이로드 (동적)
    payload: { 
      type: Schema.Types.Mixed, 
      required: true,
    },

    // CP 비용
    cpCost: { 
      type: Number, 
      required: true, 
      default: 0,
    },
    cpType: { 
      type: String, 
      enum: ['PCP', 'MCP'], 
      required: true,
      default: 'PCP',
    },

    // 턴제 모드 지원
    scheduledAt: { 
      type: Date,
      index: true,
    },

    // 실행 시간
    startTime: { type: Date },
    completionTime: { 
      type: Date,
      index: true,
    },
    executionDuration: { type: Number }, // milliseconds

    // 결과
    result: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  {
    timestamps: true,
    collection: 'commands',
  }
);

/**
 * 복합 인덱스
 */
// 세션 + 지휘관 조회 최적화
CommandSchema.index({ sessionId: 1, commanderId: 1, createdAt: -1 });

// 세션 + 상태 조회 최적화
CommandSchema.index({ sessionId: 1, status: 1 });

// 완료 예정 조회 최적화
CommandSchema.index({ status: 1, completionTime: 1 });

// 턴제 모드 스케줄 조회 최적화
CommandSchema.index({ sessionId: 1, status: 1, scheduledAt: 1 });

export const CommandModel = model<ICommandDocument>('Command', CommandSchema);
