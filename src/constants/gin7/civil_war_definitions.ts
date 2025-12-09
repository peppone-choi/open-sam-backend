/**
 * civil_war_definitions.ts - 내전 시스템 상수 정의
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 내전 트리거, 진영 정당성, 종결 조건 등 정의
 */

/**
 * 내전 트리거 타입
 */
export enum CivilWarTriggerType {
  COUP = 'COUP', // 쿠데타 (수도 장악)
  SECESSION = 'SECESSION', // 분리독립 (행성/성계 이탈)
  REBELLION = 'REBELLION', // 귀족반란 (봉토 기반 봉기)
  SUCCESSION = 'SUCCESSION', // 계승 분쟁 (황위/의장직)
}

/**
 * 내전 상태
 */
export enum CivilWarStatus {
  PREPARING = 'PREPARING', // 준비 중 (아직 전투 미발생)
  ACTIVE = 'ACTIVE', // 진행 중 (전투 발생)
  CEASEFIRE = 'CEASEFIRE', // 휴전 중
  RESOLVED = 'RESOLVED', // 종결됨
}

/**
 * 내전 종결 유형
 */
export enum CivilWarResolution {
  TOTAL_VICTORY = 'TOTAL_VICTORY', // 완전 승리 (적 진영 소멸)
  NEGOTIATED = 'NEGOTIATED', // 협상 종결 (영토 분할 등)
  CEASEFIRE_PERMANENT = 'CEASEFIRE_PERMANENT', // 영구 휴전
  ABSORPTION = 'ABSORPTION', // 흡수 합병
  EXTERNAL_INTERVENTION = 'EXTERNAL_INTERVENTION', // 외부 개입으로 종결
}

/**
 * 내전 세력 식별자
 */
export enum CivilWarFactionIdentifier {
  INCUMBENT = 'INCUMBENT', // 현 정부 세력
  INSURGENT = 'INSURGENT', // 반란 세력
  THIRD_PARTY = 'THIRD_PARTY', // 제3세력
  NEUTRAL = 'NEUTRAL', // 중립 세력
}

/**
 * 진영 정당성 주장 타입
 */
export enum LegitimacyClaim {
  LEGAL_GOVERNMENT = 'LEGAL_GOVERNMENT', // 법적 정부 (정통성)
  MILITARY_POWER = 'MILITARY_POWER', // 군사력 우위 (de facto)
  POPULAR_MANDATE = 'POPULAR_MANDATE', // 민중의 지지
  ROYAL_BLOOD = 'ROYAL_BLOOD', // 황위 계승권 (제국 전용)
  REVOLUTIONARY = 'REVOLUTIONARY', // 혁명적 정당성
  RESTORATION = 'RESTORATION', // 구체제 복고
  AUTONOMY = 'AUTONOMY', // 자치권/독립권
}

/**
 * 진영 관계 타입
 */
export enum FactionRelation {
  ALLIED = 'ALLIED', // 동맹
  HOSTILE = 'HOSTILE', // 적대
  NEUTRAL = 'NEUTRAL', // 중립/관망
  CEASEFIRE = 'CEASEFIRE', // 휴전 중
}

/**
 * 진영 역할 타입
 */
export enum FactionRole {
  INCUMBENT = 'INCUMBENT', // 기존 정권 (정부군)
  INSURGENT = 'INSURGENT', // 반란군/쿠데타군
  SECESSIONIST = 'SECESSIONIST', // 분리독립파
  THIRD_PARTY = 'THIRD_PARTY', // 제3세력
  NEUTRAL_OBSERVER = 'NEUTRAL_OBSERVER', // 중립 관망
}

/**
 * 정당성 점수 기본값
 */
export const LEGITIMACY_BASE_SCORES: Record<LegitimacyClaim, number> = {
  [LegitimacyClaim.LEGAL_GOVERNMENT]: 80, // 법적 정부 높은 정당성
  [LegitimacyClaim.ROYAL_BLOOD]: 70, // 계승권도 높음
  [LegitimacyClaim.POPULAR_MANDATE]: 60, // 민중 지지
  [LegitimacyClaim.RESTORATION]: 50, // 구체제 복고
  [LegitimacyClaim.AUTONOMY]: 40, // 자치권 요구
  [LegitimacyClaim.REVOLUTIONARY]: 30, // 혁명
  [LegitimacyClaim.MILITARY_POWER]: 20, // 군사력만으로는 낮음
};

/**
 * 내전 승리 조건 정의
 */
export interface VictoryCondition {
  type: 'CAPITAL_CAPTURE' | 'LEADER_ELIMINATION' | 'FORCE_DESTRUCTION' | 'SURRENDER';
  description: string;
  threshold?: number; // FORCE_DESTRUCTION 시 궤멸 비율 (0-100)
}

export const DEFAULT_VICTORY_CONDITIONS: VictoryCondition[] = [
  {
    type: 'CAPITAL_CAPTURE',
    description: '적 진영의 수도/본거지 점령',
  },
  {
    type: 'LEADER_ELIMINATION',
    description: '적 지도자 포획, 사망, 또는 항복',
  },
  {
    type: 'FORCE_DESTRUCTION',
    description: '적 진영 전력 90% 이상 궤멸',
    threshold: 90,
  },
  {
    type: 'SURRENDER',
    description: '적 진영의 무조건 항복',
  },
];

/**
 * 트리거별 기본 설정
 */
export interface TriggerConfig {
  type: CivilWarTriggerType;
  name: string;
  description: string;
  minParticipants: number; // 최소 참여 인원
  cpCostToInitiate: number; // 발동 CP 비용
  defaultInsurgentClaim: LegitimacyClaim; // 반란측 기본 정당성
  defaultIncumbentClaim: LegitimacyClaim; // 정부측 기본 정당성
}

export const TRIGGER_CONFIGS: Record<CivilWarTriggerType, TriggerConfig> = {
  [CivilWarTriggerType.COUP]: {
    type: CivilWarTriggerType.COUP,
    name: '쿠데타',
    description: '수도를 장악하여 정권을 전복하는 행위',
    minParticipants: 3,
    cpCostToInitiate: 640,
    defaultInsurgentClaim: LegitimacyClaim.MILITARY_POWER,
    defaultIncumbentClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
  },
  [CivilWarTriggerType.SECESSION]: {
    type: CivilWarTriggerType.SECESSION,
    name: '분리독립',
    description: '세력에서 탈퇴하여 독립 세력을 수립하는 행위',
    minParticipants: 1,
    cpCostToInitiate: 320,
    defaultInsurgentClaim: LegitimacyClaim.AUTONOMY,
    defaultIncumbentClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
  },
  [CivilWarTriggerType.REBELLION]: {
    type: CivilWarTriggerType.REBELLION,
    name: '귀족반란',
    description: '봉토와 사병을 기반으로 중앙 정부에 대항하는 행위',
    minParticipants: 2,
    cpCostToInitiate: 640,
    defaultInsurgentClaim: LegitimacyClaim.RESTORATION,
    defaultIncumbentClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
  },
  [CivilWarTriggerType.SUCCESSION]: {
    type: CivilWarTriggerType.SUCCESSION,
    name: '계승분쟁',
    description: '황위 또는 최고 지도자 지위를 두고 벌이는 분쟁',
    minParticipants: 2,
    cpCostToInitiate: 480,
    defaultInsurgentClaim: LegitimacyClaim.ROYAL_BLOOD,
    defaultIncumbentClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
  },
};

/**
 * 내전 공적 보너스 계수
 */
export const CIVIL_WAR_MERIT_MULTIPLIER = {
  ENEMY_SHIP_DESTROYED: 1.5, // 내전 중 적 격침 보너스 50% 증가
  PLANET_CAPTURED: 2.0, // 행성 점령 보너스 100% 증가
  LEADER_CAPTURED: 500, // 적 지도자 포획 시 고정 보너스
  VICTORY_BONUS: 1000, // 최종 승리 시 고정 보너스
};

/**
 * 유틸리티 함수들
 */
export const getTriggerConfig = (type: CivilWarTriggerType): TriggerConfig => {
  return TRIGGER_CONFIGS[type];
};

export const getBaseLegitimacyScore = (claim: LegitimacyClaim): number => {
  return LEGITIMACY_BASE_SCORES[claim];
};

/**
 * 정당성 점수 계산 (보너스 포함)
 */
export const calculateLegitimacy = (
  baseClaim: LegitimacyClaim,
  bonuses: {
    popularSupport?: number; // 0-100
    militaryStrength?: number; // 0-100
    territoryControl?: number; // 0-100
    internationalRecognition?: number; // 0-100
  },
): number => {
  const base = LEGITIMACY_BASE_SCORES[baseClaim];

  const supportBonus = (bonuses.popularSupport || 0) * 0.2;
  const militaryBonus = (bonuses.militaryStrength || 0) * 0.15;
  const territoryBonus = (bonuses.territoryControl || 0) * 0.1;
  const recognitionBonus = (bonuses.internationalRecognition || 0) * 0.05;

  return Math.min(100, base + supportBonus + militaryBonus + territoryBonus + recognitionBonus);
};





