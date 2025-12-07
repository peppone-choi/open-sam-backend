/**
 * Gin7 NPC AI Types
 * NPC 및 AI 행동 시스템의 타입 정의
 */

// ============================================================
// Behavior Tree Node Status
// ============================================================

export enum BehaviorStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
}

export type BehaviorNodeType = 
  | 'SELECTOR'      // OR 연산 - 하나라도 SUCCESS면 SUCCESS
  | 'SEQUENCE'      // AND 연산 - 모두 SUCCESS여야 SUCCESS
  | 'PARALLEL'      // 병렬 실행
  | 'CONDITION'     // 조건 체크
  | 'ACTION'        // 실행 노드
  | 'DECORATOR'     // 장식자 (반복, 반전 등)
  | 'INVERTER'      // 결과 반전
  | 'REPEATER'      // 반복
  | 'SUCCEEDER';    // 항상 SUCCESS

// ============================================================
// AI Personality
// ============================================================

/**
 * 전술 스타일 타입
 * 각 제독의 고유한 전투 스타일을 정의
 */
export type TacticalStyle = 
  | 'REINHARD'      // 라인하르트 스타일 - 공세적, 선제공격, 집중화력
  | 'YANG_WENLI'    // 양 웬리 스타일 - 방어적/기동적, 적 실수 유도, 후퇴 후 반격
  | 'MITTERMEYER'   // 미터마이어 스타일 - 고속기동, 측면공격, 분산후집중
  | 'REUENTHAL'     // 로이엔탈 스타일 - 균형잡힌 상황적응, 정면돌파+우회
  | 'BITTENFELD'    // 비텐펠트 스타일 - 극도의 공격성, 돌격 특화
  | 'MERKATZ'       // 메르카츠 스타일 - 노련한 방어전, 안정적 지휘
  | 'FAHRENHEIT'    // 파렌하이트 스타일 - 충성스런 돌격, 후퇴 거부
  | 'DEFAULT';      // 기본 AI 스타일

/**
 * 전술 스타일별 설정
 */
export interface TacticalStyleConfig {
  style: TacticalStyle;
  name: string;
  nameKo: string;
  description: string;
  
  // 전투 단계별 선호 행동
  openingAction: 'AGGRESSIVE' | 'DEFENSIVE' | 'MANEUVER' | 'OBSERVE';
  midgameAction: 'PRESS_ATTACK' | 'HOLD_LINE' | 'FLANKING' | 'ADAPT';
  desperateAction: 'CHARGE' | 'RETREAT' | 'LAST_STAND' | 'GUERRILLA';
  
  // 특수 전술 사용 확률 (0-100)
  focusFireChance: number;        // 집중 사격 확률
  flankingChance: number;         // 측면 공격 확률
  retreatThreshold: number;       // 퇴각 HP 임계값 (0=절대 퇴각 안함)
  counterattackChance: number;    // 반격 확률
  
  // 에너지 배분 기본값
  defaultEnergyBias: 'ATTACK' | 'DEFENSE' | 'MOBILITY' | 'BALANCED';
  
  // 진형 선호도
  preferredFormations: string[];
}

export interface AIPersonality {
  // 기본 성향 (0-100)
  aggression: number;     // 공격성 - 높으면 공격적 결정
  caution: number;        // 신중함 - 높으면 안전한 결정
  creativity: number;     // 창의성 - 높으면 비정통적 전술
  loyalty: number;        // 충성도 - 높으면 명령 준수
  patience: number;       // 인내심 - 높으면 장기전 선호
  
  // 특수 성향
  prefersFlanking: boolean;     // 측면 공격 선호
  prefersDefensive: boolean;    // 방어적 태세 선호
  prefersGuerrilla: boolean;    // 게릴라전 선호
  willRetreat: boolean;         // 퇴각 의향
  acceptsSurrender: boolean;    // 항복 수락 여부
  
  // 전술 스타일 (신규)
  tacticalStyle?: TacticalStyle;
}

export interface AIPersonalityPreset {
  id: string;
  name: string;
  nameKo: string;
  personality: AIPersonality;
  description: string;
}

// ============================================================
// Strategic AI Types
// ============================================================

export interface StrategicContext {
  sessionId: string;
  factionId: string;
  currentTick: number;
  
  // 자원 상황
  resources: {
    credits: number;
    minerals: number;
    food: number;
    fuel: number;
    shipParts: number;
  };
  
  // 영토 상황
  territory: {
    ownedPlanets: string[];
    ownedSystems: string[];
    borderPlanets: string[];  // 적과 인접한 행성
    frontlineSystems: string[];  // 전선 성계
  };
  
  // 군사력
  military: {
    totalFleets: number;
    totalShips: number;
    combatPower: number;
    idleFleets: string[];
    fleetsBySystem: Map<string, string[]>;
  };
  
  // 적 정보
  enemies: EnemyAssessment[];
  
  // 외교 상태
  diplomacy: {
    atWarWith: string[];
    allies: string[];
    neutral: string[];
  };
}

export interface EnemyAssessment {
  factionId: string;
  estimatedPower: number;
  knownFleets: number;
  knownPlanets: string[];
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recentActivity: string[];  // 최근 행동 로그
}

export interface StrategicDecision {
  type: StrategicDecisionType;
  priority: number;  // 0-100
  target?: string;   // targetId (planet, system, faction)
  fleetIds?: string[];
  parameters?: Record<string, unknown>;
  reasoning: string;
}

export type StrategicDecisionType = 
  | 'ATTACK'          // 공격 명령
  | 'DEFEND'          // 방어 배치
  | 'REINFORCE'       // 병력 증원
  | 'RETREAT'         // 전략적 후퇴
  | 'BUILD_FLEET'     // 함대 건조
  | 'BUILD_FACILITY'  // 시설 건설
  | 'DIPLOMACY'       // 외교 행동
  | 'TRADE'           // 무역 설정
  | 'WAIT';           // 대기

// ============================================================
// Tactical AI Types
// ============================================================

export interface TacticalContext {
  battleId: string;
  factionId: string;
  currentTick: number;
  
  // 아군 상황
  ownUnits: TacticalUnitSummary[];
  ownTotalPower: number;
  ownAverageHp: number;
  ownAverageMorale: number;
  
  // 적군 상황
  enemyUnits: TacticalUnitSummary[];
  enemyTotalPower: number;
  enemyAverageHp: number;
  
  // 전장 상황
  battlePhase: 'OPENING' | 'MIDGAME' | 'ENDGAME' | 'DESPERATE';
  ticksElapsed: number;
  advantageRatio: number;  // 아군/적군 전력비
  
  // 현재 전술 상태
  currentFormation: string;
  currentTargeting: string;
  warpChargeLevel: number;  // 퇴각용 워프 충전 상태
}

export interface TacticalUnitSummary {
  unitId: string;
  shipClass: string;
  shipCount: number;
  hpPercent: number;
  morale: number;
  combatPower: number;
  hasTarget: boolean;
  isRetreating: boolean;
  isChaos: boolean;
}

export interface TacticalDecision {
  type: TacticalDecisionType;
  unitIds: string[];
  target?: string | { x: number; y: number; z: number };
  formation?: string;
  energyDistribution?: {
    beam: number;
    gun: number;
    shield: number;
    engine: number;
    warp: number;
    sensor: number;
  };
  reasoning: string;
}

export type TacticalDecisionType = 
  | 'ATTACK_TARGET'      // 특정 타겟 공격
  | 'FOCUS_FIRE'         // 집중 사격
  | 'CHANGE_FORMATION'   // 진형 변경
  | 'CHANGE_ENERGY'      // 에너지 배분 변경
  | 'MOVE_POSITION'      // 위치 이동
  | 'RETREAT'            // 퇴각
  | 'HOLD_POSITION'      // 현 위치 유지
  | 'CHARGE';            // 돌격

// ============================================================
// Behavior Tree Blackboard
// ============================================================

export interface AIBlackboard {
  // 컨텍스트 데이터
  strategicContext?: StrategicContext;
  tacticalContext?: TacticalContext;
  
  // 현재 결정
  currentStrategicDecisions: StrategicDecision[];
  currentTacticalDecisions: TacticalDecision[];
  
  // AI 성격
  personality: AIPersonality;
  
  // 임시 데이터
  tempData: Map<string, unknown>;
  
  // 실행 기록
  lastEvaluationTick: number;
  lastDecisions: string[];
  decisionHistory: DecisionHistoryEntry[];
}

export interface DecisionHistoryEntry {
  tick: number;
  decision: StrategicDecision | TacticalDecision;
  outcome: 'SUCCESS' | 'FAILURE' | 'PENDING';
}

// ============================================================
// NPC Faction Controller Types
// ============================================================

export interface NPCFactionState {
  factionId: string;
  sessionId: string;
  
  // AI 설정
  aiEnabled: boolean;
  aiDifficulty: 'EASY' | 'NORMAL' | 'HARD' | 'BRUTAL';
  personality: AIPersonality;
  
  // 행동 트리
  strategicTreeId: string;
  tacticalTreeId: string;
  
  // 상태
  blackboard: AIBlackboard;
  
  // 통계
  stats: {
    decisionsTotal: number;
    attacksLaunched: number;
    defensesOrdered: number;
    battlesWon: number;
    battlesLost: number;
    planetsConquered: number;
    planetsLost: number;
  };
  
  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  lastTickProcessed: number;
}

// ============================================================
// AI Config
// ============================================================

export const AI_CONFIG = {
  // Strategic AI
  STRATEGIC_EVAL_INTERVAL: 5,  // 몇 틱마다 전략 평가
  MAX_SIMULTANEOUS_ATTACKS: 3, // 동시 공격 최대 수
  MIN_DEFENSE_FLEETS: 1,       // 최소 방어 함대 수
  ATTACK_POWER_THRESHOLD: 1.2, // 공격 결정을 위한 최소 전력비
  
  // Tactical AI
  TACTICAL_EVAL_INTERVAL: 5,   // 몇 틱마다 전술 평가 (전투 중)
  RETREAT_HP_THRESHOLD: 30,    // 퇴각 HP 임계값
  RETREAT_MORALE_THRESHOLD: 20,// 퇴각 사기 임계값
  FOCUS_FIRE_THRESHOLD: 3,     // 집중 사격 대상 최소 유닛 수
  
  // Difficulty Modifiers
  DIFFICULTY: {
    EASY: {
      reactionDelay: 3,        // 반응 지연 틱
      accuracyMod: 0.8,        // 정확도 보정
      economyMod: 0.9,         // 경제 보정
      intelligenceMod: 0.7,    // 정보 수집력 보정
    },
    NORMAL: {
      reactionDelay: 2,
      accuracyMod: 1.0,
      economyMod: 1.0,
      intelligenceMod: 0.9,
    },
    HARD: {
      reactionDelay: 1,
      accuracyMod: 1.1,
      economyMod: 1.1,
      intelligenceMod: 1.0,
    },
    BRUTAL: {
      reactionDelay: 0,
      accuracyMod: 1.2,
      economyMod: 1.2,
      intelligenceMod: 1.0,
    },
  },
};

// ============================================================
// Personality Presets (은영전 캐릭터)
// ============================================================

export const PERSONALITY_PRESETS: Record<string, AIPersonalityPreset> = {
  REINHARD: {
    id: 'REINHARD',
    name: 'Reinhard von Lohengramm',
    nameKo: '라인하르트 폰 로엔그람',
    personality: {
      aggression: 85,
      caution: 40,
      creativity: 75,
      loyalty: 70,
      patience: 30,
      prefersFlanking: true,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'REINHARD',
    },
    description: '대담하고 공격적인 전술을 선호하며, 결단력 있는 지휘 스타일',
  },
  YANG_WENLI: {
    id: 'YANG_WENLI',
    name: 'Yang Wen-li',
    nameKo: '양 웬리',
    personality: {
      aggression: 35,
      caution: 75,
      creativity: 95,
      loyalty: 85,
      patience: 80,
      prefersFlanking: true,
      prefersDefensive: true,
      prefersGuerrilla: true,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'YANG_WENLI',
    },
    description: '방어적이고 창의적인 전술의 대가, 비정통적 전략 선호',
  },
  MITTERMEYER: {
    id: 'MITTERMEYER',
    name: 'Wolfgang Mittermeyer',
    nameKo: '볼프강 미터마이어',
    personality: {
      aggression: 70,
      caution: 55,
      creativity: 60,
      loyalty: 90,
      patience: 45,
      prefersFlanking: true,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'MITTERMEYER',
    },
    description: '기동력을 중시하는 고속 전술 전문가',
  },
  REUENTHAL: {
    id: 'REUENTHAL',
    name: 'Oskar von Reuenthal',
    nameKo: '오스카 폰 로이엔탈',
    personality: {
      aggression: 80,
      caution: 50,
      creativity: 65,
      loyalty: 60,
      patience: 40,
      prefersFlanking: false,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'REUENTHAL',
    },
    description: '정공법을 선호하는 강직한 지휘관',
  },
  BITTENFELD: {
    id: 'BITTENFELD',
    name: 'Fritz Joseph Bittenfeld',
    nameKo: '프리츠 요제프 비텐펠트',
    personality: {
      aggression: 95,
      caution: 20,
      creativity: 40,
      loyalty: 85,
      patience: 15,
      prefersFlanking: false,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: false,
      acceptsSurrender: true,
      tacticalStyle: 'BITTENFELD',
    },
    description: '돌격 전문가, 극도로 공격적인 전술 선호',
  },
  MERKATZ: {
    id: 'MERKATZ',
    name: 'Willibald Joachim von Merkatz',
    nameKo: '빌리발트 요아힘 폰 메르카츠',
    personality: {
      aggression: 45,
      caution: 80,
      creativity: 55,
      loyalty: 95,
      patience: 85,
      prefersFlanking: false,
      prefersDefensive: true,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'MERKATZ',
    },
    description: '노련한 제독, 신중하고 안정적인 지휘',
  },
  FAHRENHEIT: {
    id: 'FAHRENHEIT',
    name: 'Adalbert von Fahrenheit',
    nameKo: '아달베르트 폰 파렌하이트',
    personality: {
      aggression: 75,
      caution: 45,
      creativity: 50,
      loyalty: 100,
      patience: 35,
      prefersFlanking: false,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: false,
      acceptsSurrender: true,
      tacticalStyle: 'FAHRENHEIT',
    },
    description: '충성스럽고 용맹한 지휘관, 후퇴를 거부',
  },
  DEFENSIVE_AI: {
    id: 'DEFENSIVE_AI',
    name: 'Defensive AI',
    nameKo: '방어형 AI',
    personality: {
      aggression: 30,
      caution: 80,
      creativity: 40,
      loyalty: 100,
      patience: 90,
      prefersFlanking: false,
      prefersDefensive: true,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'DEFAULT',
    },
    description: '안전 우선의 방어적 AI',
  },
  AGGRESSIVE_AI: {
    id: 'AGGRESSIVE_AI',
    name: 'Aggressive AI',
    nameKo: '공격형 AI',
    personality: {
      aggression: 85,
      caution: 25,
      creativity: 50,
      loyalty: 100,
      patience: 20,
      prefersFlanking: true,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'DEFAULT',
    },
    description: '공격 우선의 적극적 AI',
  },
  BALANCED_AI: {
    id: 'BALANCED_AI',
    name: 'Balanced AI',
    nameKo: '균형형 AI',
    personality: {
      aggression: 50,
      caution: 50,
      creativity: 50,
      loyalty: 100,
      patience: 50,
      prefersFlanking: false,
      prefersDefensive: false,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'DEFAULT',
    },
    description: '균형 잡힌 표준 AI',
  },
};

// ============================================================
// Tactical Style Configurations
// ============================================================

/**
 * 전술 스타일별 상세 설정
 */
export const TACTICAL_STYLE_CONFIGS: Record<TacticalStyle, TacticalStyleConfig> = {
  REINHARD: {
    style: 'REINHARD',
    name: 'Reinhard von Lohengramm',
    nameKo: '라인하르트 스타일',
    description: '선제공격과 집중화력으로 적을 압도하는 공세적 전술',
    openingAction: 'AGGRESSIVE',
    midgameAction: 'PRESS_ATTACK',
    desperateAction: 'CHARGE',
    focusFireChance: 80,
    flankingChance: 60,
    retreatThreshold: 20,
    counterattackChance: 70,
    defaultEnergyBias: 'ATTACK',
    preferredFormations: ['ASSAULT', 'WEDGE', 'OFFENSIVE'],
  },
  YANG_WENLI: {
    style: 'YANG_WENLI',
    name: 'Yang Wen-li',
    nameKo: '양 웬리 스타일',
    description: '적의 실수를 유도하고 후퇴 후 반격하는 방어적/기동적 전술',
    openingAction: 'OBSERVE',
    midgameAction: 'ADAPT',
    desperateAction: 'GUERRILLA',
    focusFireChance: 90,        // 집중 사격 시 매우 정확
    flankingChance: 75,
    retreatThreshold: 40,       // 여유있게 퇴각 판단
    counterattackChance: 95,    // 반격의 달인
    defaultEnergyBias: 'BALANCED',
    preferredFormations: ['DEFENSIVE', 'CIRCLE', 'CRESCENT'],
  },
  MITTERMEYER: {
    style: 'MITTERMEYER',
    name: 'Wolfgang Mittermeyer',
    nameKo: '미터마이어 스타일',
    description: '고속 기동으로 측면을 공략하고 분산 후 집중하는 전술',
    openingAction: 'MANEUVER',
    midgameAction: 'FLANKING',
    desperateAction: 'RETREAT',
    focusFireChance: 60,
    flankingChance: 90,         // 측면 공격 전문
    retreatThreshold: 30,
    counterattackChance: 65,
    defaultEnergyBias: 'MOBILITY',
    preferredFormations: ['WEDGE', 'LINE', 'ECHELON'],
  },
  REUENTHAL: {
    style: 'REUENTHAL',
    name: 'Oskar von Reuenthal',
    nameKo: '로이엔탈 스타일',
    description: '상황에 따라 정면 돌파와 우회를 병행하는 균형잡힌 전술',
    openingAction: 'AGGRESSIVE',
    midgameAction: 'ADAPT',
    desperateAction: 'CHARGE',
    focusFireChance: 70,
    flankingChance: 50,
    retreatThreshold: 25,
    counterattackChance: 75,
    defaultEnergyBias: 'BALANCED',
    preferredFormations: ['LINE', 'ASSAULT', 'DEFENSIVE'],
  },
  BITTENFELD: {
    style: 'BITTENFELD',
    name: 'Fritz Joseph Bittenfeld',
    nameKo: '비텐펠트 스타일',
    description: '망설임 없는 돌격으로 적을 분쇄하는 극공격적 전술',
    openingAction: 'AGGRESSIVE',
    midgameAction: 'PRESS_ATTACK',
    desperateAction: 'CHARGE',
    focusFireChance: 50,        // 집중보다 전면 공격
    flankingChance: 20,         // 우회보다 정면 돌파
    retreatThreshold: 0,        // 절대 퇴각하지 않음
    counterattackChance: 30,    // 반격보다 선공
    defaultEnergyBias: 'ATTACK',
    preferredFormations: ['ASSAULT', 'OFFENSIVE', 'WEDGE'],
  },
  MERKATZ: {
    style: 'MERKATZ',
    name: 'Willibald Joachim von Merkatz',
    nameKo: '메르카츠 스타일',
    description: '노련한 경험을 바탕으로 한 견고한 방어 중심 전술',
    openingAction: 'DEFENSIVE',
    midgameAction: 'HOLD_LINE',
    desperateAction: 'LAST_STAND',
    focusFireChance: 65,
    flankingChance: 30,
    retreatThreshold: 35,
    counterattackChance: 80,    // 수비 후 반격
    defaultEnergyBias: 'DEFENSE',
    preferredFormations: ['DEFENSIVE', 'CIRCLE', 'LINE'],
  },
  FAHRENHEIT: {
    style: 'FAHRENHEIT',
    name: 'Adalbert von Fahrenheit',
    nameKo: '파렌하이트 스타일',
    description: '충성스러운 돌격 정신으로 후퇴 없이 싸우는 전술',
    openingAction: 'AGGRESSIVE',
    midgameAction: 'PRESS_ATTACK',
    desperateAction: 'LAST_STAND',
    focusFireChance: 55,
    flankingChance: 35,
    retreatThreshold: 0,        // 후퇴 거부
    counterattackChance: 50,
    defaultEnergyBias: 'ATTACK',
    preferredFormations: ['ASSAULT', 'LINE', 'OFFENSIVE'],
  },
  DEFAULT: {
    style: 'DEFAULT',
    name: 'Standard AI',
    nameKo: '기본 AI',
    description: '균형잡힌 표준 전술',
    openingAction: 'OBSERVE',
    midgameAction: 'ADAPT',
    desperateAction: 'RETREAT',
    focusFireChance: 50,
    flankingChance: 40,
    retreatThreshold: 30,
    counterattackChance: 50,
    defaultEnergyBias: 'BALANCED',
    preferredFormations: ['LINE', 'DEFENSIVE', 'CIRCLE'],
  },
};




