/**
 * RecruitmentService - 징병 시스템
 * 매뉴얼 기반 구현
 *
 * 기능:
 * - 행성별 징병
 * - 승조원 품질 관리
 * - 훈련도 기반 품질
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum CrewQuality {
  ELITE = 'ELITE',               // 정예
  VETERAN = 'VETERAN',           // 베테랑
  REGULAR = 'REGULAR',           // 일반
  RECRUIT = 'RECRUIT',           // 신병
  CONSCRIPT = 'CONSCRIPT',       // 징집병
}

export interface RecruitmentPool {
  planetId: string;
  availableCrew: number;
  maxCrew: number;
  qualityDistribution: Record<CrewQuality, number>;
  lastRefreshedAt: Date;
}

export interface CrewRecruitRequest {
  sessionId: string;
  planetId: string;
  fleetId: string;
  unitId?: string;
  quantity: number;
  preferredQuality?: CrewQuality;
}

export interface RecruitResult {
  success: boolean;
  recruited: number;
  qualityBreakdown: Record<CrewQuality, number>;
  totalCost: number;
  error?: string;
}

// 품질별 스탯 보너스
const QUALITY_STATS: Record<CrewQuality, {
  combatBonus: number;
  moraleBonus: number;
  costMultiplier: number;
  trainingTimeReduction: number;
}> = {
  [CrewQuality.ELITE]: {
    combatBonus: 0.3,
    moraleBonus: 20,
    costMultiplier: 3.0,
    trainingTimeReduction: 0.5,
  },
  [CrewQuality.VETERAN]: {
    combatBonus: 0.2,
    moraleBonus: 15,
    costMultiplier: 2.0,
    trainingTimeReduction: 0.3,
  },
  [CrewQuality.REGULAR]: {
    combatBonus: 0.1,
    moraleBonus: 10,
    costMultiplier: 1.0,
    trainingTimeReduction: 0,
  },
  [CrewQuality.RECRUIT]: {
    combatBonus: 0,
    moraleBonus: 5,
    costMultiplier: 0.7,
    trainingTimeReduction: -0.2,
  },
  [CrewQuality.CONSCRIPT]: {
    combatBonus: -0.1,
    moraleBonus: 0,
    costMultiplier: 0.5,
    trainingTimeReduction: -0.3,
  },
};

// 기본 징병 비용
const BASE_RECRUIT_COST = 100;

// ============================================================
// RecruitmentService Class
// ============================================================

export class RecruitmentService extends EventEmitter {
  private static instance: RecruitmentService;
  
  // 행성별 징병 풀
  private recruitmentPools: Map<string, RecruitmentPool> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[RecruitmentService] Initialized');
  }

  public static getInstance(): RecruitmentService {
    if (!RecruitmentService.instance) {
      RecruitmentService.instance = new RecruitmentService();
    }
    return RecruitmentService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 월 시작 시 징병 풀 갱신
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.refreshRecruitmentPools(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[RecruitmentService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 징병 풀 관리
  // ============================================================

  /**
   * 행성 징병 풀 초기화
   */
  public async initializePlanetPool(sessionId: string, planetId: string): Promise<void> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return;

    const pool = this.calculatePlanetPool(planet);
    const key = `${sessionId}-${planetId}`;
    this.recruitmentPools.set(key, pool);

    logger.debug(`[RecruitmentService] Initialized pool for planet ${planetId}: ${pool.availableCrew} crew`);
  }

  /**
   * 행성 징병 풀 계산
   */
  private calculatePlanetPool(planet: IPlanet): RecruitmentPool {
    // 인구 기반 최대 징병 가능 인원 (인구의 1%)
    const maxCrew = Math.floor((planet.population || 1000000) * 0.01);
    
    // 사기/충성도 기반 가용 인원
    const moraleModifier = (planet.morale || 50) / 100;
    const loyaltyModifier = (planet.loyalty || 50) / 100;
    const availableCrew = Math.floor(maxCrew * moraleModifier * loyaltyModifier);

    // 품질 분포 (행성 개발도 기반)
    const developmentLevel = this.getPlanetDevelopmentLevel(planet);
    const qualityDistribution = this.calculateQualityDistribution(developmentLevel);

    return {
      planetId: planet.planetId,
      availableCrew,
      maxCrew,
      qualityDistribution,
      lastRefreshedAt: new Date(),
    };
  }

  /**
   * 행성 개발 레벨 계산
   */
  private getPlanetDevelopmentLevel(planet: IPlanet): number {
    // 시설 기반 개발 레벨 (0-100)
    const facilities = planet.facilities || [];
    const academyCount = facilities.filter(f => f.type === 'military_academy').length;
    
    let level = 30; // 기본
    level += academyCount * 20; // 사관학교당 +20
    level += (planet.morale || 50) * 0.3;
    
    return Math.min(100, level);
  }

  /**
   * 품질 분포 계산
   */
  private calculateQualityDistribution(developmentLevel: number): Record<CrewQuality, number> {
    // 개발 레벨에 따른 품질 분포 (합계 100%)
    if (developmentLevel >= 80) {
      return {
        [CrewQuality.ELITE]: 10,
        [CrewQuality.VETERAN]: 25,
        [CrewQuality.REGULAR]: 40,
        [CrewQuality.RECRUIT]: 20,
        [CrewQuality.CONSCRIPT]: 5,
      };
    } else if (developmentLevel >= 60) {
      return {
        [CrewQuality.ELITE]: 5,
        [CrewQuality.VETERAN]: 15,
        [CrewQuality.REGULAR]: 40,
        [CrewQuality.RECRUIT]: 30,
        [CrewQuality.CONSCRIPT]: 10,
      };
    } else if (developmentLevel >= 40) {
      return {
        [CrewQuality.ELITE]: 2,
        [CrewQuality.VETERAN]: 8,
        [CrewQuality.REGULAR]: 30,
        [CrewQuality.RECRUIT]: 40,
        [CrewQuality.CONSCRIPT]: 20,
      };
    } else {
      return {
        [CrewQuality.ELITE]: 1,
        [CrewQuality.VETERAN]: 4,
        [CrewQuality.REGULAR]: 20,
        [CrewQuality.RECRUIT]: 40,
        [CrewQuality.CONSCRIPT]: 35,
      };
    }
  }

  /**
   * 징병 풀 갱신 (월간)
   */
  private async refreshRecruitmentPools(sessionId: string): Promise<void> {
    const planets = await Planet.find({ sessionId });
    
    for (const planet of planets) {
      const pool = this.calculatePlanetPool(planet);
      const key = `${sessionId}-${planet.planetId}`;
      this.recruitmentPools.set(key, pool);
    }

    logger.info(`[RecruitmentService] Refreshed ${planets.length} recruitment pools for session ${sessionId}`);
  }

  // ============================================================
  // 징병 실행
  // ============================================================

  /**
   * 승조원 징병
   */
  public async recruitCrew(request: CrewRecruitRequest): Promise<RecruitResult> {
    const { sessionId, planetId, fleetId, unitId, quantity, preferredQuality } = request;

    // 1. 풀 확인
    const key = `${sessionId}-${planetId}`;
    let pool = this.recruitmentPools.get(key);
    
    if (!pool) {
      await this.initializePlanetPool(sessionId, planetId);
      pool = this.recruitmentPools.get(key);
    }

    if (!pool || pool.availableCrew < quantity) {
      return { 
        success: false, 
        recruited: 0, 
        qualityBreakdown: {} as Record<CrewQuality, number>,
        totalCost: 0,
        error: `가용 인원 부족 (필요: ${quantity}, 가용: ${pool?.availableCrew || 0})` 
      };
    }

    // 2. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { 
        success: false, 
        recruited: 0, 
        qualityBreakdown: {} as Record<CrewQuality, number>,
        totalCost: 0,
        error: '함대를 찾을 수 없습니다.' 
      };
    }

    // 3. 품질 분배 계산
    const qualityBreakdown = this.distributeByQuality(quantity, pool.qualityDistribution, preferredQuality);

    // 4. 비용 계산
    let totalCost = 0;
    for (const [quality, count] of Object.entries(qualityBreakdown)) {
      const stats = QUALITY_STATS[quality as CrewQuality];
      totalCost += BASE_RECRUIT_COST * stats.costMultiplier * count;
    }

    // 5. 징병 실행
    pool.availableCrew -= quantity;

    // 유닛에 승조원 배치
    if (unitId) {
      const unit = fleet.units?.find(u => u.unitId === unitId);
      if (unit) {
        unit.currentCrewCount = (unit.currentCrewCount || 0) + quantity;
        
        // 품질에 따른 스탯 보정
        const avgQualityBonus = this.calculateAvgQualityBonus(qualityBreakdown);
        unit.crewQualityBonus = avgQualityBonus;
      }
    } else {
      // 함대 전체 승조원 풀에 추가
      if (!fleet.crewPool) fleet.crewPool = 0;
      fleet.crewPool += quantity;
    }

    await fleet.save();

    // 6. 행성 인구 감소
    const planet = await Planet.findOne({ sessionId, planetId });
    if (planet) {
      planet.population = Math.max(0, (planet.population || 0) - quantity);
      await planet.save();
    }

    this.emit('recruit:completed', {
      sessionId,
      planetId,
      fleetId,
      unitId,
      recruited: quantity,
      qualityBreakdown,
      totalCost,
    });

    logger.info(`[RecruitmentService] Recruited ${quantity} crew from ${planetId} to fleet ${fleetId}`);

    return {
      success: true,
      recruited: quantity,
      qualityBreakdown,
      totalCost,
    };
  }

  /**
   * 품질별 분배
   */
  private distributeByQuality(
    quantity: number,
    distribution: Record<CrewQuality, number>,
    preferredQuality?: CrewQuality,
  ): Record<CrewQuality, number> {
    const result: Record<CrewQuality, number> = {
      [CrewQuality.ELITE]: 0,
      [CrewQuality.VETERAN]: 0,
      [CrewQuality.REGULAR]: 0,
      [CrewQuality.RECRUIT]: 0,
      [CrewQuality.CONSCRIPT]: 0,
    };

    // 선호 품질이 있으면 가중치 조정
    let adjustedDistribution = { ...distribution };
    if (preferredQuality) {
      const boost = 20;
      adjustedDistribution[preferredQuality] = Math.min(100, (adjustedDistribution[preferredQuality] || 0) + boost);
      
      // 다른 품질 조정
      const totalOthers = Object.entries(adjustedDistribution)
        .filter(([q]) => q !== preferredQuality)
        .reduce((sum, [, v]) => sum + v, 0);
      
      for (const q of Object.keys(adjustedDistribution) as CrewQuality[]) {
        if (q !== preferredQuality && totalOthers > 0) {
          adjustedDistribution[q] = adjustedDistribution[q] * (100 - adjustedDistribution[preferredQuality]) / totalOthers;
        }
      }
    }

    // 분배
    let remaining = quantity;
    const qualities = Object.keys(adjustedDistribution) as CrewQuality[];
    
    for (let i = 0; i < qualities.length && remaining > 0; i++) {
      const quality = qualities[i];
      const percent = adjustedDistribution[quality] / 100;
      const count = i === qualities.length - 1 
        ? remaining 
        : Math.floor(quantity * percent);
      
      result[quality] = Math.min(count, remaining);
      remaining -= result[quality];
    }

    return result;
  }

  /**
   * 평균 품질 보너스 계산
   */
  private calculateAvgQualityBonus(qualityBreakdown: Record<CrewQuality, number>): number {
    let totalBonus = 0;
    let totalCount = 0;

    for (const [quality, count] of Object.entries(qualityBreakdown)) {
      const stats = QUALITY_STATS[quality as CrewQuality];
      totalBonus += stats.combatBonus * count;
      totalCount += count;
    }

    return totalCount > 0 ? totalBonus / totalCount : 0;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 행성 징병 풀 조회
   */
  public getRecruitmentPool(sessionId: string, planetId: string): RecruitmentPool | undefined {
    const key = `${sessionId}-${planetId}`;
    return this.recruitmentPools.get(key);
  }

  /**
   * 전체 징병 가능 인원 조회
   */
  public async getTotalRecruitableInFaction(
    sessionId: string,
    factionId: string,
  ): Promise<{
    totalAvailable: number;
    byPlanet: Array<{ planetId: string; planetName: string; available: number }>;
  }> {
    const planets = await Planet.find({ sessionId, ownerId: factionId });
    
    let totalAvailable = 0;
    const byPlanet: Array<{ planetId: string; planetName: string; available: number }> = [];

    for (const planet of planets) {
      const key = `${sessionId}-${planet.planetId}`;
      let pool = this.recruitmentPools.get(key);
      
      if (!pool) {
        pool = this.calculatePlanetPool(planet);
        this.recruitmentPools.set(key, pool);
      }

      totalAvailable += pool.availableCrew;
      byPlanet.push({
        planetId: planet.planetId,
        planetName: planet.name,
        available: pool.availableCrew,
      });
    }

    return { totalAvailable, byPlanet };
  }

  /**
   * 품질 스탯 조회
   */
  public getQualityStats(quality: CrewQuality): typeof QUALITY_STATS[CrewQuality] {
    return QUALITY_STATS[quality];
  }
}

export const recruitmentService = RecruitmentService.getInstance();
export default RecruitmentService;





