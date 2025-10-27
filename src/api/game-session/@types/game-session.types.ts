/**
 * GameSession (게임 서버/시나리오) 도메인 타입
 * 
 * 핵심 개념:
 * - 각 테이블(general, city, nation)은 하나의 GameSession에 종속
 * - 여러 GameSession이 동시에 돌아갈 수 있음
 * - scenario/*.json 파일 하나 = 하나의 GameSession 템플릿
 */

export interface IGameSession {
  id: string; // server_id에 해당
  
  // 시나리오 정보
  scenarioId: string; // scenario_0, scenario_1, scenario_2010 등
  title: string; // "【공백지】 일반", "【가상모드1a】 영웅 난무" 등
  
  // 게임 설정
  startYear: number; // 180, 220 등
  currentYear: number;
  currentMonth: number;
  
  // 맵 정보
  mapName?: string; // "che", "miniche", "cr" 등
  
  // 게임 상태
  status: 'waiting' | 'running' | 'paused' | 'finished';
  
  // 시작/종료 시간
  openDate?: Date; // 게임 오픈 시간
  startDate?: Date; // 실제 시작 시간
  endDate?: Date; // 종료 시간
  
  // 설정값 (scenario.json의 const)
  config: {
    joinRuinedNPCProp?: number;
    npcBanMessageProb?: number;
    defaultMaxGeneral?: number;
    fiction?: number; // 가상 모드 여부
    life?: number; // 수명 설정
  };
  
  // 이벤트 (scenario.json의 events)
  events: Array<{
    target: 'month' | 'destroy_nation' | 'occupy_city' | 'pre_month' | 'united';
    priority: number;
    condition: any;
    action: any;
  }>;
  
  // 통계
  stats: {
    totalGenerals: number;
    totalCities: number;
    totalNations: number;
    activePlayers: number;
  };
  
  // 턴 설정
  turnConfig: {
    turnDuration: number; // 턴 시간 (초)
    lastTurnAt?: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGameSessionDto {
  scenarioId: string;
  title?: string;
  startYear?: number;
  mapName?: string;
  config?: Partial<IGameSession['config']>;
}

export interface UpdateGameSessionDto {
  status?: IGameSession['status'];
  currentYear?: number;
  currentMonth?: number;
}

/**
 * 시나리오 템플릿 (scenario/*.json 파싱 결과)
 */
export interface IScenarioTemplate {
  scenarioId: string;
  title: string;
  startYear: number;
  map?: {
    mapName: string;
  };
  const?: Record<string, any>;
  events?: any[];
  history?: any[];
  
  // 초기 데이터
  nation?: any[];
  general?: any[];
  diplomacy?: any[];
}
