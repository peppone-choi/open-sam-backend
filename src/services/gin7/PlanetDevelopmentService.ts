/**
 * PlanetDevelopmentService - 행성 개발 시스템
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 행성 속성 개발 (공업, 기술, 방어, 자원)
 * - 시설 건설/업그레이드
 * - 인구 성장 촉진
 *
 * 제국/동맹 공통으로 사용하나 주체가 다름:
 * - 제국 직할령: 국고로 개발
 * - 제국 봉토: 영주가 자비로 개발
 * - 동맹: 연방 예산 또는 지방 예산으로 개발
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// 순환 참조 방지를 위한 지연 import
let fezzanFinancialService: any = null;
const getFezzanFinancialService = async () => {
  if (!fezzanFinancialService) {
    const module = await import('./FezzanFinancialService');
    fezzanFinancialService = module.FezzanFinancialService;
  }
  return fezzanFinancialService;
};

/**
 * 개발 가능 속성
 */
export enum DevelopmentAttribute {
  POPULATION = 'POPULATION',   // 인구 성장
  INDUSTRY = 'INDUSTRY',       // 공업력
  TECHNOLOGY = 'TECHNOLOGY',   // 기술력
  DEFENSE = 'DEFENSE',         // 방어력
  RESOURCES = 'RESOURCES',     // 자원
}

/**
 * 시설 타입
 */
export enum FacilityType {
  SHIPYARD = 'SHIPYARD',             // 조선소 - 함선 생산
  FACTORY = 'FACTORY',               // 공장 - 자원 생산
  RESEARCH_LAB = 'RESEARCH_LAB',     // 연구소 - 기술 연구
  DEFENSE_GRID = 'DEFENSE_GRID',     // 방어 시설 - 방어력
  MILITARY_ACADEMY = 'MILITARY_ACADEMY', // 군사 학교 - 인재 육성
  SPACEPORT = 'SPACEPORT',           // 우주항 - 교역 보너스
  HOSPITAL = 'HOSPITAL',             // 병원 - 인구 성장
  MINE = 'MINE',                     // 광산 - 자원 채굴
}

/**
 * 시설 인터페이스
 */
export interface Facility {
  facilityId: string;
  type: FacilityType;
  level: number;           // 1-10
  hp: number;
  maxHp: number;
  isOperational: boolean;
  constructedAt: Date;
  lastUpgradedAt?: Date;
}

/**
 * 자금 출처 타입
 */
export enum FundingSource {
  IMPERIAL_TREASURY = 'IMPERIAL_TREASURY',     // 제국 국고 (직할령)
  NOBLE_PRIVATE = 'NOBLE_PRIVATE',             // 귀족 사재 (봉토)
  FEDERAL_BUDGET = 'FEDERAL_BUDGET',           // 동맹 연방 예산
  LOCAL_BUDGET = 'LOCAL_BUDGET',               // 동맹 지방 예산
  FEZZAN_LOAN = 'FEZZAN_LOAN',                 // 페잔 대출
  FEZZAN_INVESTMENT = 'FEZZAN_INVESTMENT',     // 페잔 투자
  MIXED = 'MIXED',                             // 혼합 자금
}

/**
 * 페잔 자금 정보
 */
export interface FezzanFunding {
  type: 'LOAN' | 'INVESTMENT';
  fezzanReferenceId: string;   // 대출 또는 투자 ID
  amount: number;
  interestRate?: number;       // 대출인 경우 이자율
  expectedReturn?: number;     // 투자인 경우 예상 수익률
  terms?: string;              // 조건
}

/**
 * 개발 프로젝트 인터페이스
 */
export interface DevelopmentProject {
  projectId: string;
  sessionId: string;
  planetId: string;

  // 프로젝트 타입
  projectType: 'ATTRIBUTE' | 'FACILITY_BUILD' | 'FACILITY_UPGRADE';
  targetAttribute?: DevelopmentAttribute;
  targetFacilityType?: FacilityType;
  targetFacilityId?: string;

  // 비용
  resourceCost: number;
  creditCost: number;

  // 자금 출처
  fundingSource: FundingSource;
  fezzanFunding?: FezzanFunding;    // 페잔 자금 정보

  // 진행
  progress: number;         // 0-100
  totalDuration: number;    // 총 소요 시간 (게임 시간 단위)
  startedAt: Date;
  estimatedEndAt: Date;

  // 담당자
  managerId?: string;       // 담당 캐릭터 ID
  managerBonus: number;     // 담당자 능력 보너스

  // 상태
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';

  // 효과
  expectedEffect: number;   // 예상 상승치
}

/**
 * 행성 개발 상태 인터페이스
 */
export interface PlanetDevelopmentState {
  planetId: string;
  sessionId: string;

  // 현재 속성
  attributes: {
    population: number;
    industry: number;
    technology: number;
    defense: number;
    resources: number;
  };

  // 시설 목록
  facilities: Facility[];
  maxFacilitySlots: number;

  // 진행 중인 프로젝트
  activeProjects: DevelopmentProject[];

  // 통계
  totalInvestment: number;  // 총 투자액
  developmentHistory: Array<{
    date: Date;
    type: string;
    effect: number;
  }>;
}

/**
 * 개발 비용 상수
 */
const DEVELOPMENT_COSTS = {
  // 속성 개발 비용 (현재 수치 × 계수)
  ATTRIBUTE_COST_MULTIPLIER: {
    [DevelopmentAttribute.POPULATION]: 100,
    [DevelopmentAttribute.INDUSTRY]: 150,
    [DevelopmentAttribute.TECHNOLOGY]: 200,
    [DevelopmentAttribute.DEFENSE]: 120,
    [DevelopmentAttribute.RESOURCES]: 100,
  },
  // 속성 개발 소요 시간 (기본 시간, 시간 단위)
  ATTRIBUTE_BASE_DURATION: 720, // 30일 (720시간)

  // 시설 건설 비용 (기본 비용)
  FACILITY_BUILD_COST: {
    [FacilityType.SHIPYARD]: { credits: 50000, resources: 10000 },
    [FacilityType.FACTORY]: { credits: 30000, resources: 8000 },
    [FacilityType.RESEARCH_LAB]: { credits: 40000, resources: 5000 },
    [FacilityType.DEFENSE_GRID]: { credits: 35000, resources: 12000 },
    [FacilityType.MILITARY_ACADEMY]: { credits: 25000, resources: 3000 },
    [FacilityType.SPACEPORT]: { credits: 45000, resources: 7000 },
    [FacilityType.HOSPITAL]: { credits: 20000, resources: 2000 },
    [FacilityType.MINE]: { credits: 15000, resources: 15000 },
  },
  // 시설 건설 소요 시간 (기본 시간)
  FACILITY_BUILD_DURATION: 1440, // 60일

  // 시설 업그레이드 비용 계수 (레벨 × 기본 비용)
  FACILITY_UPGRADE_MULTIPLIER: 1.5,
};

/**
 * 시설 효과 상수
 */
const FACILITY_EFFECTS = {
  [FacilityType.SHIPYARD]: { production: 10 }, // 레벨당 함선 생산 +10%
  [FacilityType.FACTORY]: { resources: 10, industry: 5 },
  [FacilityType.RESEARCH_LAB]: { technology: 10 },
  [FacilityType.DEFENSE_GRID]: { defense: 15 },
  [FacilityType.MILITARY_ACADEMY]: { training: 5 },
  [FacilityType.SPACEPORT]: { trade: 10, credits: 5 },
  [FacilityType.HOSPITAL]: { population_growth: 5 },
  [FacilityType.MINE]: { resources: 15 },
};

/**
 * PlanetDevelopmentService 클래스
 */
export class PlanetDevelopmentService extends EventEmitter {
  private static instance: PlanetDevelopmentService;

  // 행성 개발 상태 저장소
  private developmentStates: Map<string, PlanetDevelopmentState> = new Map();

  private constructor() {
    super();
    logger.info('[PlanetDevelopmentService] Initialized');
  }

  public static getInstance(): PlanetDevelopmentService {
    if (!PlanetDevelopmentService.instance) {
      PlanetDevelopmentService.instance = new PlanetDevelopmentService();
    }
    return PlanetDevelopmentService.instance;
  }

  // ==================== 초기화 ====================

  /**
   * 행성 개발 상태 초기화
   */
  public initializePlanet(
    sessionId: string,
    planetId: string,
    initialAttributes: {
      population: number;
      industry: number;
      technology: number;
      defense: number;
      resources: number;
    },
    maxFacilitySlots: number = 10,
  ): PlanetDevelopmentState {
    const state: PlanetDevelopmentState = {
      planetId,
      sessionId,
      attributes: { ...initialAttributes },
      facilities: [],
      maxFacilitySlots,
      activeProjects: [],
      totalInvestment: 0,
      developmentHistory: [],
    };

    this.developmentStates.set(`${sessionId}:${planetId}`, state);

    logger.info(`[PlanetDevelopmentService] Planet initialized: ${planetId}`);

    return state;
  }

  // ==================== 속성 개발 ====================

  /**
   * 속성 개발 프로젝트 시작
   */
  public startAttributeDevelopment(
    sessionId: string,
    planetId: string,
    attribute: DevelopmentAttribute,
    managerId?: string,
    managerStats?: { politics: number; intelligence: number },
  ): DevelopmentProject | null {
    const state = this.getState(sessionId, planetId);
    if (!state) return null;

    // 현재 속성 값
    const currentValue = this.getAttributeValue(state, attribute);

    // 비용 계산
    const costMultiplier = DEVELOPMENT_COSTS.ATTRIBUTE_COST_MULTIPLIER[attribute];
    const creditCost = Math.floor(currentValue * costMultiplier);
    const resourceCost = Math.floor(creditCost * 0.3);

    // 소요 시간 계산 (담당자 보너스 적용)
    let duration = DEVELOPMENT_COSTS.ATTRIBUTE_BASE_DURATION;
    let managerBonus = 0;
    if (managerStats) {
      managerBonus = (managerStats.politics + (managerStats.intelligence || (managerStats as any).intellect || 50)) / 200;
      duration = Math.floor(duration * (1 - managerBonus * 0.3)); // 최대 30% 단축
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + duration * 60 * 60 * 1000); // 시간 → ms

    const projectId = `DEV-${planetId}-${Date.now()}`;
    const project: DevelopmentProject = {
      projectId,
      sessionId,
      planetId,
      projectType: 'ATTRIBUTE',
      targetAttribute: attribute,
      creditCost,
      resourceCost,
      fundingSource: FundingSource.IMPERIAL_TREASURY, // 기본값, 호출자가 변경 가능
      progress: 0,
      totalDuration: duration,
      startedAt: now,
      estimatedEndAt: endDate,
      managerId,
      managerBonus,
      status: 'IN_PROGRESS',
      expectedEffect: this.calculateExpectedEffect(attribute, currentValue),
    };

    state.activeProjects.push(project);

    this.emit('PROJECT_STARTED', {
      sessionId,
      planetId,
      project,
    });

    logger.info(`[PlanetDevelopmentService] Attribute development started: ${attribute} on ${planetId}`);

    return project;
  }

  /**
   * 예상 효과 계산
   */
  private calculateExpectedEffect(attribute: DevelopmentAttribute, currentValue: number): number {
    // 현재 값이 높을수록 상승폭 감소
    const baseEffect = 5;
    const diminishingFactor = Math.max(0.2, 1 - currentValue / 200);
    return Math.floor(baseEffect * diminishingFactor);
  }

  /**
   * 속성 값 조회
   */
  private getAttributeValue(state: PlanetDevelopmentState, attribute: DevelopmentAttribute): number {
    switch (attribute) {
      case DevelopmentAttribute.POPULATION:
        return state.attributes.population;
      case DevelopmentAttribute.INDUSTRY:
        return state.attributes.industry;
      case DevelopmentAttribute.TECHNOLOGY:
        return state.attributes.technology;
      case DevelopmentAttribute.DEFENSE:
        return state.attributes.defense;
      case DevelopmentAttribute.RESOURCES:
        return state.attributes.resources;
    }
  }

  // ==================== 시설 건설 ====================

  /**
   * 시설 건설 프로젝트 시작
   */
  public startFacilityConstruction(
    sessionId: string,
    planetId: string,
    facilityType: FacilityType,
    managerId?: string,
  ): DevelopmentProject | null {
    const state = this.getState(sessionId, planetId);
    if (!state) return null;

    // 시설 슬롯 확인
    if (state.facilities.length >= state.maxFacilitySlots) {
      logger.warn(`[PlanetDevelopmentService] No facility slots available: ${planetId}`);
      return null;
    }

    // 비용 조회
    const costs = DEVELOPMENT_COSTS.FACILITY_BUILD_COST[facilityType];
    if (!costs) return null;

    const now = new Date();
    const duration = DEVELOPMENT_COSTS.FACILITY_BUILD_DURATION;
    const endDate = new Date(now.getTime() + duration * 60 * 60 * 1000);

    const projectId = `FAC-${planetId}-${Date.now()}`;
    const project: DevelopmentProject = {
      projectId,
      sessionId,
      planetId,
      projectType: 'FACILITY_BUILD',
      targetFacilityType: facilityType,
      creditCost: costs.credits,
      resourceCost: costs.resources,
      fundingSource: FundingSource.IMPERIAL_TREASURY, // 기본값
      progress: 0,
      totalDuration: duration,
      startedAt: now,
      estimatedEndAt: endDate,
      managerId,
      managerBonus: 0,
      status: 'IN_PROGRESS',
      expectedEffect: 1, // 레벨 1 시설
    };

    state.activeProjects.push(project);
    state.totalInvestment += costs.credits + costs.resources;

    this.emit('FACILITY_CONSTRUCTION_STARTED', {
      sessionId,
      planetId,
      facilityType,
      project,
    });

    logger.info(`[PlanetDevelopmentService] Facility construction started: ${facilityType} on ${planetId}`);

    return project;
  }

  /**
   * 시설 업그레이드 프로젝트 시작
   */
  public startFacilityUpgrade(
    sessionId: string,
    planetId: string,
    facilityId: string,
  ): DevelopmentProject | null {
    const state = this.getState(sessionId, planetId);
    if (!state) return null;

    const facility = state.facilities.find(f => f.facilityId === facilityId);
    if (!facility) return null;

    if (facility.level >= 10) {
      logger.warn(`[PlanetDevelopmentService] Facility at max level: ${facilityId}`);
      return null;
    }

    // 업그레이드 비용 계산
    const baseCosts = DEVELOPMENT_COSTS.FACILITY_BUILD_COST[facility.type];
    const multiplier = facility.level * DEVELOPMENT_COSTS.FACILITY_UPGRADE_MULTIPLIER;
    const creditCost = Math.floor(baseCosts.credits * multiplier);
    const resourceCost = Math.floor(baseCosts.resources * multiplier);

    const now = new Date();
    const duration = Math.floor(DEVELOPMENT_COSTS.FACILITY_BUILD_DURATION * (facility.level / 2));
    const endDate = new Date(now.getTime() + duration * 60 * 60 * 1000);

    const projectId = `UPG-${facilityId}-${Date.now()}`;
    const project: DevelopmentProject = {
      projectId,
      sessionId,
      planetId,
      projectType: 'FACILITY_UPGRADE',
      targetFacilityId: facilityId,
      targetFacilityType: facility.type,
      creditCost,
      resourceCost,
      fundingSource: FundingSource.IMPERIAL_TREASURY, // 기본값
      progress: 0,
      totalDuration: duration,
      startedAt: now,
      estimatedEndAt: endDate,
      managerBonus: 0,
      status: 'IN_PROGRESS',
      expectedEffect: facility.level + 1,
    };

    state.activeProjects.push(project);

    this.emit('FACILITY_UPGRADE_STARTED', {
      sessionId,
      planetId,
      facilityId,
      currentLevel: facility.level,
      project,
    });

    return project;
  }

  // ==================== 프로젝트 처리 ====================

  /**
   * 프로젝트 진행 업데이트 (TimeEngine에서 호출)
   */
  public updateProjects(sessionId: string, elapsedHours: number): void {
    for (const [key, state] of this.developmentStates) {
      if (!key.startsWith(sessionId)) continue;

      for (const project of state.activeProjects) {
        if (project.status !== 'IN_PROGRESS') continue;

        // 진행률 업데이트
        const progressIncrement = (elapsedHours / project.totalDuration) * 100;
        project.progress = Math.min(100, project.progress + progressIncrement);

        // 완료 체크
        if (project.progress >= 100) {
          this.completeProject(state, project);
        }
      }
    }
  }

  /**
   * 프로젝트 완료 처리
   */
  private completeProject(state: PlanetDevelopmentState, project: DevelopmentProject): void {
    project.status = 'COMPLETED';

    if (project.projectType === 'ATTRIBUTE' && project.targetAttribute) {
      // 속성 개발 완료
      this.applyAttributeEffect(state, project.targetAttribute, project.expectedEffect);
    } else if (project.projectType === 'FACILITY_BUILD' && project.targetFacilityType) {
      // 시설 건설 완료
      this.createFacility(state, project.targetFacilityType);
    } else if (project.projectType === 'FACILITY_UPGRADE' && project.targetFacilityId) {
      // 시설 업그레이드 완료
      this.upgradeFacility(state, project.targetFacilityId);
    }

    // 기록 추가
    state.developmentHistory.push({
      date: new Date(),
      type: project.projectType,
      effect: project.expectedEffect,
    });

    this.emit('PROJECT_COMPLETED', {
      sessionId: state.sessionId,
      planetId: state.planetId,
      project,
    });

    logger.info(`[PlanetDevelopmentService] Project completed: ${project.projectId}`);
  }

  /**
   * 속성 효과 적용
   */
  private applyAttributeEffect(
    state: PlanetDevelopmentState,
    attribute: DevelopmentAttribute,
    effect: number,
  ): void {
    switch (attribute) {
      case DevelopmentAttribute.POPULATION:
        state.attributes.population = Math.min(100, state.attributes.population + effect);
        break;
      case DevelopmentAttribute.INDUSTRY:
        state.attributes.industry = Math.min(100, state.attributes.industry + effect);
        break;
      case DevelopmentAttribute.TECHNOLOGY:
        state.attributes.technology = Math.min(100, state.attributes.technology + effect);
        break;
      case DevelopmentAttribute.DEFENSE:
        state.attributes.defense = Math.min(100, state.attributes.defense + effect);
        break;
      case DevelopmentAttribute.RESOURCES:
        state.attributes.resources = Math.min(100, state.attributes.resources + effect);
        break;
    }
  }

  /**
   * 시설 생성
   */
  private createFacility(state: PlanetDevelopmentState, type: FacilityType): void {
    const facilityId = `FAC-${state.planetId}-${Date.now()}`;
    const facility: Facility = {
      facilityId,
      type,
      level: 1,
      hp: 100,
      maxHp: 100,
      isOperational: true,
      constructedAt: new Date(),
    };

    state.facilities.push(facility);
  }

  /**
   * 시설 업그레이드
   */
  private upgradeFacility(state: PlanetDevelopmentState, facilityId: string): void {
    const facility = state.facilities.find(f => f.facilityId === facilityId);
    if (facility && facility.level < 10) {
      facility.level++;
      facility.maxHp = 100 + facility.level * 10;
      facility.hp = facility.maxHp;
      facility.lastUpgradedAt = new Date();
    }
  }

  // ==================== 조회 ====================

  /**
   * 행성 개발 상태 조회
   */
  public getState(sessionId: string, planetId: string): PlanetDevelopmentState | undefined {
    return this.developmentStates.get(`${sessionId}:${planetId}`);
  }

  /**
   * 행성의 활성 프로젝트 조회
   */
  public getActiveProjects(sessionId: string, planetId: string): DevelopmentProject[] {
    const state = this.getState(sessionId, planetId);
    return state?.activeProjects.filter(p => p.status === 'IN_PROGRESS') || [];
  }

  /**
   * 행성의 시설 목록 조회
   */
  public getFacilities(sessionId: string, planetId: string): Facility[] {
    const state = this.getState(sessionId, planetId);
    return state?.facilities || [];
  }

  /**
   * 시설 효과 합산 조회
   */
  public calculateTotalFacilityEffects(sessionId: string, planetId: string): Record<string, number> {
    const state = this.getState(sessionId, planetId);
    if (!state) return {};

    const effects: Record<string, number> = {};

    for (const facility of state.facilities) {
      if (!facility.isOperational) continue;

      const facilityEffects = FACILITY_EFFECTS[facility.type];
      if (!facilityEffects) continue;

      for (const [key, value] of Object.entries(facilityEffects)) {
        effects[key] = (effects[key] || 0) + (value as number) * facility.level;
      }
    }

    return effects;
  }

  // ==================== 페잔 자금 유치 ====================

  /**
   * 페잔 대출로 개발 프로젝트 시작
   * 대출을 받아 개발 자금으로 사용
   */
  public async startProjectWithFezzanLoan(
    sessionId: string,
    planetId: string,
    borrowerId: string, // 대출 신청자 (귀족 또는 세력)
    borrowerType: 'CHARACTER' | 'FACTION',
    projectType: 'ATTRIBUTE' | 'FACILITY_BUILD',
    target: DevelopmentAttribute | FacilityType,
    loanTermMonths: number = 24,
    collateralDescription?: string,
  ): Promise<{
    success: boolean;
    project?: DevelopmentProject;
    loanId?: string;
    error?: string;
  }> {
    try {
      const FezzanFinance = await getFezzanFinancialService();

      // 비용 계산
      let creditCost: number;
      let resourceCost: number;

      if (projectType === 'ATTRIBUTE') {
        const state = this.getState(sessionId, planetId);
        if (!state) return { success: false, error: '행성을 찾을 수 없습니다.' };

        const currentValue = this.getAttributeValue(state, target as DevelopmentAttribute);
        const costMultiplier = DEVELOPMENT_COSTS.ATTRIBUTE_COST_MULTIPLIER[target as DevelopmentAttribute];
        creditCost = Math.floor(currentValue * costMultiplier);
        resourceCost = Math.floor(creditCost * 0.3);
      } else {
        const costs = DEVELOPMENT_COSTS.FACILITY_BUILD_COST[target as FacilityType];
        if (!costs) return { success: false, error: '시설 타입이 올바르지 않습니다.' };
        creditCost = costs.credits;
        resourceCost = costs.resources;
      }

      // 페잔 대출 신청
      const loanResult = await FezzanFinance.applyForLoan(
        sessionId,
        borrowerId,
        borrowerType,
        creditCost,
        loanTermMonths,
        collateralDescription ? {
          type: 'TERRITORY' as const,
          description: collateralDescription,
          value: creditCost * 1.5,
        } : undefined
      );

      if (!loanResult.success || !loanResult.loan) {
        return { success: false, error: loanResult.error || '페잔 대출 심사에 실패했습니다.' };
      }

      // 프로젝트 시작
      let project: DevelopmentProject | null;
      if (projectType === 'ATTRIBUTE') {
        project = this.startAttributeDevelopment(sessionId, planetId, target as DevelopmentAttribute);
      } else {
        project = this.startFacilityConstruction(sessionId, planetId, target as FacilityType);
      }

      if (!project) {
        return { success: false, error: '프로젝트 시작에 실패했습니다.' };
      }

      // 페잔 자금 정보 설정
      project.fundingSource = FundingSource.FEZZAN_LOAN;
      project.fezzanFunding = {
        type: 'LOAN',
        fezzanReferenceId: loanResult.loan.loanId,
        amount: creditCost,
        interestRate: loanResult.loan.interestRate,
        terms: `${loanTermMonths}개월 상환, 월 ${loanResult.loan.monthlyPayment} 상환`,
      };

      this.emit('PROJECT_FUNDED_BY_FEZZAN', {
        sessionId,
        planetId,
        projectId: project.projectId,
        fundingType: 'LOAN',
        loanId: loanResult.loan.loanId,
        amount: creditCost,
      });

      logger.info(`[PlanetDevelopmentService] Project funded by Fezzan loan: ${project.projectId}`);

      return {
        success: true,
        project,
        loanId: loanResult.loan.loanId,
      };
    } catch (error: any) {
      logger.error(`[PlanetDevelopmentService] Error with Fezzan loan: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 페잔 투자 유치로 개발 프로젝트 시작
   * 페잔 투자자가 행성 산업에 투자
   */
  public async startProjectWithFezzanInvestment(
    sessionId: string,
    planetId: string,
    investorId: string, // 페잔 투자자 ID
    projectType: 'FACILITY_BUILD',
    facilityType: FacilityType,
    investmentAmount: number,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' = 'MEDIUM',
  ): Promise<{
    success: boolean;
    project?: DevelopmentProject;
    investmentId?: string;
    error?: string;
  }> {
    try {
      const FezzanFinance = await getFezzanFinancialService();

      const state = this.getState(sessionId, planetId);
      if (!state) return { success: false, error: '행성을 찾을 수 없습니다.' };

      // 시설 비용 확인
      const costs = DEVELOPMENT_COSTS.FACILITY_BUILD_COST[facilityType];
      if (!costs) return { success: false, error: '시설 타입이 올바르지 않습니다.' };

      if (investmentAmount < costs.credits) {
        return { success: false, error: `투자금이 부족합니다. 필요: ${costs.credits}` };
      }

      // 페잔 투자 실행
      const investResult = await FezzanFinance.makeInvestment(
        sessionId,
        investorId,
        'INDUSTRY' as const,
        planetId,
        `${state.planetId} - ${facilityType}`,
        investmentAmount,
        riskLevel
      );

      if (!investResult.success || !investResult.investment) {
        return { success: false, error: investResult.error || '페잔 투자 실행에 실패했습니다.' };
      }

      // 프로젝트 시작
      const project = this.startFacilityConstruction(sessionId, planetId, facilityType);
      if (!project) {
        return { success: false, error: '프로젝트 시작에 실패했습니다.' };
      }

      // 페잔 투자 정보 설정
      project.fundingSource = FundingSource.FEZZAN_INVESTMENT;
      project.fezzanFunding = {
        type: 'INVESTMENT',
        fezzanReferenceId: investResult.investment.investmentId,
        amount: investmentAmount,
        expectedReturn: investResult.investment.expectedReturn,
        terms: `수익 배당 의무, 리스크 레벨: ${riskLevel}`,
      };

      this.emit('PROJECT_FUNDED_BY_FEZZAN', {
        sessionId,
        planetId,
        projectId: project.projectId,
        fundingType: 'INVESTMENT',
        investmentId: investResult.investment.investmentId,
        amount: investmentAmount,
      });

      logger.info(`[PlanetDevelopmentService] Project funded by Fezzan investment: ${project.projectId}`);

      return {
        success: true,
        project,
        investmentId: investResult.investment.investmentId,
      };
    } catch (error: any) {
      logger.error(`[PlanetDevelopmentService] Error with Fezzan investment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트 자금 출처 설정
   */
  public setProjectFunding(
    sessionId: string,
    planetId: string,
    projectId: string,
    fundingSource: FundingSource,
    fezzanFunding?: FezzanFunding,
  ): boolean {
    const state = this.getState(sessionId, planetId);
    if (!state) return false;

    const project = state.activeProjects.find(p => p.projectId === projectId);
    if (!project) return false;

    project.fundingSource = fundingSource;
    if (fezzanFunding) {
      project.fezzanFunding = fezzanFunding;
    }

    return true;
  }

  /**
   * 페잔 자금 프로젝트 목록 조회
   */
  public getFezzanFundedProjects(sessionId: string): DevelopmentProject[] {
    const projects: DevelopmentProject[] = [];

    for (const [key, state] of this.developmentStates) {
      if (!key.startsWith(sessionId)) continue;

      for (const project of state.activeProjects) {
        if (project.fundingSource === FundingSource.FEZZAN_LOAN ||
            project.fundingSource === FundingSource.FEZZAN_INVESTMENT) {
          projects.push(project);
        }
      }
    }

    return projects;
  }
}

export const planetDevelopmentService = PlanetDevelopmentService.getInstance();
export default PlanetDevelopmentService;

