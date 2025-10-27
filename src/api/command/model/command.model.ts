import { Schema, model, Document } from 'mongoose';
import { ICommand, CommandType, CommandStatus } from '../@types/command.types';

/**
 * Command Mongoose Schema
 */
export interface ICommandDocument extends Omit<ICommand, 'id'>, Document {
  id: string;
}

const CommandSchema = new Schema<ICommandDocument>(
  {
    generalId: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(CommandType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CommandStatus),
      required: true,
      default: CommandStatus.PENDING,
    },

    // 커맨드 페이로드
    payload: { type: Schema.Types.Mixed, required: true },

    // CP 비용
    cpCost: { type: Number, required: true, default: 0 },
    cpType: { type: String, enum: ['PCP', 'MCP'], required: true },

    // 실행 시간
    startTime: { type: Date },
    completionTime: { type: Date },
    executionDuration: { type: Number }, // milliseconds

    // 결과
    result: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

// TODO: 인덱스 추가
// CommandSchema.index({ generalId: 1, status: 1 });
// CommandSchema.index({ status: 1, completionTime: 1 });

export const CommandModel = model<ICommandDocument>('Command', CommandSchema);
