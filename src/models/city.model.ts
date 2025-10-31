import mongoose, { Schema, Document } from 'mongoose';

export interface ICity extends Document {
  session_id: string;
  city: number;
  name: string;
  
  // 자주 사용되는 필드들 (ai-engine 등에서 직접 접근)
  front?: number;
  supply?: number;
  pop?: number;
  pop_max?: number;
  trust?: number;
  nation?: number;
  agri?: number;
  agri_max?: number;
  comm?: number;
  comm_max?: number;
  secu?: number;
  secu_max?: number;
  def?: number;
  def_max?: number;
  wall?: number;
  wall_max?: number;
  
  // 완전 동적 데이터
  data: Record<string, any>;
  
  // 헬퍼 메서드
  markModified(path: string): void;
  save(): Promise<this>;
}

const CitySchema = new Schema<ICity>({
  session_id: { type: String, required: true },
  city: { type: Number, required: true },
  name: { type: String, required: true },
  
  front: { type: Number },
  supply: { type: Number },
  pop: { type: Number },
  pop_max: { type: Number },
  trust: { type: Number },
  nation: { type: Number },
  agri: { type: Number },
  agri_max: { type: Number },
  comm: { type: Number },
  comm_max: { type: Number },
  secu: { type: Number },
  secu_max: { type: Number },
  def: { type: Number },
  def_max: { type: Number },
  wall: { type: Number },
  wall_max: { type: Number },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// 인덱스: session_id + city 조합이 유니크
CitySchema.index({ session_id: 1, city: 1 }, { unique: true });

export const City = mongoose.model<ICity>('City', CitySchema);
