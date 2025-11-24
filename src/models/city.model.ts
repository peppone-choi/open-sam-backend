import mongoose, { Schema, Document } from 'mongoose';

export interface ICity extends Document {
  session_id: string;
  city: number;
  name: string;
  
  // 기본 정보
  nation: number;           // 소속 국가 (필수)
  level: number;            // 도시 등급
  state: number;            // 도시 상태
  region: string | number;  // 지역 (문자열 또는 숫자)
  
  // 자원 (현재/최대)
  pop: number;              // 인구
  pop_max: number;
  agri: number;             // 농업
  agri_max: number;
  comm: number;             // 상업
  comm_max: number;
  secu: number;             // 치안
  secu_max: number;
  def: number;              // 방어
  def_max: number;
  wall: number;             // 성벽
  wall_max: number;
  
  // 게임 속성
  trust: number;            // 민심
  front: number;            // 전선
  supply: number;           // 보급
  trade: number;            // 무역
  
  // 지리 정보
  x: number;                // 좌표 X
  y: number;                // 좌표 Y
  neighbors: (number | string)[];  // 인접 도시들 (ID 또는 이름)
  terrain?: string;         // 지형
  
  // 전투 관련
  conflict?: Record<string, any>;  // 분쟁 정보
  
  // 완전 동적 데이터 (모든 것이 세션 설정에 따라 다름!)
  data?: Record<string, any>;
  
  // 헬퍼 메서드
  markModified(path: string): void;
  save(): Promise<this>;
}

const CitySchema = new Schema<ICity>({
  session_id: { type: String, required: true },
  city: { type: Number, required: true },
  name: { type: String, required: true },
  
  // 기본 정보
  nation: { type: Number, required: true, default: 0 },
  level: { type: Number, default: 0 },
  state: { type: Number, default: 0 },
  region: { type: Schema.Types.Mixed, default: 0 },  // 문자열 또는 숫자
  
  // 자원
  pop: { type: Number, default: 100000 },
  pop_max: { type: Number, default: 1000000 },
  agri: { type: Number, default: 1000 },
  agri_max: { type: Number, default: 10000 },
  comm: { type: Number, default: 1000 },
  comm_max: { type: Number, default: 10000 },
  secu: { type: Number, default: 100 },
  secu_max: { type: Number, default: 1000 },
  def: { type: Number, default: 100 },
  def_max: { type: Number, default: 1000 },
  wall: { type: Number, default: 1000 },
  wall_max: { type: Number, default: 10000 },
  
  // 게임 속성
  trust: { type: Number, default: 50 },
  front: { type: Number, default: 0 },
  supply: { type: Number, default: 0 },
  trade: { type: Number, default: 0 },
  
  // 지리 정보
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  neighbors: { type: [Schema.Types.Mixed], default: [] },  // ID 또는 이름
  terrain: { type: String },
  
  // 전투 관련
  conflict: { type: Schema.Types.Mixed, default: {} },
  
  // 완전 동적 데이터
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// 인덱스: session_id + city 조합이 유니크
CitySchema.index({ session_id: 1, city: 1 }, { unique: true });
CitySchema.index({ session_id: 1, nation: 1 });

export const City = mongoose.models.City || mongoose.model<ICity>('City', CitySchema);
