/**
 * OccupationExtensionService - 점령 처리 확장 시스템
 * Agent F: 외교/경제 시스템 확장
 *
 * FezzanOccupationService를 확장하여 일반 점령 시스템 구현
 *
 * 기능:
 * - 점령 단계 (군정/민정/통합)
 * - 저항 운동 대응
 * - 점령 비용 계산
 * - 편입 처리
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum OccupationPhase {
  MILITARY_CONTROL = 'MILITARY_CONTROL',     // 군정 (초기)
  TRANSITIONAL = 'TRANSITIONAL',             // 과도기
  CIVIL_ADMINISTRATION = 'CIVIL_ADMINISTRATION', // 민정
  INTEGRATION = 'INTEGRATION',               // 통합
  FULLY_INTEGRATED = 'FULLY_INTEGRATED',     // 완전 편입
}

export enum ResistanceType {
  PASSIVE = 'PASSIVE',           // 소극적 저항 (비협조)
  CIVIL = 'CIVIL',               // 시민 불복종
  SABOTAGE = 'SABOTAGE',         // 사보타주
  GUERRILLA = 'GUERRILLA',       // 게릴라전
  ARMED_UPRISING = 'ARMED_UPRISING', // 무장 봉기
  ORGANIZED_REBELLION = 'ORGANIZED_REBELLION', // 조직적 반란
}

export enum OccupationPolicy {
  OPPRESSIVE = 'OPPRESSIVE',     // 억압적
  MODERATE = 'MODERATE',         // 온건
  LENIENT = 'LENIENT',           // 관대
  COLLABORATIVE = 'COLLABORATIVE', // 협력적
}

export interface OccupiedTerritory {
  territoryId: string;
  sessionId: string;
  planetId: string;
  planetName: string;
  originalFaction: string;       // 원래 소속
  occupyingFaction: string;      // 점령 세력
  occupiedAt: Date;

  // 점령 상태
  phase: OccupationPhase;
  phaseProgress: number;         // 현재 단계 진행률 (0-100)
  policy: OccupationPolicy;

  // 저항
  resistanceLevel: number;       // 저항 수준 (0-100)
  activeResistanceType: ResistanceType;
  resistanceOrganization?: ResistanceOrganization;

  // 통치
  governorId?: string;           // 총독/군정장관
  garrisonStrength: number;      // 주둔군 병력
  securityLevel: number;         // 치안 수준 (0-100)

  // 경제
  economicOutput: number;        // 경제 산출 (% of normal)
  taxCollection: number;         // 세수 (% of normal)
  infrastructureDamage: number;  // 인프라 피해 (0-100)

  // 민심
  publicOpinion: number;         // 여론 (0-100, 50 = 중립)
  collaboratorRate: number;      // 협력자 비율 (%)

  // 비용
  occupationCost: number;        // 점령 유지 비용 (월)
  totalExpenditure: number;      // 누적 지출

  lastUpdated: Date;
}

export interface ResistanceOrganization {
  organizationId: string;
  name: string;
  leaderId?: string;
  strength: number;              // 조직 규모
  morale: number;                // 사기 (0-100)
  supplies: number;              // 보급 수준 (0-100)
  externalSupport: string[];     // 외부 지원 세력
  operations: ResistanceOperation[];
}

export interface ResistanceOperation {
  operationId: string;
  type: ResistanceType;
  target: string;
  plannedAt: Date;
  executedAt?: Date;
  success: boolean;
  casualties: number;
  damageInflicted: number;
  captured: number;              // 체포된 인원
}

export interface OccupationIncident {
  incidentId: string;
  sessionId: string;
  territoryId: string;
  type: 'RESISTANCE_ATTACK' | 'RIOT' | 'SABOTAGE' | 'UPRISING' | 
        'ASSASSINATION' | 'MASS_PROTEST' | 'GENERAL_STRIKE';
  severity: number;              // 심각도 (1-10)
  casualties: {
    occupier: number;
    resistance: number;
    civilian: number;
  };
  economicDamage: number;
  description: string;
  occurredAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface IntegrationRequirements {
  minPhaseProgress: number;      // 최소 진행률
  minPublicOpinion: number;      // 최소 여론
  maxResistanceLevel: number;    // 최대 저항 수준
  minSecurityLevel: number;      // 최소 치안
  requiredDuration: number;      // 필요 기간 (일)
}

export interface OccupationAction {
  actionId: string;
  type: 'SECURITY_SWEEP' | 'PUBLIC_WORKS' | 'PROPAGANDA' | 'CONCESSION' |
        'CURFEW' | 'MARTIAL_LAW' | 'AMNESTY' | 'FOOD_AID' | 'PURGE';
  cost: number;
  duration: number;              // 소요 시간 (일)
  effects: {
    resistanceLevel?: number;
    publicOpinion?: number;
    securityLevel?: number;
    economicOutput?: number;
  };
  sideEffects?: string[];
}

// ============================================================
// Constants
// ============================================================

const PHASE_REQUIREMENTS: Record<OccupationPhase, IntegrationRequirements> = {
  [OccupationPhase.MILITARY_CONTROL]: {
    minPhaseProgress: 0,
    minPublicOpinion: 0,
    maxResistanceLevel: 100,
    minSecurityLevel: 0,
    requiredDuration: 0,
  },
  [OccupationPhase.TRANSITIONAL]: {
    minPhaseProgress: 100,
    minPublicOpinion: 30,
    maxResistanceLevel: 60,
    minSecurityLevel: 40,
    requiredDuration: 30,
  },
  [OccupationPhase.CIVIL_ADMINISTRATION]: {
    minPhaseProgress: 100,
    minPublicOpinion: 45,
    maxResistanceLevel: 40,
    minSecurityLevel: 55,
    requiredDuration: 60,
  },
  [OccupationPhase.INTEGRATION]: {
    minPhaseProgress: 100,
    minPublicOpinion: 55,
    maxResistanceLevel: 25,
    minSecurityLevel: 65,
    requiredDuration: 90,
  },
  [OccupationPhase.FULLY_INTEGRATED]: {
    minPhaseProgress: 100,
    minPublicOpinion: 65,
    maxResistanceLevel: 10,
    minSecurityLevel: 75,
    requiredDuration: 120,
  },
};

const BASE_OCCUPATION_COST = 10000; // 기본 점령 비용

const POLICY_EFFECTS: Record<OccupationPolicy, {
  resistanceModifier: number;
  publicOpinionModifier: number;
  economicModifier: number;
  costModifier: number;
}> = {
  [OccupationPolicy.OPPRESSIVE]: {
    resistanceModifier: 1.5,
    publicOpinionModifier: -10,
    economicModifier: 0.6,
    costModifier: 1.3,
  },
  [OccupationPolicy.MODERATE]: {
    resistanceModifier: 1.0,
    publicOpinionModifier: 0,
    economicModifier: 0.8,
    costModifier: 1.0,
  },
  [OccupationPolicy.LENIENT]: {
    resistanceModifier: 0.7,
    publicOpinionModifier: 5,
    economicModifier: 0.9,
    costModifier: 0.9,
  },
  [OccupationPolicy.COLLABORATIVE]: {
    resistanceModifier: 0.5,
    publicOpinionModifier: 10,
    economicModifier: 1.0,
    costModifier: 1.1,
  },
};

const AVAILABLE_ACTIONS: OccupationAction[] = [
  {
    actionId: 'security_sweep',
    type: 'SECURITY_SWEEP',
    cost: 5000,
    duration: 7,
    effects: {
      resistanceLevel: -15,
      securityLevel: 10,
    },
    sideEffects: ['여론 악화 가능', '민간인 피해 위험'],
  },
  {
    actionId: 'public_works',
    type: 'PUBLIC_WORKS',
    cost: 20000,
    duration: 30,
    effects: {
      publicOpinion: 15,
      economicOutput: 10,
    },
  },
  {
    actionId: 'propaganda',
    type: 'PROPAGANDA',
    cost: 3000,
    duration: 14,
    effects: {
      publicOpinion: 8,
      resistanceLevel: -5,
    },
  },
  {
    actionId: 'concession',
    type: 'CONCESSION',
    cost: 10000,
    duration: 1,
    effects: {
      publicOpinion: 20,
      resistanceLevel: -20,
      economicOutput: -5,
    },
    sideEffects: ['협력자 비율 증가'],
  },
  {
    actionId: 'curfew',
    type: 'CURFEW',
    cost: 2000,
    duration: 14,
    effects: {
      securityLevel: 15,
      resistanceLevel: -10,
      economicOutput: -15,
    },
    sideEffects: ['여론 악화'],
  },
  {
    actionId: 'martial_law',
    type: 'MARTIAL_LAW',
    cost: 8000,
    duration: 30,
    effects: {
      securityLevel: 25,
      resistanceLevel: -25,
      publicOpinion: -20,
      economicOutput: -30,
    },
    sideEffects: ['국제 비난', '장기 여론 악화'],
  },
  {
    actionId: 'amnesty',
    type: 'AMNESTY',
    cost: 5000,
    duration: 1,
    effects: {
      resistanceLevel: -30,
      publicOpinion: 15,
      securityLevel: -10,
    },
    sideEffects: ['저항 조직 일부 해체'],
  },
  {
    actionId: 'food_aid',
    type: 'FOOD_AID',
    cost: 15000,
    duration: 7,
    effects: {
      publicOpinion: 25,
      resistanceLevel: -10,
    },
  },
  {
    actionId: 'purge',
    type: 'PURGE',
    cost: 10000,
    duration: 14,
    effects: {
      resistanceLevel: -40,
      securityLevel: 20,
      publicOpinion: -30,
    },
    sideEffects: ['국제 비난', '영구적 여론 손상', '보복 위험'],
  },
];

// ============================================================
// OccupationExtensionService Class
// ============================================================

export class OccupationExtensionService extends EventEmitter {
  private static instance: OccupationExtensionService;

  // 세션별 데이터
  private occupiedTerritories: Map<string, OccupiedTerritory[]> = new Map();
  private incidents: Map<string, OccupationIncident[]> = new Map();
  private pendingActions: Map<string, Map<string, OccupationAction[]>> = new Map();

  private constructor() {
    super();
    logger.info('[OccupationExtensionService] Initialized');
  }

  public static getInstance(): OccupationExtensionService {
    if (!OccupationExtensionService.instance) {
      OccupationExtensionService.instance = new OccupationExtensionService();
    }
    return OccupationExtensionService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.occupiedTerritories.set(sessionId, []);
    this.incidents.set(sessionId, []);
    this.pendingActions.set(sessionId, new Map());
    logger.info(`[OccupationExtensionService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.occupiedTerritories.delete(sessionId);
    this.incidents.delete(sessionId);
    this.pendingActions.delete(sessionId);
    logger.info(`[OccupationExtensionService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 점령 시작
  // ============================================================

  /**
   * 영토 점령 시작
   */
  public occupyTerritory(
    sessionId: string,
    planetId: string,
    planetName: string,
    originalFaction: string,
    occupyingFaction: string,
    initialGarrison: number,
    governorId?: string,
  ): { success: boolean; territory?: OccupiedTerritory; error?: string } {
    // 이미 점령 중인지 확인
    const territories = this.occupiedTerritories.get(sessionId) || [];
    const existing = territories.find(t => t.planetId === planetId);

    if (existing) {
      return { success: false, error: '이미 점령된 영토입니다.' };
    }

    // 초기 저항 수준 계산 (원래 세력과의 관계에 따라)
    const initialResistance = this.calculateInitialResistance(
      originalFaction,
      occupyingFaction,
    );

    const territory: OccupiedTerritory = {
      territoryId: `OCC-${uuidv4().slice(0, 8)}`,
      sessionId,
      planetId,
      planetName,
      originalFaction,
      occupyingFaction,
      occupiedAt: new Date(),

      phase: OccupationPhase.MILITARY_CONTROL,
      phaseProgress: 0,
      policy: OccupationPolicy.MODERATE,

      resistanceLevel: initialResistance,
      activeResistanceType: initialResistance > 50 
        ? ResistanceType.GUERRILLA 
        : ResistanceType.PASSIVE,

      governorId,
      garrisonStrength: initialGarrison,
      securityLevel: Math.min(70, initialGarrison / 10),

      economicOutput: 30, // 초기 30%
      taxCollection: 20,  // 초기 20%
      infrastructureDamage: Math.floor(Math.random() * 30), // 전투 피해

      publicOpinion: Math.max(10, 50 - initialResistance),
      collaboratorRate: 5,

      occupationCost: this.calculateOccupationCost(initialGarrison, initialResistance),
      totalExpenditure: 0,

      lastUpdated: new Date(),
    };

    territories.push(territory);
    this.occupiedTerritories.set(sessionId, territories);

    // 저항 조직 생성 (저항 수준이 높을 경우)
    if (initialResistance > 40) {
      territory.resistanceOrganization = this.createResistanceOrganization(
        territory,
        initialResistance,
      );
    }

    this.emit('occupation:started', { sessionId, territory });
    logger.info(`[OccupationExtensionService] Territory occupied: ${planetName} by ${occupyingFaction}`);

    return { success: true, territory };
  }

  private calculateInitialResistance(
    originalFaction: string,
    occupyingFaction: string,
  ): number {
    // 세력 간 관계에 따른 초기 저항
    if ((originalFaction === 'empire' && occupyingFaction === 'alliance') ||
        (originalFaction === 'alliance' && occupyingFaction === 'empire')) {
      return 60 + Math.floor(Math.random() * 20); // 60-80
    }
    return 30 + Math.floor(Math.random() * 30); // 30-60
  }

  private createResistanceOrganization(
    territory: OccupiedTerritory,
    initialResistance: number,
  ): ResistanceOrganization {
    return {
      organizationId: `RESIST-${uuidv4().slice(0, 8)}`,
      name: `${territory.planetName} 해방군`,
      strength: Math.floor(initialResistance * 10),
      morale: initialResistance,
      supplies: 50,
      externalSupport: [territory.originalFaction],
      operations: [],
    };
  }

  // ============================================================
  // 점령 단계 관리
  // ============================================================

  /**
   * 다음 단계로 진행 가능 여부 확인
   */
  public canAdvancePhase(
    territory: OccupiedTerritory,
  ): { canAdvance: boolean; requirements: string[] } {
    const nextPhase = this.getNextPhase(territory.phase);
    if (!nextPhase) {
      return { canAdvance: false, requirements: ['이미 최종 단계입니다.'] };
    }

    const requirements = PHASE_REQUIREMENTS[nextPhase];
    const unmetRequirements: string[] = [];

    if (territory.phaseProgress < requirements.minPhaseProgress) {
      unmetRequirements.push(`진행률 부족: ${territory.phaseProgress}% / ${requirements.minPhaseProgress}%`);
    }
    if (territory.publicOpinion < requirements.minPublicOpinion) {
      unmetRequirements.push(`여론 부족: ${territory.publicOpinion} / ${requirements.minPublicOpinion}`);
    }
    if (territory.resistanceLevel > requirements.maxResistanceLevel) {
      unmetRequirements.push(`저항 수준 초과: ${territory.resistanceLevel} / ${requirements.maxResistanceLevel}`);
    }
    if (territory.securityLevel < requirements.minSecurityLevel) {
      unmetRequirements.push(`치안 부족: ${territory.securityLevel} / ${requirements.minSecurityLevel}`);
    }

    return {
      canAdvance: unmetRequirements.length === 0,
      requirements: unmetRequirements,
    };
  }

  /**
   * 다음 단계로 진행
   */
  public advancePhase(
    sessionId: string,
    territoryId: string,
  ): { success: boolean; territory?: OccupiedTerritory; error?: string } {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) {
      return { success: false, error: '점령지를 찾을 수 없습니다.' };
    }

    const { canAdvance, requirements } = this.canAdvancePhase(territory);
    if (!canAdvance) {
      return { success: false, error: `진행 불가: ${requirements.join(', ')}` };
    }

    const nextPhase = this.getNextPhase(territory.phase)!;
    territory.phase = nextPhase;
    territory.phaseProgress = 0;
    territory.lastUpdated = new Date();

    // 단계별 보너스
    switch (nextPhase) {
      case OccupationPhase.TRANSITIONAL:
        territory.economicOutput = Math.min(100, territory.economicOutput + 20);
        territory.taxCollection = Math.min(100, territory.taxCollection + 15);
        break;
      case OccupationPhase.CIVIL_ADMINISTRATION:
        territory.economicOutput = Math.min(100, territory.economicOutput + 15);
        territory.taxCollection = Math.min(100, territory.taxCollection + 20);
        territory.occupationCost *= 0.8;
        break;
      case OccupationPhase.INTEGRATION:
        territory.economicOutput = Math.min(100, territory.economicOutput + 10);
        territory.taxCollection = Math.min(100, territory.taxCollection + 15);
        territory.occupationCost *= 0.7;
        break;
      case OccupationPhase.FULLY_INTEGRATED:
        territory.economicOutput = 100;
        territory.taxCollection = 95;
        territory.occupationCost *= 0.3;
        break;
    }

    this.emit('occupation:phaseAdvanced', { sessionId, territory, newPhase: nextPhase });
    logger.info(`[OccupationExtensionService] Phase advanced: ${territoryId} -> ${nextPhase}`);

    return { success: true, territory };
  }

  private getNextPhase(current: OccupationPhase): OccupationPhase | null {
    const phases = Object.values(OccupationPhase);
    const currentIndex = phases.indexOf(current);
    if (currentIndex >= phases.length - 1) return null;
    return phases[currentIndex + 1];
  }

  // ============================================================
  // 저항 운동 대응
  // ============================================================

  /**
   * 저항 활동 발생 (매 틱)
   */
  public processResistanceActivity(
    sessionId: string,
    territoryId: string,
  ): OccupationIncident | null {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) return null;

    // 저항 활동 발생 확률
    const baseChance = territory.resistanceLevel * 0.5;
    const securityModifier = (100 - territory.securityLevel) / 100;
    const policyModifier = POLICY_EFFECTS[territory.policy].resistanceModifier;

    const chance = baseChance * securityModifier * policyModifier;
    const roll = Math.random() * 100;

    if (roll >= chance) return null;

    // 활동 유형 결정
    const incidentType = this.determineIncidentType(territory);

    // 사건 생성
    const incident = this.createIncident(sessionId, territory, incidentType);

    // 영향 적용
    this.applyIncidentEffects(territory, incident);

    const incidents = this.incidents.get(sessionId) || [];
    incidents.push(incident);
    this.incidents.set(sessionId, incidents);

    this.emit('occupation:incident', { sessionId, territory, incident });
    logger.warn(`[OccupationExtensionService] Resistance incident: ${incident.type} in ${territory.planetName}`);

    return incident;
  }

  private determineIncidentType(
    territory: OccupiedTerritory,
  ): OccupationIncident['type'] {
    const types: Array<{ type: OccupationIncident['type']; threshold: number }> = [
      { type: 'SABOTAGE', threshold: 20 },
      { type: 'MASS_PROTEST', threshold: 35 },
      { type: 'RIOT', threshold: 50 },
      { type: 'RESISTANCE_ATTACK', threshold: 65 },
      { type: 'GENERAL_STRIKE', threshold: 75 },
      { type: 'ASSASSINATION', threshold: 85 },
      { type: 'UPRISING', threshold: 95 },
    ];

    const roll = Math.random() * 100;
    const resistanceAdjusted = roll - (territory.resistanceLevel - 50);

    for (const { type, threshold } of types) {
      if (resistanceAdjusted < threshold) return type;
    }

    return 'UPRISING';
  }

  private createIncident(
    sessionId: string,
    territory: OccupiedTerritory,
    type: OccupationIncident['type'],
  ): OccupationIncident {
    const severityMultiplier = territory.resistanceLevel / 50;
    const baseSeverity = {
      'SABOTAGE': 3,
      'MASS_PROTEST': 4,
      'RIOT': 5,
      'RESISTANCE_ATTACK': 6,
      'GENERAL_STRIKE': 5,
      'ASSASSINATION': 7,
      'UPRISING': 9,
    }[type];

    const severity = Math.min(10, Math.ceil(baseSeverity * severityMultiplier));

    // 피해 계산
    const casualties = {
      occupier: Math.floor(severity * Math.random() * 10),
      resistance: Math.floor(severity * Math.random() * 15),
      civilian: Math.floor(severity * Math.random() * 5),
    };

    const economicDamage = severity * 1000;

    return {
      incidentId: `INC-${uuidv4().slice(0, 8)}`,
      sessionId,
      territoryId: territory.territoryId,
      type,
      severity,
      casualties,
      economicDamage,
      description: this.getIncidentDescription(type, territory.planetName),
      occurredAt: new Date(),
      resolved: false,
    };
  }

  private getIncidentDescription(
    type: OccupationIncident['type'],
    planetName: string,
  ): string {
    const descriptions: Record<OccupationIncident['type'], string> = {
      'SABOTAGE': `${planetName}에서 인프라 사보타주 발생`,
      'MASS_PROTEST': `${planetName}에서 대규모 시위 발생`,
      'RIOT': `${planetName}에서 폭동 발생`,
      'RESISTANCE_ATTACK': `${planetName}에서 저항군의 공격 발생`,
      'GENERAL_STRIKE': `${planetName}에서 총파업 발생`,
      'ASSASSINATION': `${planetName}에서 암살 시도`,
      'UPRISING': `${planetName}에서 무장 봉기 발생`,
    };
    return descriptions[type];
  }

  private applyIncidentEffects(
    territory: OccupiedTerritory,
    incident: OccupationIncident,
  ): void {
    // 치안 감소
    territory.securityLevel = Math.max(0, territory.securityLevel - incident.severity * 2);

    // 경제 피해
    territory.economicOutput = Math.max(10, territory.economicOutput - incident.severity);
    territory.infrastructureDamage = Math.min(100, territory.infrastructureDamage + incident.severity * 2);

    // 진행률 감소
    territory.phaseProgress = Math.max(0, territory.phaseProgress - incident.severity * 3);

    // 여론 변화 (폭력적 대응 시 악화)
    if (incident.casualties.civilian > 0) {
      territory.publicOpinion = Math.max(0, territory.publicOpinion - incident.casualties.civilian);
    }

    territory.lastUpdated = new Date();
  }

  /**
   * 저항 수준 업데이트 (매 틱)
   */
  public updateResistance(sessionId: string): void {
    const territories = this.occupiedTerritories.get(sessionId) || [];

    for (const territory of territories) {
      if (territory.phase === OccupationPhase.FULLY_INTEGRATED) continue;

      const policyEffect = POLICY_EFFECTS[territory.policy];

      // 자연 변화
      let resistanceChange = 0;

      // 정책에 따른 변화
      resistanceChange += policyEffect.publicOpinionModifier < 0 ? 2 : -1;

      // 여론에 따른 변화
      if (territory.publicOpinion > 60) {
        resistanceChange -= 2;
      } else if (territory.publicOpinion < 30) {
        resistanceChange += 3;
      }

      // 치안에 따른 변화
      if (territory.securityLevel > 70) {
        resistanceChange -= 1;
      } else if (territory.securityLevel < 40) {
        resistanceChange += 2;
      }

      // 외부 지원 (저항 조직이 있는 경우)
      if (territory.resistanceOrganization?.externalSupport.length) {
        resistanceChange += 1;
      }

      territory.resistanceLevel = Math.max(0, Math.min(100,
        territory.resistanceLevel + resistanceChange
      ));

      // 저항 유형 업데이트
      territory.activeResistanceType = this.determineResistanceType(territory.resistanceLevel);

      territory.lastUpdated = new Date();
    }
  }

  private determineResistanceType(level: number): ResistanceType {
    if (level >= 80) return ResistanceType.ORGANIZED_REBELLION;
    if (level >= 60) return ResistanceType.ARMED_UPRISING;
    if (level >= 45) return ResistanceType.GUERRILLA;
    if (level >= 30) return ResistanceType.SABOTAGE;
    if (level >= 15) return ResistanceType.CIVIL;
    return ResistanceType.PASSIVE;
  }

  // ============================================================
  // 점령 비용 계산
  // ============================================================

  /**
   * 점령 비용 계산
   */
  public calculateOccupationCost(
    garrisonStrength: number,
    resistanceLevel: number,
    policy?: OccupationPolicy,
  ): number {
    const baseCost = BASE_OCCUPATION_COST;

    // 주둔군 비용
    const garrisonCost = garrisonStrength * 50;

    // 저항 대응 비용
    const resistanceCost = resistanceLevel * 100;

    // 정책 보정
    const policyModifier = policy
      ? POLICY_EFFECTS[policy].costModifier
      : 1.0;

    return Math.ceil((baseCost + garrisonCost + resistanceCost) * policyModifier);
  }

  /**
   * 월간 점령 비용 처리
   */
  public processMonthlyOccupationCosts(sessionId: string): {
    faction: string;
    territories: Array<{ territoryId: string; cost: number }>;
    totalCost: number;
  }[] {
    const territories = this.occupiedTerritories.get(sessionId) || [];
    const factionCosts: Map<string, Array<{ territoryId: string; cost: number }>> = new Map();

    for (const territory of territories) {
      // 비용 재계산
      territory.occupationCost = this.calculateOccupationCost(
        territory.garrisonStrength,
        territory.resistanceLevel,
        territory.policy,
      );

      territory.totalExpenditure += territory.occupationCost;

      // 세력별 집계
      const costs = factionCosts.get(territory.occupyingFaction) || [];
      costs.push({
        territoryId: territory.territoryId,
        cost: territory.occupationCost,
      });
      factionCosts.set(territory.occupyingFaction, costs);

      territory.lastUpdated = new Date();
    }

    const result: ReturnType<typeof this.processMonthlyOccupationCosts> = [];
    for (const [faction, territories] of factionCosts) {
      result.push({
        faction,
        territories,
        totalCost: territories.reduce((sum, t) => sum + t.cost, 0),
      });
    }

    this.emit('occupation:costProcessed', { sessionId, costs: result });
    return result;
  }

  // ============================================================
  // 점령 정책
  // ============================================================

  /**
   * 점령 정책 변경
   */
  public changePolicy(
    sessionId: string,
    territoryId: string,
    newPolicy: OccupationPolicy,
  ): { success: boolean; territory?: OccupiedTerritory; effects?: string[] } {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) {
      return { success: false };
    }

    const oldPolicy = territory.policy;
    territory.policy = newPolicy;

    const effects: string[] = [];
    const policyEffect = POLICY_EFFECTS[newPolicy];

    // 즉시 효과
    if (policyEffect.publicOpinionModifier !== 0) {
      territory.publicOpinion = Math.max(0, Math.min(100,
        territory.publicOpinion + policyEffect.publicOpinionModifier
      ));
      effects.push(`여론 ${policyEffect.publicOpinionModifier > 0 ? '+' : ''}${policyEffect.publicOpinionModifier}`);
    }

    territory.economicOutput = Math.floor(territory.economicOutput * policyEffect.economicModifier);
    if (policyEffect.economicModifier !== 1.0) {
      effects.push(`경제 산출 ${Math.round((policyEffect.economicModifier - 1) * 100)}%`);
    }

    territory.lastUpdated = new Date();

    this.emit('occupation:policyChanged', { sessionId, territory, oldPolicy, newPolicy });
    logger.info(`[OccupationExtensionService] Policy changed: ${territoryId} ${oldPolicy} -> ${newPolicy}`);

    return { success: true, territory, effects };
  }

  // ============================================================
  // 점령 조치
  // ============================================================

  /**
   * 사용 가능한 조치 목록
   */
  public getAvailableActions(): OccupationAction[] {
    return [...AVAILABLE_ACTIONS];
  }

  /**
   * 점령 조치 실행
   */
  public executeAction(
    sessionId: string,
    territoryId: string,
    actionType: OccupationAction['type'],
  ): { success: boolean; effects?: Record<string, number>; error?: string } {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) {
      return { success: false, error: '점령지를 찾을 수 없습니다.' };
    }

    const action = AVAILABLE_ACTIONS.find(a => a.type === actionType);
    if (!action) {
      return { success: false, error: '알 수 없는 조치입니다.' };
    }

    // 효과 적용
    const effects: Record<string, number> = {};

    if (action.effects.resistanceLevel) {
      territory.resistanceLevel = Math.max(0, Math.min(100,
        territory.resistanceLevel + action.effects.resistanceLevel
      ));
      effects.resistanceLevel = action.effects.resistanceLevel;
    }

    if (action.effects.publicOpinion) {
      territory.publicOpinion = Math.max(0, Math.min(100,
        territory.publicOpinion + action.effects.publicOpinion
      ));
      effects.publicOpinion = action.effects.publicOpinion;
    }

    if (action.effects.securityLevel) {
      territory.securityLevel = Math.max(0, Math.min(100,
        territory.securityLevel + action.effects.securityLevel
      ));
      effects.securityLevel = action.effects.securityLevel;
    }

    if (action.effects.economicOutput) {
      territory.economicOutput = Math.max(10, Math.min(100,
        territory.economicOutput + action.effects.economicOutput
      ));
      effects.economicOutput = action.effects.economicOutput;
    }

    territory.totalExpenditure += action.cost;
    territory.lastUpdated = new Date();

    this.emit('occupation:actionExecuted', { sessionId, territory, action, effects });
    logger.info(`[OccupationExtensionService] Action executed: ${actionType} on ${territoryId}`);

    return { success: true, effects };
  }

  // ============================================================
  // 편입 처리
  // ============================================================

  /**
   * 영토 완전 편입
   */
  public integrateTerritory(
    sessionId: string,
    territoryId: string,
  ): { success: boolean; error?: string } {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) {
      return { success: false, error: '점령지를 찾을 수 없습니다.' };
    }

    if (territory.phase !== OccupationPhase.FULLY_INTEGRATED) {
      return { success: false, error: '완전 통합 단계에 도달해야 편입이 가능합니다.' };
    }

    // 저항 조직 해체
    territory.resistanceOrganization = undefined;
    territory.resistanceLevel = 0;
    territory.activeResistanceType = ResistanceType.PASSIVE;

    // 점령 목록에서 제거
    const territories = this.occupiedTerritories.get(sessionId) || [];
    const index = territories.findIndex(t => t.territoryId === territoryId);
    if (index !== -1) {
      territories.splice(index, 1);
    }

    this.emit('occupation:integrated', { sessionId, territory });
    logger.info(`[OccupationExtensionService] Territory integrated: ${territory.planetName}`);

    return { success: true };
  }

  /**
   * 영토 포기 (철수)
   */
  public abandonTerritory(
    sessionId: string,
    territoryId: string,
    reason: string,
  ): { success: boolean; territory?: OccupiedTerritory } {
    const territory = this.getTerritory(sessionId, territoryId);
    if (!territory) {
      return { success: false };
    }

    // 점령 목록에서 제거
    const territories = this.occupiedTerritories.get(sessionId) || [];
    const index = territories.findIndex(t => t.territoryId === territoryId);
    if (index !== -1) {
      territories.splice(index, 1);
    }

    this.emit('occupation:abandoned', { sessionId, territory, reason });
    logger.info(`[OccupationExtensionService] Territory abandoned: ${territory.planetName} (${reason})`);

    return { success: true, territory };
  }

  // ============================================================
  // 매 틱 처리
  // ============================================================

  /**
   * 점령 상태 업데이트 (매 틱)
   */
  public processTick(sessionId: string): void {
    const territories = this.occupiedTerritories.get(sessionId) || [];

    for (const territory of territories) {
      // 진행률 업데이트
      this.updatePhaseProgress(territory);

      // 경제 회복
      this.updateEconomicRecovery(territory);

      // 협력자 비율 변화
      this.updateCollaborators(territory);
    }

    // 저항 수준 업데이트
    this.updateResistance(sessionId);
  }

  private updatePhaseProgress(territory: OccupiedTerritory): void {
    if (territory.phase === OccupationPhase.FULLY_INTEGRATED) return;

    // 진행률 증가 (안정적일수록 빠름)
    let progressRate = 1;

    if (territory.securityLevel > 70) progressRate += 0.5;
    if (territory.publicOpinion > 50) progressRate += 0.5;
    if (territory.resistanceLevel < 30) progressRate += 0.5;

    // 정책에 따른 보정
    if (territory.policy === OccupationPolicy.COLLABORATIVE) {
      progressRate *= 1.2;
    }

    territory.phaseProgress = Math.min(100, territory.phaseProgress + progressRate);
    territory.lastUpdated = new Date();
  }

  private updateEconomicRecovery(territory: OccupiedTerritory): void {
    // 인프라 복구
    if (territory.infrastructureDamage > 0) {
      territory.infrastructureDamage = Math.max(0, territory.infrastructureDamage - 0.5);
    }

    // 경제 산출 회복 (인프라에 비례)
    const maxOutput = 100 - territory.infrastructureDamage;
    if (territory.economicOutput < maxOutput && territory.resistanceLevel < 50) {
      territory.economicOutput = Math.min(maxOutput, territory.economicOutput + 0.5);
    }

    // 세수 회복
    territory.taxCollection = Math.min(
      territory.economicOutput * 0.9,
      territory.taxCollection + 0.3,
    );
  }

  private updateCollaborators(territory: OccupiedTerritory): void {
    // 협력자 비율 변화
    if (territory.publicOpinion > 60) {
      territory.collaboratorRate = Math.min(50, territory.collaboratorRate + 0.5);
    } else if (territory.publicOpinion < 30) {
      territory.collaboratorRate = Math.max(0, territory.collaboratorRate - 0.3);
    }
  }

  // ============================================================
  // 조회 API
  // ============================================================

  public getTerritory(sessionId: string, territoryId: string): OccupiedTerritory | undefined {
    const territories = this.occupiedTerritories.get(sessionId) || [];
    return territories.find(t => t.territoryId === territoryId);
  }

  public getTerritoryByPlanet(sessionId: string, planetId: string): OccupiedTerritory | undefined {
    const territories = this.occupiedTerritories.get(sessionId) || [];
    return territories.find(t => t.planetId === planetId);
  }

  public getOccupiedTerritories(
    sessionId: string,
    filter?: {
      occupyingFaction?: string;
      phase?: OccupationPhase;
    },
  ): OccupiedTerritory[] {
    let territories = this.occupiedTerritories.get(sessionId) || [];

    if (filter?.occupyingFaction) {
      territories = territories.filter(t => t.occupyingFaction === filter.occupyingFaction);
    }
    if (filter?.phase) {
      territories = territories.filter(t => t.phase === filter.phase);
    }

    return territories;
  }

  public getIncidents(
    sessionId: string,
    territoryId?: string,
    limit?: number,
  ): OccupationIncident[] {
    let incidents = this.incidents.get(sessionId) || [];

    if (territoryId) {
      incidents = incidents.filter(i => i.territoryId === territoryId);
    }

    // 최신순 정렬
    incidents = incidents.sort((a, b) =>
      b.occurredAt.getTime() - a.occurredAt.getTime()
    );

    if (limit) {
      incidents = incidents.slice(0, limit);
    }

    return incidents;
  }

  public getOccupationSummary(sessionId: string, factionId: string): {
    totalTerritories: number;
    totalCost: number;
    averageStability: number;
    criticalTerritories: number;
    integrationReady: number;
  } {
    const territories = this.getOccupiedTerritories(sessionId, { occupyingFaction: factionId });

    let totalCost = 0;
    let stabilitySum = 0;
    let criticalCount = 0;
    let integrationReadyCount = 0;

    for (const territory of territories) {
      totalCost += territory.occupationCost;

      // 안정성 = 치안 - 저항 + 여론/2
      const stability = territory.securityLevel - territory.resistanceLevel + territory.publicOpinion / 2;
      stabilitySum += stability;

      if (territory.resistanceLevel > 70 || territory.securityLevel < 30) {
        criticalCount++;
      }

      const { canAdvance } = this.canAdvancePhase(territory);
      if (canAdvance && territory.phase === OccupationPhase.INTEGRATION) {
        integrationReadyCount++;
      }
    }

    return {
      totalTerritories: territories.length,
      totalCost,
      averageStability: territories.length > 0 ? stabilitySum / territories.length : 0,
      criticalTerritories: criticalCount,
      integrationReady: integrationReadyCount,
    };
  }
}

export const occupationExtensionService = OccupationExtensionService.getInstance();
export default OccupationExtensionService;







