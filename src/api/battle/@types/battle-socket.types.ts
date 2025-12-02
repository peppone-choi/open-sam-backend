/**
 * 전투 WebSocket 메시지 타입 정의
 * 클라이언트 ↔ 서버 실시간 통신
 */

// ============================================
// 클라이언트 → 서버 메시지
// ============================================

/**
 * 전투 참가 요청
 */
export interface JoinBattleMessage {
  battleId: string;
  generalId: number;
}

/**
 * 전투 액션 (턴제 모드)
 */
export interface BattleActionMessage {
  battleId: string;
  generalId: number;
  action: TurnAction;
}

/**
 * 턴제 액션 정의
 */
export interface TurnAction {
  generalId: number;
  type: 'move' | 'attack' | 'skill' | 'hold' | 'retreat';
  targetPosition?: { x: number; y: number };
  targetGeneralId?: number;
  skillId?: string;
}

/**
 * 준비 완료 신호
 */
export interface ReadyMessage {
  battleId: string;
  generalId: number;
}

/**
 * 전투 퇴장
 */
export interface LeaveMessage {
  battleId: string;
  generalId: number;
}

/**
 * 실시간 전투 명령
 */
export interface BattleCommandMessage {
  battleId: string;
  generalId: number;
  unitId?: string;  // 멀티스택 모드에서 특정 유닛 지정
  command: BattleCommandType;
  params: BattleCommandParams;
}

/**
 * 명령 타입
 */
export type BattleCommandType = 
  | 'move'       // 이동
  | 'attack'     // 공격
  | 'hold'       // 정지
  | 'retreat'    // 후퇴
  | 'formation'  // 진형 변경
  | 'stance'     // 자세 변경
  | 'ability'    // 특수 능력 사용
  | 'volley'     // 일제 사격
  | 'charge'     // 돌격
  | 'rally';     // 재집결

/**
 * 명령 파라미터
 */
export interface BattleCommandParams {
  // 이동
  targetPosition?: { x: number; y: number };
  path?: Array<{ x: number; y: number }>;
  
  // 공격
  targetUnitId?: string;
  attackType?: 'melee' | 'ranged';
  
  // 진형
  formation?: 'line' | 'column' | 'wedge' | 'square' | 'skirmish';
  
  // 자세
  stance?: 'aggressive' | 'defensive' | 'hold' | 'skirmish' | 'retreat';
  
  // 특수 능력
  abilityId?: string;
  targetArea?: { x: number; y: number; radius: number };
  
  // 일제 사격
  volleyTarget?: { x: number; y: number };
}

/**
 * 유닛 배치 요청
 */
export interface DeployUnitMessage {
  battleId: string;
  generalId: number;
  unitId?: string;
  position: { x: number; y: number };
  facing?: number;
  formation?: string;
}

/**
 * 채팅 메시지
 */
export interface BattleChatMessage {
  battleId: string;
  senderId: number;
  message: string;
  teamOnly?: boolean;
}

// ============================================
// 서버 → 클라이언트 메시지
// ============================================

/**
 * 전투 참가 성공
 */
export interface JoinedBattleEvent {
  battleId: string;
  status: string;
  currentPhase: string;
  currentTurn: number;
  attackerUnits: BattleUnitState[];
  defenderUnits: BattleUnitState[];
  terrain: string;
  map: BattleMapInfo;
  participants: BattleParticipant[];
  isRealtime: boolean;
  tickRate?: number;
}

/**
 * 유닛 상태
 */
export interface BattleUnitState {
  id: string;
  generalId: number;
  generalName: string;
  troops: number;
  maxTroops: number;
  position: { x: number; y: number };
  velocity?: { x: number; y: number };
  facing: number;
  morale: number;
  training: number;
  unitType: number;
  formation: string;
  stance: string;
  status: 'active' | 'retreating' | 'routed' | 'destroyed';
  isCharging: boolean;
  isAIControlled: boolean;
  commanderId?: number;
  nationId: number;
}

/**
 * 맵 정보
 */
export interface BattleMapInfo {
  width: number;
  height: number;
  entryDirection: string;
  attackerZone: { x: [number, number]; y: [number, number] };
  defenderZone: { x: [number, number]; y: [number, number] };
  castle?: {
    center: { x: number; y: number };
    radius: number;
    gates: Array<{
      id: string;
      position: { x: number; y: number };
      width: number;
      height: number;
      hp: number;
      maxHp: number;
    }>;
    targetGateId: string;
  };
  terrain?: TerrainData;
}

/**
 * 지형 데이터
 */
export interface TerrainData {
  cells: TerrainCell[][];
  features: TerrainFeature[];
}

export interface TerrainCell {
  type: 'plains' | 'forest' | 'hill' | 'river' | 'swamp' | 'road' | 'sand';
  height: number;
  movementCost: number;
}

export interface TerrainFeature {
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
}

/**
 * 전투 참가자
 */
export interface BattleParticipant {
  generalId: number;
  role: 'FIELD_COMMANDER' | 'SUB_COMMANDER' | 'STAFF';
  controlledUnitGeneralIds: number[];
}

/**
 * 전투 시작 이벤트
 */
export interface BattleStartedEvent {
  currentTurn: number;
  timestamp: Date;
}

/**
 * 계획 단계 이벤트
 */
export interface PlanningPhaseEvent {
  currentTurn: number;
  timeLimit: number;
  timestamp: Date;
}

/**
 * 해결 단계 이벤트
 */
export interface ResolutionPhaseEvent {
  currentTurn: number;
  timestamp: Date;
}

/**
 * 턴 해결 결과
 */
export interface TurnResolvedEvent {
  turnNumber: number;
  results: TurnResults;
  nextTurn: number;
  timestamp: Date;
}

/**
 * 턴 결과
 */
export interface TurnResults {
  attackerCasualties: number;
  defenderCasualties: number;
  attackerSurvivors: number;
  defenderSurvivors: number;
  battleLog: string[];
  winner?: 'attacker' | 'defender';
}

/**
 * 전투 종료 이벤트
 */
export interface BattleEndedEvent {
  battleId: string;
  winner: 'attacker' | 'defender' | 'draw';
  finalState: {
    attackerUnits: BattleUnitState[];
    defenderUnits: BattleUnitState[];
  };
  duration: number;
  rewards?: BattleRewards;
  timestamp: Date;
}

/**
 * 전투 보상
 */
export interface BattleRewards {
  winnerExperience: number;
  loserExperience: number;
  loot: Array<{
    itemId: string;
    quantity: number;
    type: 'gold' | 'equipment' | 'supply' | 'special';
  }>;
  prisoners: string[];
  territoryCaptured?: string;
}

/**
 * 실시간 상태 업데이트
 */
export interface BattleStateEvent {
  tick: number;
  units: Array<{
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    facing: number;
    troops: number;
    morale: number;
    status: string;
  }>;
  projectiles: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    type: string;
  }>;
  events: BattleGameEvent[];
  timestamp: Date;
}

/**
 * 전투 게임 이벤트
 */
export interface BattleGameEvent {
  type: BattleEventType;
  tick: number;
  data: Record<string, unknown>;
}

/**
 * 이벤트 타입
 */
export type BattleEventType =
  | 'unit_damaged'
  | 'unit_killed'
  | 'squad_routed'
  | 'squad_rallied'
  | 'charge_started'
  | 'charge_impact'
  | 'flank_attack'
  | 'duel_started'
  | 'duel_ended'
  | 'ability_used'
  | 'general_killed'
  | 'general_captured'
  | 'gate_damaged'
  | 'gate_destroyed'
  | 'morale_broken';

/**
 * 명령 확인 응답
 */
export interface CommandAcknowledgedEvent {
  commandId: string;
  generalId: number;
  command: BattleCommandType;
  timestamp: Date;
}

/**
 * 유닛 배치 완료
 */
export interface UnitDeployedEvent {
  unitId: string;
  position: { x: number; y: number };
  formation: string;
  timestamp: Date;
}

/**
 * 플레이어 준비 완료
 */
export interface PlayerReadyEvent {
  generalId: number;
  readyPlayers: number[];
  timestamp: Date;
}

/**
 * 플레이어 참가
 */
export interface PlayerJoinedEvent {
  generalId: number;
  timestamp: Date;
}

/**
 * 플레이어 퇴장
 */
export interface PlayerLeftEvent {
  generalId: number;
  timestamp: Date;
}

/**
 * 전투 로그
 */
export interface BattleLogEvent {
  battleId: string;
  logText: string;
  logType: 'action' | 'damage' | 'status' | 'result';
  timestamp: Date;
}

/**
 * 에러 이벤트
 */
export interface BattleErrorEvent {
  message: string;
  code?: string;
}

/**
 * 항복 이벤트
 */
export interface SurrenderEvent {
  battleId: string;
  surrenderedBy: number;
  winner: 'attacker' | 'defender';
  timestamp: Date;
}

/**
 * 전투 취소 이벤트
 */
export interface BattleCancelledEvent {
  battleId: string;
  reason?: string;
  timestamp: Date;
}

// ============================================
// 타입 가드
// ============================================

export function isBattleCommandMessage(msg: unknown): msg is BattleCommandMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'battleId' in msg &&
    'generalId' in msg &&
    'command' in msg
  );
}

export function isDeployUnitMessage(msg: unknown): msg is DeployUnitMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'battleId' in msg &&
    'generalId' in msg &&
    'position' in msg
  );
}





