import mongoose, { Schema, Document, Model } from 'mongoose';


/**
 * 게임 세션
 * 
 * 한 세션 = 하나의 게임판
 * 여러 세션이 동시에 돌아갈 수 있음
 */
export interface ISession extends Document {
  session_id: string;
  name: string;
  
  // 시나리오 ID (어떤 시나리오를 사용하는지)
  scenario_id?: string;
  scenario_name?: string;  // 시나리오 표시명 (선택적)
  scenarioId?: string;     // CamelCase 호환 필드
  scenarioID?: string;     // 기타 레거시 호환 필드
  
  // 템플릿 ID (레거시, scenario_id 사용 권장)
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
  status: 'preparing' | 'running' | 'paused' | 'finished' | 'united';
  started_at?: Date;
  finished_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  
  // 동적 필드 (레거시 PHP 호환성)
  // 최상위 레벨에 저장되는 게임 데이터
  year?: number;
  month?: number;
  startyear?: number;
  turntime?: Date | string;
  starttime?: Date | string;
  turnterm?: number;
  turn?: number;
  is_locked?: boolean;
  isunited?: number;
  online_user_cnt?: number;
  online_nation?: number | number[];
  lastVote?: number;
  develcost?: number;
  config?: Record<string, any>;
  
  // PHP 호환성: 동적 게임 데이터
  // turntime, year, month, turnterm 등을 저장
  data?: Record<string, any>;
}


const SessionSchema = new Schema<ISession>({
  session_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  
  // 시나리오 정보
  scenario_id: { type: String, index: true },
  scenario_name: { type: String },
  
  // 템플릿 ID (레거시)
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
  
  status: { type: String, default: 'preparing' },
  started_at: { type: Date },
  finished_at: { type: Date },
  
  data: { type: Schema.Types.Mixed, default: {} },
  config: { type: Schema.Types.Mixed, default: {} },
  is_locked: { type: Boolean, default: false },
  isunited: { type: Number, default: 0 },
  online_user_cnt: { type: Number, default: 0 },
  online_nation: { type: Schema.Types.Mixed, default: [] },
  lastVote: { type: Number, default: 0 },
  develcost: { type: Number, default: 100 }
}, {
  timestamps: true
});


export const Session: Model<ISession> =
  (mongoose.models.Session as Model<ISession> | undefined) ?? mongoose.model<ISession>('Session', SessionSchema);

