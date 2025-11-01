/**
 * Command 도메인 타입 정의 (CQRS 패턴)
 */

export enum CommandType {
  // 개인 커맨드
  REST = 'REST', // 휴식
  CURE = 'CURE', // 요양
  DRILL = 'DRILL', // 단련
  CONVERT_MASTERY = 'CONVERT_MASTERY', // 숙련 전환
  ADVENTURE = 'ADVENTURE', // 견문
  RETIRE = 'RETIRE', // 은퇴
  TRADE_EQUIPMENT = 'TRADE_EQUIPMENT', // 장비매매
  TRADE_SUPPLY = 'TRADE_SUPPLY', // 군량매매
  RESET_DOMESTIC_SKILL = 'RESET_DOMESTIC_SKILL', // 내정 특기 초기화
  RESET_BATTLE_SKILL = 'RESET_BATTLE_SKILL', // 전투 특기 초기화

  // 내정 커맨드
  DEVELOP_AGRICULTURE = 'DEVELOP_AGRICULTURE', // 농지 개간
  INVEST_COMMERCE = 'INVEST_COMMERCE', // 상업 투자
  RESEARCH_TECH = 'RESEARCH_TECH', // 기술 연구
  FORTIFY_DEFENSE = 'FORTIFY_DEFENSE', // 수비 강화
  REPAIR_WALL = 'REPAIR_WALL', // 성벽 보수
  IMPROVE_SECURITY = 'IMPROVE_SECURITY', // 치안 강화
  ENCOURAGE_SETTLEMENT = 'ENCOURAGE_SETTLEMENT', // 정착 장려
  GOVERN_PEOPLE = 'GOVERN_PEOPLE', // 주민 선정

  // 군사 커맨드
  CONSCRIPT = 'CONSCRIPT', // 징병
  RECRUIT = 'RECRUIT', // 모병
  TRAIN = 'TRAIN', // 훈련
  BOOST_MORALE = 'BOOST_MORALE', // 사기진작
  DEPLOY = 'DEPLOY', // 출병
  ASSEMBLE = 'ASSEMBLE', // 집합
  DISMISS_TROOPS = 'DISMISS_TROOPS', // 소집해제
  SPY = 'SPY', // 첩보

  // 인사 커맨드
  MOVE = 'MOVE', // 이동
  FORCE_MARCH = 'FORCE_MARCH', // 강행
  SEARCH_TALENT = 'SEARCH_TALENT', // 인재탐색
  RECRUIT_GENERAL = 'RECRUIT_GENERAL', // 등용

  // 계략 커맨드
  AGITATE = 'AGITATE', // 선동
  PLUNDER = 'PLUNDER', // 탈취
  SABOTAGE = 'SABOTAGE', // 파괴
  ARSON = 'ARSON', // 화계

  // 국가 커맨드
  GRANT = 'GRANT', // 증여
  TRIBUTE = 'TRIBUTE', // 헌납
  REQUISITION = 'REQUISITION', // 물자조달
  ABDICATE = 'ABDICATE', // 선양

  // 사령부 턴 커맨드
  APPOINT = 'APPOINT', // 인사발령
  REWARD = 'REWARD', // 포상
  CONFISCATE = 'CONFISCATE', // 몰수
  ORDER_LEAVE_UNIT = 'ORDER_LEAVE_UNIT', // 부대 탈퇴 지시
  DIPLOMACY = 'DIPLOMACY', // 외교
  AID = 'AID', // 원조
  NON_AGGRESSION_PACT = 'NON_AGGRESSION_PACT', // 불가침 제의
  DECLARE_WAR = 'DECLARE_WAR', // 선전포고
  PROPOSE_PEACE = 'PROPOSE_PEACE', // 종전 제의
  BREAK_PACT = 'BREAK_PACT', // 불가침 파기 제의
  SCORCHED_EARTH = 'SCORCHED_EARTH', // 초토화
  RELOCATE_CAPITAL = 'RELOCATE_CAPITAL', // 천도
  EXPAND_FACILITY = 'EXPAND_FACILITY', // 증축
  REDUCE_FACILITY = 'REDUCE_FACILITY', // 감축

  // 전략 커맨드
  DO_OR_DIE = 'DO_OR_DIE', // 필사즉생
  MOBILIZE_PEOPLE = 'MOBILIZE_PEOPLE', // 백성동원
  FLOOD = 'FLOOD', // 수몰
  FEINT = 'FEINT', // 허보
  RECRUIT_MILITIA = 'RECRUIT_MILITIA', // 의병모집
  TWO_TIGERS = 'TWO_TIGERS', // 이호경식
  RAID = 'RAID', // 급습
  COUNTER_STRATEGY = 'COUNTER_STRATEGY', // 피장파장

  // 기타
  CHANGE_FLAG = 'CHANGE_FLAG', // 국기변경
  CHANGE_NAME = 'CHANGE_NAME', // 국호변경
}

export enum CommandStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED', // 턴제 모드: 예약됨
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ICommand {
  id: string;
  
  // 게임 세션 (중요!)
  sessionId: string; // GameSession ID - 데이터 격리
  
  commanderId: string; // generalId → commanderId로 변경
  type: CommandType;
  status: CommandStatus;
  
  // 커맨드 페이로드 (타입별로 다름)
  payload: Record<string, any>;
  
  // CP 비용
  cpCost: number;
  cpType: 'PCP' | 'MCP';
  
  // 턴제 모드 지원
  scheduledAt?: Date; // 턴제 모드: 실행 예정 시간
  
  // 실행 시간
  startTime?: Date;
  completionTime?: Date;
  executionDuration?: number; // milliseconds
  
  // 결과
  result?: any;
  error?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 커맨드 페이로드 타입 정의 ====================

// 개인 커맨드
export interface RestCommandPayload {
  autoAction?: boolean; // 자율행동 여부
}

export interface DrillCommandPayload {
  unitType: number; // 병종
}

export interface ConvertMasteryPayload {
  fromUnitType: number; // 원래 병종
  toUnitType: number; // 대상 병종
}

export interface TradeEquipmentPayload {
  action: 'BUY' | 'SELL';
  itemId: string;
  amount: number;
}

export interface TradeSupplyPayload {
  type: 'GOLD_TO_RICE' | 'RICE_TO_GOLD';
  amount: number;
}

// 내정 커맨드 (공통 소모 자원)
export interface DomesticCommandPayload {
  cityId: string;
}

// 군사 커맨드
export interface ConscriptPayload {
  unitType: number; // 병종
  amount: number; // 징병 수
}

export interface RecruitPayload {
  unitType: number; // 병종
  amount: number; // 모병 수
}

export interface DeployPayload {
  targetCityId: string; // 목표 도시
}

export interface AssemblePayload {
  targetGeneralIds: string[]; // 소집할 장수 ID 목록
}

export interface SpyPayload {
  targetCityId: string; // 정찰할 도시
}

// 인사 커맨드
export interface MoveCommandPayload {
  targetCityId: string; // 이동할 도시
}

export interface ForceMarchPayload {
  targetCityId: string; // 강행으로 이동할 도시
}

export interface RecruitGeneralPayload {
  targetGeneralId: string; // 등용할 장수
  message: string; // 등용 메시지
}

// 계략 커맨드
export interface StratagamPayload {
  targetCityId: string; // 대상 도시
}

// 국가 커맨드
export interface GrantPayload {
  targetGeneralId: string; // 증여 대상
  gold: number;
  rice: number;
}

export interface TributePayload {
  gold: number;
  rice: number;
}

export interface RequisitionPayload {
  gold: number;
  rice: number;
}

export interface AbdicatePayload {
  targetGeneralId: string; // 선양할 대상
}

// 사령부 턴 커맨드
export interface AppointPayload {
  targetGeneralId: string; // 임명 대상
  position: 'CHIEF' | 'CHANCELLOR' | 'GOVERNOR' | 'TACTICIAN' | 'ADVISOR'; // 직책
  cityId?: string; // 도시 관직인 경우
}

export interface RewardPayload {
  targetGeneralId: string; // 포상 대상
  gold: number;
  rice: number;
}

export interface DiplomacyPayload {
  targetNationId: string; // 대상 국가
  type: 'NON_AGGRESSION' | 'WAR' | 'PEACE' | 'BREAK_PACT';
  message?: string;
}

export interface RelocateCapitalPayload {
  targetCityId: string; // 새로운 수도
}

// 전략 커맨드
export interface MobilizePeoplePayload {
  targetCityId: string; // 백성 동원할 도시
}

export interface FloodPayload {
  targetCityId: string; // 수몰시킬 도시
}

export interface FeintPayload {
  targetCityId: string; // 허보 대상 도시
}

export interface TwoTigersPayload {
  targetNationId: string; // 이호경식 대상 국가
}

export interface RaidPayload {
  targetNationId: string; // 급습 대상 국가
}

export interface CounterStrategyPayload {
  targetNationId: string; // 피장파장 대상 국가
  strategyType: CommandType; // 제한할 전략
}

// 기타
export interface ChangeFlagPayload {
  flagImage: string; // 국기 이미지
}

export interface ChangeNamePayload {
  newName: string; // 새 국호
}

// DTO 타입 정의
export interface SubmitCommandDto {
  sessionId?: string; // 게임 세션 ID
  commanderId: string; // generalId → commanderId로 변경
  type: CommandType;
  payload: Record<string, any>;
  cpCost?: number;
  cpType?: 'PCP' | 'MCP';
}
