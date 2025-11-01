import mongoose, { Schema, Document } from 'mongoose';

// 커맨드 예약 (general_turn, nation_turn 통합)
export interface ICommand extends Document {
  session_id: string;  // 세션마다 독립적인 커맨드!
  general_id?: number;
  nation_id?: number;
  
  action: string;
  arg: any;
  
  status: 'pending' | 'executing' | 'completed' | 'failed';
  
  // 실시간 실행을 위한 시간
  scheduled_at: Date;      // 예약 시간
  completion_time: Date;   // 완료 예정 시간 (이 시간이 되면 실행!)
  executed_at?: Date;      // 실제 실행 시간
}

const CommandSchema = new Schema<ICommand>({
  session_id: { type: String, required: true },
  general_id: { type: Number },
  nation_id: { type: Number },
  
  action: { type: String, required: true },
  arg: { type: Schema.Types.Mixed, default: {} },
  
  status: { type: String, default: 'pending' },
  scheduled_at: { type: Date, default: Date.now },
  completion_time: { type: Date, required: true },
  executed_at: { type: Date }
}, {
  timestamps: true
});

// 인덱스 (completion_time으로 빠르게 찾기 위해)
CommandSchema.index({ session_id: 1, status: 1, completion_time: 1 });
CommandSchema.index({ session_id: 1, general_id: 1, status: 1 });

export const Command = mongoose.model<ICommand>('Command', CommandSchema);
