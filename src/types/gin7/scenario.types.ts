/**
 * GIN7 Scenario Type Definitions
 * 
 * 시나리오, 이벤트, 스크립트 시스템 타입 정의
 * 은하영웅전설 전투 재현 및 커스텀 시나리오 지원
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

// ============================================================================
// Scenario Definition Types
// ============================================================================

/** 시나리오 메타데이터 */
export interface ScenarioMeta {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  author: string;
  version: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  estimatedTurns: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** 시나리오 세력 정의 */
export interface ScenarioFaction {
  factionId: string;
  name: string;
  type: 'empire' | 'alliance' | 'fezzan' | 'neutral' | 'custom';
  isPlayable: boolean;
  aiPersonality?: AIPersonalityType;
  color: string;
  emblemUrl?: string;
}

/** AI 성격 타입 */
export type AIPersonalityType = 
  | 'aggressive'     // 공격적 - 적극 공세
  | 'defensive'      // 방어적 - 요새 중심
  | 'balanced'       // 균형 - 상황 판단
  | 'cunning'        // 교활 - 전략적 후퇴, 함정
  | 'reckless'       // 무모 - 전면 돌격
  | 'cautious';      // 신중 - 물량 우세시만 공격

// ============================================================================
// Initial State Types
// ============================================================================

/** 초기 상태 정의 */
export interface ScenarioInitialState {
  gameDate: GameDate;
  territories: TerritoryState[];
  characters: CharacterState[];
  fleets: FleetState[];
  facilities?: FacilityState[];
  resources?: ResourceState[];
}

/** 게임 날짜 */
export interface GameDate {
  year: number;
  month: number;
  day: number;
}

/** 영토 상태 */
export interface TerritoryState {
  starSystemId: string;
  planetId?: string;
  ownerId: string;          // factionId
  support?: number;         // 지지율 (0-100)
  publicOrder?: number;     // 치안 (0-100)
  population?: number;
}

/** 캐릭터 상태 */
export interface CharacterState {
  characterId: string;
  templateId?: string;      // 오리지널 캐릭터 템플릿 ID
  name: string;
  factionId: string;
  locationId: string;       // starSystemId 또는 fleetId
  locationType: 'planet' | 'fleet' | 'base';
  rank?: string;
  position?: string;
  
  // 스탯 오버라이드 (템플릿 기본값 덮어쓰기)
  statsOverride?: {
    command?: number;
    might?: number;
    intellect?: number;
    politics?: number;
    charm?: number;
  };
  
  // 추가 데이터
  traits?: string[];
  skills?: string[];
}

/** 함대 상태 */
export interface FleetState {
  fleetId: string;
  name: string;
  factionId: string;
  commanderId: string;      // characterId
  locationId: string;       // starSystemId
  
  composition: FleetComposition;
  formation?: string;
  morale?: number;
  supply?: number;
}

/** 함대 구성 */
export interface FleetComposition {
  battleships: number;      // 전함
  cruisers: number;         // 순양함
  destroyers: number;       // 구축함
  carriers: number;         // 항공모함
  frigates: number;         // 호위함
  transports: number;       // 수송함
  fighters?: number;        // 함재기
}

/** 시설 상태 */
export interface FacilityState {
  facilityId: string;
  type: string;
  planetId: string;
  level: number;
  health?: number;
}

/** 자원 상태 */
export interface ResourceState {
  factionId: string;
  credits: number;
  materials: number;
  fuel: number;
  food: number;
  manpower: number;
}

// ============================================================================
// Victory/Defeat Condition Types
// ============================================================================

/** 조건 타입 */
export type ConditionType = 
  | 'CAPTURE_PLANET'        // 특정 행성 점령
  | 'CAPTURE_SYSTEM'        // 특정 항성계 점령
  | 'DESTROY_FLEET'         // 특정 함대 격멸
  | 'DESTROY_ALL_FLEETS'    // 적 전 함대 격멸
  | 'KILL_CHARACTER'        // 특정 캐릭터 사망/포로
  | 'SURVIVE_TURNS'         // N턴 생존
  | 'HOLD_TERRITORY'        // N턴 동안 영토 유지
  | 'ESCAPE'                // 특정 위치로 탈출
  | 'PROTECT_CHARACTER'     // 특정 캐릭터 생존
  | 'FLEET_SIZE'            // 함대 규모 달성
  | 'CUSTOM';               // 커스텀 스크립트

/** 승리/패배 조건 */
export interface GameCondition {
  id: string;
  type: ConditionType;
  description: string;
  targetFactionId?: string;   // 조건 적용 대상 세력 (없으면 전체)
  params: ConditionParams;
  priority?: number;          // 여러 조건 중 우선순위
  hidden?: boolean;           // 플레이어에게 숨김
}

/** 조건 파라미터 */
export interface ConditionParams {
  // CAPTURE_PLANET, CAPTURE_SYSTEM
  locationIds?: string[];
  
  // DESTROY_FLEET, PROTECT_CHARACTER, KILL_CHARACTER
  targetIds?: string[];
  
  // SURVIVE_TURNS, HOLD_TERRITORY
  turns?: number;
  
  // FLEET_SIZE
  minSize?: number;
  maxSize?: number;
  
  // CUSTOM
  scriptId?: string;
  customData?: Record<string, unknown>;
}

// ============================================================================
// Event System Types
// ============================================================================

/** 이벤트 정의 */
export interface ScenarioEvent {
  id: string;
  name: string;
  description?: string;
  
  trigger: EventTrigger;
  conditions?: EventCondition[];
  actions: EventAction[];
  choices?: EventChoice[];
  
  // 실행 옵션
  once?: boolean;             // 1회만 실행
  repeatable?: boolean;       // 반복 가능
  repeatDelay?: number;       // 반복 딜레이 (턴)
  priority?: number;          // 실행 우선순위
  enabled?: boolean;          // 활성화 여부
}

/** 이벤트 트리거 타입 */
export type EventTriggerType = 
  | 'ON_TURN'                 // 특정 턴
  | 'ON_TURN_RANGE'           // 턴 범위
  | 'ON_DAY_START'            // 일일 시작
  | 'ON_MONTH_START'          // 월간 시작
  | 'ON_BATTLE_START'         // 전투 시작
  | 'ON_BATTLE_END'           // 전투 종료
  | 'ON_PLANET_CAPTURED'      // 행성 점령
  | 'ON_FLEET_DESTROYED'      // 함대 격멸
  | 'ON_CHARACTER_DEATH'      // 캐릭터 사망
  | 'ON_CHARACTER_CAPTURED'   // 캐릭터 포로
  | 'ON_FLEET_ARRIVED'        // 함대 도착
  | 'ON_RESOURCE_LOW'         // 자원 부족
  | 'ON_MORALE_LOW'           // 사기 저하
  | 'ON_EVENT_TRIGGERED'      // 다른 이벤트 트리거
  | 'ON_CONDITION_MET'        // 조건 충족
  | 'MANUAL';                 // 수동 트리거

/** 이벤트 트리거 */
export interface EventTrigger {
  type: EventTriggerType;
  params: TriggerParams;
}

/** 트리거 파라미터 */
export interface TriggerParams {
  turn?: number;
  turnMin?: number;
  turnMax?: number;
  locationId?: string;
  characterId?: string;
  fleetId?: string;
  factionId?: string;
  eventId?: string;
  conditionId?: string;
  resourceType?: string;
  threshold?: number;
}

/** 이벤트 조건 (추가 필터) */
export interface EventCondition {
  type: 'AND' | 'OR' | 'NOT';
  checks: ConditionCheck[];
}

/** 조건 체크 */
export interface ConditionCheck {
  checkType: 
    | 'FACTION_CONTROLS'      // 세력이 위치 점령 중
    | 'CHARACTER_ALIVE'       // 캐릭터 생존
    | 'CHARACTER_AT'          // 캐릭터 위치
    | 'FLEET_AT'              // 함대 위치
    | 'FLEET_SIZE_GTE'        // 함대 규모 이상
    | 'FLEET_SIZE_LTE'        // 함대 규모 이하
    | 'RESOURCE_GTE'          // 자원 이상
    | 'RESOURCE_LTE'          // 자원 이하
    | 'TURN_GTE'              // 턴 이상
    | 'FLAG_SET'              // 플래그 설정됨
    | 'CUSTOM';               // 커스텀 체크
  params: Record<string, unknown>;
}

/** 이벤트 액션 타입 */
export type EventActionType = 
  | 'SHOW_DIALOGUE'           // 대화/알림 표시
  | 'SHOW_CUTSCENE'           // 컷신 재생
  | 'SPAWN_FLEET'             // 함대 생성
  | 'SPAWN_CHARACTER'         // 캐릭터 생성
  | 'REMOVE_FLEET'            // 함대 제거
  | 'REMOVE_CHARACTER'        // 캐릭터 제거
  | 'MOVE_FLEET'              // 함대 이동
  | 'MODIFY_STAT'             // 스탯 변경
  | 'MODIFY_RESOURCE'         // 자원 변경
  | 'MODIFY_MORALE'           // 사기 변경
  | 'CHANGE_OWNER'            // 소유권 변경
  | 'SET_FLAG'                // 플래그 설정
  | 'TRIGGER_EVENT'           // 다른 이벤트 트리거
  | 'START_BATTLE'            // 전투 시작
  | 'END_BATTLE'              // 전투 종료
  | 'APPLY_FORMATION'         // 진형 적용
  | 'ENABLE_EVENT'            // 이벤트 활성화
  | 'DISABLE_EVENT'           // 이벤트 비활성화
  | 'PLAY_SOUND'              // 사운드 재생
  | 'CAMERA_FOCUS'            // 카메라 포커스
  | 'DELAY'                   // 딜레이
  | 'CUSTOM';                 // 커스텀 액션

/** 이벤트 액션 */
export interface EventAction {
  type: EventActionType;
  params: ActionParams;
  delay?: number;             // 실행 전 딜레이 (ms)
}

/** 액션 파라미터 */
export interface ActionParams {
  // SHOW_DIALOGUE
  speakerId?: string;
  speakerName?: string;
  text?: string;
  portrait?: string;
  duration?: number;
  
  // SPAWN_FLEET
  fleetData?: FleetState;
  
  // SPAWN_CHARACTER
  characterData?: CharacterState;
  
  // MOVE_FLEET, REMOVE_FLEET
  fleetId?: string;
  targetLocationId?: string;
  
  // MODIFY_STAT, MODIFY_RESOURCE, MODIFY_MORALE
  targetId?: string;
  statName?: string;
  value?: number;
  operation?: 'set' | 'add' | 'subtract' | 'multiply';
  
  // CHANGE_OWNER
  locationId?: string;
  newOwnerId?: string;
  
  // SET_FLAG
  flagName?: string;
  flagValue?: unknown;
  
  // TRIGGER_EVENT
  eventId?: string;
  
  // START_BATTLE
  attackerFleetId?: string;
  defenderFleetId?: string;
  battleType?: 'space' | 'ground' | 'siege';
  specialRules?: string[];
  
  // APPLY_FORMATION
  formationId?: string;
  
  // CUSTOM
  scriptId?: string;
  customData?: Record<string, unknown>;
}

/** 이벤트 선택지 */
export interface EventChoice {
  id: string;
  text: string;
  conditions?: EventCondition[];    // 선택지 표시 조건
  actions: EventAction[];           // 선택 시 실행할 액션
  consequences?: string;            // 결과 설명 (힌트)
}

// ============================================================================
// Scripted Battle Types
// ============================================================================

/** 스크립트 전투 정의 */
export interface ScriptedBattle {
  id: string;
  name: string;
  description: string;
  
  // 참가 세력
  attackerFactionId: string;
  defenderFactionId: string;
  
  // 초기 배치
  attackerFleets: FleetState[];
  defenderFleets: FleetState[];
  
  // 전투 설정
  battleType: 'space' | 'ground' | 'siege';
  mapId?: string;
  
  // 특수 규칙
  specialRules: BattleSpecialRule[];
  
  // 전투 중 이벤트
  battleEvents: ScenarioEvent[];
  
  // 승리/패배 조건
  victoryConditions: GameCondition[];
  defeatConditions: GameCondition[];
}

/** 전투 특수 규칙 */
export interface BattleSpecialRule {
  id: string;
  name: string;
  description: string;
  type: BattleSpecialRuleType;
  params: Record<string, unknown>;
}

/** 특수 규칙 타입 */
export type BattleSpecialRuleType = 
  | 'NO_RETREAT'              // 퇴각 불가
  | 'REINFORCEMENT_WAVE'      // 증원 웨이브
  | 'TIME_LIMIT'              // 시간 제한
  | 'TERRAIN_EFFECT'          // 지형 효과
  | 'WEATHER_EFFECT'          // 기상 효과 (성간 폭풍 등)
  | 'MORALE_BOOST'            // 사기 부스트
  | 'DAMAGE_MODIFIER'         // 데미지 배율
  | 'FORMATION_LOCK'          // 진형 고정
  | 'COMMANDER_BUFF'          // 지휘관 버프
  | 'SPECIAL_ABILITY'         // 특수 능력 활성화
  | 'CUSTOM';                 // 커스텀 규칙

// ============================================================================
// Campaign Types
// ============================================================================

/** 캠페인 정의 */
export interface Campaign {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  
  scenarios: CampaignScenario[];
  currentIndex: number;
  
  // 캠페인 진행 데이터
  carryOverData: CampaignCarryOver;
  
  // 분기
  branches?: CampaignBranch[];
}

/** 캠페인 시나리오 */
export interface CampaignScenario {
  scenarioId: string;
  name: string;
  required: boolean;          // 필수 여부
  unlockConditions?: string[]; // 해금 조건 (플래그)
}

/** 캠페인 이어받기 데이터 */
export interface CampaignCarryOver {
  characters: {
    characterId: string;
    alive: boolean;
    rank?: string;
    experience?: number;
  }[];
  
  flags: Record<string, unknown>;
  
  resources?: {
    factionId: string;
    credits: number;
    materials: number;
  }[];
  
  reputation?: number;
  score?: number;
}

/** 캠페인 분기 */
export interface CampaignBranch {
  id: string;
  name: string;
  description: string;
  conditions: EventCondition[];
  nextScenarioId: string;
}

// ============================================================================
// Runtime Types
// ============================================================================

/** 시나리오 런타임 상태 */
export interface ScenarioRuntimeState {
  scenarioId: string;
  sessionId: string;
  
  currentTurn: number;
  gameDate: GameDate;
  
  // 플래그/변수
  flags: Map<string, unknown>;
  variables: Map<string, number>;
  
  // 이벤트 상태
  triggeredEvents: Set<string>;
  activeEvents: string[];
  pendingChoices: {
    eventId: string;
    choices: EventChoice[];
  }[];
  
  // 조건 상태
  satisfiedConditions: Set<string>;
  
  // 통계
  stats: {
    battlesWon: number;
    battlesLost: number;
    unitsLost: number;
    unitsKilled: number;
    charactersLost: number;
  };
}








