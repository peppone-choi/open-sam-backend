import mongoose, { Schema, Document } from 'mongoose';

/**
 * 게임 세션
 * 
 * 한 세션 = 하나의 게임판
 * 여러 세션이 동시에 돌아갈 수 있음
 */
export interface ISession extends Document {
  session_id: string;
  name: string;
  
  // 템플릿 ID (어떤 설정을 기반으로 만들어졌는지)
  template_id?: string;
  
  // 게임 모드 (세션마다 다름!)
  game_mode: 'turn' | 'realtime';
  
  // 턴제 전용 설정
  turn_config?: {
    default_hour: number;      // 기본 턴 시각 (시)
    default_minute: number;    // 기본 턴 시각 (분)
    allow_custom: boolean;     // 유산으로 턴 시각 변경 허용 여부
  };
  
  // 리얼타임 전용 설정
  realtime_config?: {
    speed_multiplier: number;  // 배속 (1 = 1배속, 24 = 24배속)
  };
  
  // 세션별 자원 정의
  resources: {
    [resourceId: string]: {
      name: string;        // 표시명 (예: "금", "돈", "크레딧")
      icon?: string;       // 아이콘
      default_value: number;
    };
  };
  
  // 세션별 속성 정의
  attributes: {
    [attributeId: string]: {
      name: string;        // 표시명 (예: "통솔", "리더십", "지휘력")
      min?: number;
      max?: number;
    };
  };
  
  // 필드 매핑 (게임 로직에서 사용하는 필드 정의)
  field_mappings: {
    general: {
      primary_resource?: string;   // 기본 자원 (예: "gold")
      secondary_resource?: string; // 보조 자원 (예: "rice")
      troops_count?: string;       // 병사 수 (예: "crew")
      troops_type?: string;        // 병종 (예: "crewtype")
      location?: string;           // 위치 (예: "city")
      faction?: string;            // 소속 (예: "nation")
      rank?: string;               // 관직 (예: "officer_level")
    };
    city: {
      population?: string;         // 인구 (예: "pop")
      owner?: string;              // 소유자 (예: "nation")
    };
    nation: {
      capital?: string;            // 수도 (예: "capital")
      treasury?: string;           // 국고 (예: "gold")
    };
  };
  
  // 세션별 커맨드 설정
  commands: {
    [commandId: string]: {
      enabled: boolean;           // 이 커맨드 사용 가능한지
      duration?: number;          // 실행 시간 (초)
      cost?: {                    // 비용
        gold?: number;
        rice?: number;
      };
      effects: {                  // 효과 (로직을 여기 정의!)
        [key: string]: any;
        // 예: { decrease_pop: true, exp_gain: 50 }
      };
    };
  };
  
  // 세션별 게임 상수 (GameConst 오버라이드)
  game_constants: {
    develCost?: number;
    recruitCost?: number;
    // 기타 상수들...
  };
  
  // 도시 템플릿 (초기화용)
  cities?: {
    [cityId: string]: {
      name: string;
      level?: string;
      population?: number;
      agriculture?: number;
      commerce?: number;
      security?: number;
      defense?: number;
      wall?: number;
      region?: string;
      x?: number;
      y?: number;
      neighbors?: string[];
    };
  };
  
  // 게임 상태
  status: 'waiting' | 'running' | 'finished';
  started_at?: Date;
  finished_at?: Date;
  
  // PHP 호환성: 동적 게임 데이터
  // turntime, year, month, turnterm 등을 저장
  data?: Record<string, any>;
}

const SessionSchema = new Schema<ISession>({
  session_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  template_id: { type: String },
  
  game_mode: { type: String, required: true },
  
  turn_config: {
    default_hour: { type: Number, default: 21 },
    default_minute: { type: Number, default: 0 },
    allow_custom: { type: Boolean, default: false }
  },
  
  realtime_config: {
    speed_multiplier: { type: Number, default: 1 }
  },
  
  resources: { type: Schema.Types.Mixed, default: {} },
  attributes: { type: Schema.Types.Mixed, default: {} },
  field_mappings: { type: Schema.Types.Mixed, default: {} },
  commands: { type: Schema.Types.Mixed, default: {} },
  game_constants: { type: Schema.Types.Mixed, default: {} },
  cities: { type: Schema.Types.Mixed, default: {} },
  
  status: { type: String, default: 'waiting' },
  started_at: { type: Date },
  finished_at: { type: Date },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);
