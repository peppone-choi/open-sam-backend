/**
 * 쿠데타/반란 시스템 타입 정의
 * 
 * 은하영웅전설에서 쿠데타는 핵심적인 정치 이벤트:
 * - 립슈타트 전역 (귀족 반란)
 * - 구국군사회의 쿠데타 (동맹)
 * - 페잔 자치령 내부 쿠데타 등
 */

/**
 * 쿠데타 타입
 */
export type CoupType = 
  | 'military'        // 군사 쿠데타 (구국군사회의)
  | 'noble_revolt'    // 귀족 반란 (립슈타트)
  | 'palace_coup'     // 궁정 쿠데타
  | 'popular_uprising' // 민중 봉기
  | 'secession';      // 독립 선언

/**
 * 쿠데타 상태
 */
export type CoupStatus = 
  | 'planning'        // 계획 중
  | 'mobilizing'      // 병력 동원 중
  | 'executing'       // 실행 중
  | 'success'         // 성공
  | 'failed'          // 실패
  | 'suppressed';     // 진압됨

/**
 * 쿠데타 세력 정보
 */
export interface CoupFaction {
  leaderId: string;
  leaderName: string;
  supporterIds: string[];     // 지지자 캐릭터 ID들
  controlledFleetIds: string[];  // 장악한 함대들
  controlledTerritoryIds: string[]; // 장악한 영토들
  militaryStrength: number;   // 총 군사력
  politicalSupport: number;   // 정치적 지지율 (0-100)
  publicSupport: number;      // 여론/민심 (0-100)
}

/**
 * 쿠데타 가능 여부 판정 결과
 */
export interface CoupFeasibility {
  canAttempt: boolean;
  overallChance: number;      // 전체 성공 확률 (0-100)
  
  // 세부 조건 분석
  conditions: {
    // 군사력 조건
    military: {
      met: boolean;
      currentStrength: number;
      requiredStrength: number;
      score: number;          // 0-100
    };
    // 수도 장악 가능성
    capitalControl: {
      met: boolean;
      nearbyForces: number;
      governmentForces: number;
      score: number;
    };
    // 정치적 지지
    politicalSupport: {
      met: boolean;
      supportRate: number;
      requiredRate: number;
      score: number;
    };
    // 여론/민심
    publicOpinion: {
      met: boolean;
      favorability: number;
      governmentApproval: number;
      score: number;
    };
    // 외세 개입 가능성
    foreignIntervention: {
      riskLevel: 'low' | 'medium' | 'high' | 'certain';
      potentialIntervenors: string[];  // 개입 가능 세력 ID
      score: number;  // 점수가 낮을수록 유리
    };
  };
  
  // 실패 시 예상 결과
  failureConsequences: {
    leaderPunishment: 'execution' | 'imprisonment' | 'exile';
    supporterPunishment: 'execution' | 'imprisonment' | 'exile' | 'demotion';
    estimatedCasualties: number;
  };
  
  // 권고 사항
  recommendations: string[];
}

/**
 * 쿠데타 실행 요청
 */
export interface ExecuteCoupParams {
  sessionId: string;
  leaderId: string;
  targetGovernmentId: string;
  targetFactionId: string;
  coupType: CoupType;
  
  // 참여 세력
  conspirators: string[];      // 공모자 캐릭터 ID
  fleetIds: string[];          // 동원 함대 ID
  
  // 선택 옵션
  options?: {
    targetCapital?: boolean;   // 수도 점령 시도
    arrestTarget?: string;     // 체포 대상 (현 지도자)
    declareManifesto?: string; // 선언문 (성공 시 효과에 영향)
  };
}

/**
 * 쿠데타 결과
 */
export interface CoupResult {
  success: boolean;
  coupId: string;
  
  // 결과 상세
  outcome: {
    newGovernmentId?: string;  // 성공 시 새 정부 ID
    newLeaderId?: string;      // 성공 시 새 지도자
    
    // 전투 결과
    battleResults?: {
      coupCasualties: number;
      governmentCasualties: number;
      civilianCasualties: number;
    };
    
    // 정치적 변화
    politicalChanges?: {
      governmentTypeChange?: string;
      factionSplit?: boolean;
      newFactionId?: string;
    };
  };
  
  // 처벌/보상
  consequences: {
    // 쿠데타 세력
    coupLeader: {
      characterId: string;
      fate: 'new_leader' | 'executed' | 'imprisoned' | 'exiled' | 'fled';
    };
    coupParticipants: Array<{
      characterId: string;
      fate: 'promoted' | 'executed' | 'imprisoned' | 'exiled' | 'pardoned';
    }>;
    
    // 기존 정부 세력
    previousLeader?: {
      characterId: string;
      fate: 'executed' | 'imprisoned' | 'exiled' | 'fled' | 'retained';
    };
    loyalists?: Array<{
      characterId: string;
      fate: 'executed' | 'imprisoned' | 'exiled' | 'demoted' | 'retained';
    }>;
  };
  
  // 후속 효과
  aftermath: {
    stabilityPenalty: number;      // 안정성 감소
    publicOrderPenalty: number;    // 치안 감소
    economicDamage: number;        // 경제 피해
    diplomaticReputation: number;  // 외교적 평판 변화
    civilWarRisk: number;          // 내전 위험도 (0-100)
  };
  
  // 트리거된 이벤트
  triggeredEvents?: string[];
}

/**
 * 쿠데타 진압 요청
 */
export interface SuppressCoupParams {
  sessionId: string;
  coupId: string;
  governmentLeaderId: string;
  
  // 진압 세력
  loyalistFleetIds: string[];
  loyalistCharacterIds: string[];
  
  // 진압 옵션
  options?: {
    useForce: boolean;          // 무력 진압
    negotiateTerms?: boolean;   // 협상 시도
    offerAmnesty?: boolean;     // 사면 제안
    foreignAid?: string;        // 외세 개입 요청 (세력 ID)
  };
}

/**
 * 진압 결과
 */
export interface SuppressionResult {
  success: boolean;
  outcome: 'suppressed' | 'negotiated' | 'failed' | 'stalemate';
  
  // 결과 상세
  casualties: {
    governmentForces: number;
    coupForces: number;
    civilians: number;
  };
  
  // 처리 결과
  coupLeaderFate: 'executed' | 'imprisoned' | 'exiled' | 'escaped' | 'pardoned';
  participantFates: Array<{
    characterId: string;
    fate: 'executed' | 'imprisoned' | 'exiled' | 'pardoned';
  }>;
  
  // 후속 효과
  aftermath: {
    governmentStabilityChange: number;
    publicOrderChange: number;
    loyalistRewards?: Array<{
      characterId: string;
      reward: 'promotion' | 'title' | 'wealth' | 'territory';
    }>;
  };
}

/**
 * 정권 교체 요청
 */
export interface RegimeChangeParams {
  sessionId: string;
  factionId: string;
  newLeaderId: string;
  
  // 새 정부 설정
  newGovernmentType?: 'empire' | 'alliance' | 'republic' | 'kingdom';
  newGovernmentName?: string;
  
  // 인사 변경
  newCabinet?: Array<{
    positionId: string;
    characterId: string;
  }>;
  
  // 정책 선언
  initialDecrees?: Array<{
    type: string;
    title: string;
    content: string;
  }>;
}

/**
 * 쿠데타 문서 (MongoDB 저장용)
 */
export interface CoupDocument {
  coupId: string;
  sessionId: string;
  
  // 기본 정보
  coupType: CoupType;
  status: CoupStatus;
  
  // 관련 세력
  targetFactionId: string;
  targetGovernmentId: string;
  coupFaction: CoupFaction;
  
  // 타임라인
  plannedAt: Date;
  executedAt?: Date;
  resolvedAt?: Date;
  
  // 결과
  result?: CoupResult;
  
  // 시나리오 연동
  triggeredByEventId?: string;  // 시나리오 이벤트로 트리거된 경우
  scenarioFlags?: string[];     // 설정할 시나리오 플래그
  
  // 기타 데이터
  data?: Record<string, unknown>;
}

/**
 * 쿠데타 관련 시나리오 이벤트 (립슈타트, 구국군사회의 등)
 */
export interface CoupScenarioEvent {
  eventId: string;
  name: string;
  description: string;
  
  // 트리거 조건
  triggerConditions: {
    governmentApprovalBelow?: number;   // 정부 지지율 이하
    nobilityDiscontentAbove?: number;   // 귀족 불만 이상
    militaryDiscontentAbove?: number;   // 군부 불만 이상
    economicCrisis?: boolean;            // 경제 위기
    warWeariness?: number;               // 전쟁 피로도
    specificCharacterRequired?: string[]; // 필요 캐릭터
    turnRange?: { min: number; max: number };
  };
  
  // 자동 발생 vs 선택
  automatic: boolean;
  
  // 이벤트 결과
  onTriggered: {
    startCoup: boolean;
    coupType: CoupType;
    coupLeaderId: string;
    coupSupporterIds: string[];
    dialogue?: string;
  };
}










