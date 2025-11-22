/**
 * Battle 도메인 타입 정의
 */

export enum BattleStatus {
  PREPARING = 'PREPARING', // 준비 중
  IN_PROGRESS = 'IN_PROGRESS', // 전투 중
  COMPLETED = 'COMPLETED', // 완료
  CANCELLED = 'CANCELLED', // 취소
}

export enum BattleMode {
  REALTIME = 'REALTIME', // 실시간 (틱 기반)
  TURN_BASED = 'TURN_BASED', // 턴제 (라운드 기반)
}

/**
 * 전투 세션
 */
export interface IBattleSession {
  id: string;
  sessionId: string; // GameSession ID
  
  // 전투 정보
  attackerNationId: string;
  defenderNationId: string;
  targetCityId: string; // 공격 대상 도시
  
  // 전투 모드
  mode: BattleMode;
  
  // 격자 정보
  gridSize: { width: number; height: number }; // 기본 40x40
  terrain?: any; // 지형 정보
  
  // 참가자
  attackerCommanders: string[]; // 공격 지휘관 ID 목록
  defenderCommanders: string[]; // 수비 지휘관 ID 목록
  
  // 전투 상태
  status: BattleStatus;
  currentRound: number; // 현재 라운드 (턴제)
  currentTick: number; // 현재 틱 (실시간)
  
  // 시간
  startedAt: Date;
  completedAt?: Date;
  lastTickAt?: Date;
  
  // 결과
  result?: {
    winner: 'attacker' | 'defender' | 'draw';
    casualties: Record<string, number>; // commanderId -> 손실 병력
    capturedCommanders?: string[];
    killedCommanders?: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 전투 유닛 (격자 상 실체)
 */
export interface IApiBattleUnit {
  id: string;
  battleId: string;
  
  // 지휘관
  commanderId: string; // Entity ID (1:1)
  
  // 병력
  troops_reserved: number; // 예약된 병력 (crew_reserved)
  troops_current: number; // 현재 병력 (crew_reserved - casualties)
  unitType: number; // 병종 (crewType)
  
  // 위치
  position: { x: number; y: number };
  
  // 전투 수치
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  morale: number;
  
  // 상태
  status: 'active' | 'retreating' | 'routed' | 'destroyed';
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 전투 인텐트 (전투 내 오더)
 */
export interface IBattleIntent {
  id: string;
  battleId: string;
  unitId: string;
  
  type: 'MOVE' | 'ATTACK' | 'SKILL' | 'HOLD' | 'RETREAT' | 'FORMATION' | 'STANCE';
  
  params: {
    // MOVE
    targetPosition?: { x: number; y: number };
    path?: Array<{ x: number; y: number }>;
    
    // ATTACK
    targetUnitId?: string;
    attackType?: 'melee' | 'ranged';
    
    // SKILL
    skillId?: string;
    targetArea?: { x: number; y: number; radius: number };
    
    // FORMATION
    formationType?: 'offensive' | 'defensive' | 'wedge' | 'line';
    
    // STANCE
    stance?: 'aggressive' | 'defensive' | 'hold_ground';
  };
  
  // 실행 정보
  issuedAt: number; // 발행된 라운드/틱
  executedAt?: number; // 실행된 라운드/틱
  status: 'pending' | 'executing' | 'completed' | 'cancelled';
  
  createdAt: Date;
}

/**
 * 전투 이벤트 (웹소켓 푸시용)
 */
export interface BattleEvent {
  type: 'BATTLE_TICK' | 'UNIT_DAMAGED' | 'UNIT_DESTROYED' | 'GENERAL_KIA' | 'BATTLE_FINALIZED';
  battleId: string;
  timestamp: number;
  data: any;
  version: number;
}

export interface BattleTickEvent extends BattleEvent {
  type: 'BATTLE_TICK';
  data: {
    round: number;
    tick: number;
    units: Array<{
      id: string;
      hp: number;
      position: { x: number; y: number };
      status: string;
    }>;
  };
}

export interface UnitDamagedEvent extends BattleEvent {
  type: 'UNIT_DAMAGED';
  data: {
    unitId: string;
    damage: number;
    currentHp: number;
    attackerId?: string;
  };
}

export interface GeneralKIAEvent extends BattleEvent {
  type: 'GENERAL_KIA';
  data: {
    commanderId: string;
    killerId?: string;
  };
}

export interface BattleFinalizedEvent extends BattleEvent {
  type: 'BATTLE_FINALIZED';
  data: {
    winner: 'attacker' | 'defender' | 'draw';
    casualties: Record<string, number>;
    killedCommanders: string[];
  };
}

/**
 * DTO
 */
export interface StartBattleDto {
  sessionId: string;
  attackerCommanderIds: string[];
  targetCityId: string;
}

export interface IssueBattleIntentDto {
  battleId: string;
  unitId: string;
  type: IBattleIntent['type'];
  params: IBattleIntent['params'];
}
