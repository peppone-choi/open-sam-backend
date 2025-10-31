import mongoose, { Schema, Document } from 'mongoose';

export interface INation extends Document {
  session_id: string;
  nation: number;
  name: string;
  color?: string;
  
  // 자주 사용되는 필드들 (ai-engine 등에서 직접 접근)
  rate?: number;
  gold?: number;
  rice?: number;
  capital?: number;
  
  // 완전 동적 데이터
  data: Record<string, any>;
  
  // 헬퍼 메서드
  markModified(path: string): void;
  save(): Promise<this>;
}

const NationSchema = new Schema<INation>({
  session_id: { type: String, required: true },
  nation: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String },
  
  rate: { type: Number },
  gold: { type: Number },
  rice: { type: Number },
  capital: { type: Number },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// 인덱스: session_id + nation 조합이 유니크
NationSchema.index({ session_id: 1, nation: 1 }, { unique: true });

export const Nation = mongoose.model<INation>('Nation', NationSchema);
