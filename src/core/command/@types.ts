/**
 * 커맨드 시스템 타입 정의
 */

/**
 * 커맨드 카테고리
 */
export type CommandCategory = 'general' | 'nation';

/**
 * 커맨드 상태
 */
export type CommandStatus = 
  | 'pending'      // 대기 중
  | 'executing'    // 실행 중
  | 'completed'    // 완료
  | 'failed'       // 실패
  | 'cancelled';   // 취소됨

/**
 * 커맨드 인자
 */
export type CommandArg = Record<string, unknown> | null;

/**
 * 커맨드 환경 데이터
 */
export interface CommandEnv {
  year: number;
  month: number;
  init_year: number;
  init_month: number;
  startyear: number;
  develcost: number;
  join_mode: string;
  maxnation: number;
  [key: string]: any;
}

/**
 * 커맨드 비용
 */
export interface CommandCost {
  gold: number;
  rice: number;
}

/**
 * 베이스 커맨드 인터페이스
 */
export interface IBaseCommand {
  /**
   * 전체 조건 충족 여부
   */
  hasFullConditionMet(): boolean;

  /**
   * 조건 불충족 이유 조회
   */
  testFullConditionMet(): string | null;

  /**
   * 커맨드 비용 조회
   */
  getCost(): [number, number];

  /**
   * 커맨드 실행
   */
  run(rng: any): Promise<boolean>;

  /**
   * 결과 턴 조회
   */
  getResultTurn(): any;

  /**
   * 사전 필요 턴 수
   */
  getPreReqTurn(): number;

  /**
   * 사후 대기 턴 수
   */
  getPostReqTurn(): number;
}

/**
 * 커맨드 생성자 타입
 */
export type CommandConstructor<T extends IBaseCommand = IBaseCommand> = new (
  general: any,
  env: CommandEnv,
  arg?: CommandArg
) => T;

/**
 * 커맨드 실행 데이터
 */
export interface CommandExecutionData {
  category: CommandCategory;
  type: string;
  generalId: string;
  sessionId: string;
  arg?: CommandArg;
}

/**
 * 커맨드 검증 결과
 */
export interface CommandValidationResult {
  valid: boolean;
  errors?: string[];
  cost?: CommandCost;
}

/**
 * 커맨드 실행 결과
 */
export interface CommandExecutionResult {
  success: boolean;
  commandId: string;
  result?: any;
  error?: string;
}

/**
 * 커맨드 제출 데이터
 */
export interface CommandSubmitData {
  sessionId: string;
  generalId: string;
  category: CommandCategory;
  type: string;
  arg?: CommandArg;
  priority?: number;
}

/**
 * 커맨드 문서 (DB)
 */
export interface ICommandDocument {
  _id: string;
  session_id: string;
  general_id: string;
  category: CommandCategory;
  type: string;
  arg?: CommandArg;
  status: CommandStatus;
  priority: number;
  cost?: CommandCost;
  created_at: Date;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  result?: any;
  error?: string;
}
