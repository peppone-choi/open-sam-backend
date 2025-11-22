import mongoose, { Schema, Document } from 'mongoose';

export interface INation extends Document {
  session_id: string;
  nation: number;
  name: string;
  color?: string;
  flagImage?: string;        // 깃발 이미지 URL (선택)
  flagTextColor?: string;    // 깃발 텍스트 색상 (black/white, 기본 auto)
  flagBgColor?: string;      // 깃발 배경색 (선택, 없으면 color 사용)
  flagBorderColor?: string;  // 깃발 테두리 색상 (선택, 기본 auto)
  
  // 자주 사용되는 필드들 (ai-engine 등에서 직접 접근)
  rate?: number;
  gold?: number;
  rice?: number;
  capital?: number;
  level?: number;      // 국가 크기 (0=재야, 1=영주, 2=군벌, 3=주자사, 4=주목, 5=공, 6=왕, 7=황제)
  type?: string;       // 국가 성향 (병가, 법가, 유가 등)
  leader?: number;     // 지도자 장수 ID
  gennum?: number;     // 소속 장수 수
  tech?: number;
  country_type?: number;
  scout?: number;
  aux?: Record<string, any>;
  
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
  flagImage: { type: String },         // 깃발 이미지 URL
  flagTextColor: { type: String },     // 깃발 텍스트 색상
  flagBgColor: { type: String },       // 깃발 배경색
  flagBorderColor: { type: String },   // 깃발 테두리 색상
  
  rate: { type: Number },
  gold: { type: Number },
  rice: { type: Number },
  capital: { type: Number },
  level: { type: Number },       // 국가 크기
  type: { type: String },        // 국가 성향
  leader: { type: Number },      // 지도자 ID
  gennum: { type: Number },      // 장수 수
  tech: { type: Number, default: 0 },
  country_type: { type: Number },
  scout: { type: Number },
  aux: { type: Schema.Types.Mixed, default: {} },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// 인덱스: session_id + nation 조합이 유니크
NationSchema.index({ session_id: 1, nation: 1 }, { unique: true });

export const Nation = mongoose.models.Nation || mongoose.model<INation>('Nation', NationSchema);
