import mongoose from 'mongoose';
import { PlanetSupport, IPlanetSupport, RiotStatus, ISupportFactor } from '../../models/gin7/PlanetSupport';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { NationalTreasury } from '../../models/gin7/NationalTreasury';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * 지지율 영향 요소 타입
 */
export type SupportFactorType = 
  | 'tax_rate'           // 세율 영향
  | 'welfare'            // 복지 투자
  | 'war_damage'         // 전쟁 피해
  | 'facility'           // 시설 효과 (병원, 오락시설 등)
  | 'leader_charisma'    // 지도자 카리스마
  | 'propaganda'         // 선전 활동
  | 'occupation'         // 점령 패널티
  | 'liberation'         // 해방 보너스
  | 'event';             // 이벤트 효과

/**
 * 폭동 진압 결과
 */
export interface IRiotSuppressionResult {
  success: boolean;
  previousStatus: RiotStatus;
  newStatus: RiotStatus;
  casualties?: number;
  damageAmount?: number;
  supportImpact?: number;
  error?: string;
}

/**
 * PublicOrderService
 * 행성별 지지율/치안/폭동 관리
 */
export class PublicOrderService {
  /**
   * 행성 지지율 데이터 조회
   */
  static async getPlanetSupport(
    sessionId: string,
    planetId: string
  ): Promise<IPlanetSupport | null> {
    return PlanetSupport.findOne({ sessionId, planetId });
  }

  /**
   * 세력의 모든 행성 지지율 조회
   */
  static async getFactionSupport(
    sessionId: string,
    factionId: string
  ): Promise<IPlanetSupport[]> {
    return PlanetSupport.find({ sessionId, factionId })
      .sort({ supportRate: 1 }); // 낮은 지지율 우선
  }

  /**
   * 행성 지지율 데이터 생성 (새 점령 행성용)
   */
  static async createPlanetSupport(
    sessionId: string,
    planet: IPlanet,
    factionId: string,
    isLiberation: boolean = false
  ): Promise<IPlanetSupport> {
    const supportId = `SUP-${planet.planetId}-${Date.now()}`;
    
    // 점령 vs 해방에 따른 초기 지지율 결정
    const initialSupport = isLiberation ? 70 : 30;
    const initialFactors: ISupportFactor[] = [];

    if (isLiberation) {
      initialFactors.push({
        factorType: 'liberation',
        value: 20,
        description: '해방 보너스',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후 만료
      });
    } else {
      initialFactors.push({
        factorType: 'occupation',
        value: -30,
        description: '점령 패널티',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60일 후 만료
      });
    }

    const support = new PlanetSupport({
      supportId,
      sessionId,
      planetId: planet.planetId,
      planetName: planet.name,
      factionId,
      supportRate: initialSupport,
      baseSupportRate: initialSupport,
      securityLevel: 40,
      policeStrength: 30,
      supportFactors: initialFactors
    });

    await support.save();
    return support;
  }

  /**
   * 지지율 영향 요소 추가
   */
  static async addSupportFactor(
    sessionId: string,
    planetId: string,
    factor: {
      factorType: SupportFactorType;
      value: number;
      description: string;
      durationDays?: number;
    }
  ): Promise<{ success: boolean; newSupportRate?: number; error?: string }> {
    const support = await PlanetSupport.findOne({ sessionId, planetId });

    if (!support) {
      return { success: false, error: 'Planet support data not found' };
    }

    const expiresAt = factor.durationDays 
      ? new Date(Date.now() + factor.durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    // 같은 타입의 기존 요소가 있으면 업데이트
    const existingIndex = support.supportFactors.findIndex(
      (f: ISupportFactor) => f.factorType === factor.factorType
    );

    if (existingIndex >= 0) {
      support.supportFactors[existingIndex] = {
        factorType: factor.factorType,
        value: factor.value,
        description: factor.description,
        expiresAt
      };
    } else {
      support.supportFactors.push({
        factorType: factor.factorType,
        value: factor.value,
        description: factor.description,
        expiresAt
      });
    }

    // 지지율 재계산
    support.supportRate = support.calculateEffectiveSupportRate();
    support.lastUpdated = new Date();
    await support.save();

    return { success: true, newSupportRate: support.supportRate };
  }

  /**
   * 만료된 지지율 요소 정리
   */
  static async cleanupExpiredFactors(
    sessionId: string,
    planetId?: string
  ): Promise<number> {
    const query: Record<string, unknown> = { sessionId };
    if (planetId) {
      query.planetId = planetId;
    }

    const supports = await PlanetSupport.find(query);
    const now = new Date();
    let cleanedCount = 0;

    for (const support of supports) {
      const originalLength = support.supportFactors.length;
      support.supportFactors = support.supportFactors.filter((f: ISupportFactor) => 
        !f.expiresAt || f.expiresAt > now
      );
      
      if (support.supportFactors.length !== originalLength) {
        support.supportRate = support.calculateEffectiveSupportRate();
        support.lastUpdated = new Date();
        await support.save();
        cleanedCount += originalLength - support.supportFactors.length;
      }
    }

    return cleanedCount;
  }

  /**
   * 세율이 지지율에 미치는 영향 계산 및 적용
   */
  static async applyTaxRateEffect(
    sessionId: string,
    factionId: string
  ): Promise<void> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });
    if (!treasury) return;

    const effectiveTaxRate = treasury.taxPolicy.baseTaxRate +
      (treasury.taxPolicy.isEmergencyTax ? treasury.taxPolicy.warTaxRate : 0);

    // 세율 10% 기준, 초과분당 -2 지지율
    const taxImpact = Math.floor((effectiveTaxRate - 0.1) * 20) * -1;
    
    const supports = await PlanetSupport.find({ sessionId, factionId });

    for (const support of supports) {
      await this.addSupportFactor(sessionId, support.planetId, {
        factorType: 'tax_rate',
        value: taxImpact,
        description: `세율 ${(effectiveTaxRate * 100).toFixed(1)}% 영향`
      });
    }
  }

  /**
   * 복지 투자 효과 적용
   */
  static async applyWelfareInvestment(
    sessionId: string,
    planetId: string,
    investmentAmount: number
  ): Promise<{ success: boolean; supportBonus: number; error?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, supportBonus: 0, error: 'Planet not found' };
    }

    // 인구 대비 투자액으로 효과 계산
    const perCapita = investmentAmount / (planet.population / 1000);
    const supportBonus = Math.min(20, Math.floor(perCapita / 10));

    await this.addSupportFactor(sessionId, planetId, {
      factorType: 'welfare',
      value: supportBonus,
      description: `복지 투자 ${investmentAmount} 크레딧`,
      durationDays: 30
    });

    return { success: true, supportBonus };
  }

  /**
   * 군대 주둔 설정
   */
  static async setMilitaryPresence(
    sessionId: string,
    planetId: string,
    troopStrength: number
  ): Promise<{ success: boolean; newSecurityLevel?: number; error?: string }> {
    const support = await PlanetSupport.findOne({ sessionId, planetId });
    if (!support) {
      return { success: false, error: 'Planet support data not found' };
    }

    support.militaryPresence = troopStrength;
    support.securityLevel = support.calculateEffectiveSecurityLevel();
    support.lastUpdated = new Date();
    await support.save();

    return { success: true, newSecurityLevel: support.securityLevel };
  }

  /**
   * 경찰력 설정
   */
  static async setPoliceStrength(
    sessionId: string,
    planetId: string,
    strength: number
  ): Promise<{ success: boolean; newSecurityLevel?: number; error?: string }> {
    const support = await PlanetSupport.findOne({ sessionId, planetId });
    if (!support) {
      return { success: false, error: 'Planet support data not found' };
    }

    support.policeStrength = Math.max(0, Math.min(100, strength));
    support.securityLevel = support.calculateEffectiveSecurityLevel();
    support.lastUpdated = new Date();
    await support.save();

    return { success: true, newSecurityLevel: support.securityLevel };
  }

  /**
   * 일일 폭동 상태 업데이트
   */
  static async processDailyRiotUpdate(
    sessionId: string,
    gameDay: number
  ): Promise<{
    updatedPlanets: number;
    newRiots: string[];
    suppressedRiots: string[];
    escalatedRiots: string[];
  }> {
    const supports = await PlanetSupport.find({ sessionId });
    
    const result = {
      updatedPlanets: 0,
      newRiots: [] as string[],
      suppressedRiots: [] as string[],
      escalatedRiots: [] as string[]
    };

    for (const support of supports) {
      const previousStatus = support.riotStatus;
      
      // 폭동 상태 업데이트
      support.updateRiotStatus();

      // 지지율 기록
      support.supportHistory.push({
        gameDay,
        supportRate: support.supportRate,
        securityLevel: support.securityLevel
      });

      // 최근 30일 기록만 유지
      if (support.supportHistory.length > 30) {
        support.supportHistory = support.supportHistory.slice(-30);
      }

      // 상태 변화 추적
      if (previousStatus === 'none' && support.riotStatus !== 'none') {
        result.newRiots.push(support.planetName);
        
        // 폭동 기록 추가
        support.riotHistory.push({
          riotId: `RIOT-${support.planetId}-${Date.now()}`,
          startedAt: new Date(),
          peakSeverity: support.riotStatus,
          damageAmount: 0,
          casualties: 0
        });
      } else if (previousStatus !== 'none' && support.riotStatus === 'none') {
        result.suppressedRiots.push(support.planetName);
        
        // 폭동 기록 종료
        const currentRiot = support.riotHistory.find(
          (r: { endedAt?: Date }) => !r.endedAt
        );
        if (currentRiot) {
          currentRiot.endedAt = new Date();
        }
      } else if (
        this.getRiotSeverityLevel(support.riotStatus) > 
        this.getRiotSeverityLevel(previousStatus)
      ) {
        result.escalatedRiots.push(support.planetName);
        
        // 최고 심각도 업데이트
        const currentRiot = support.riotHistory.find(
          (r: { endedAt?: Date }) => !r.endedAt
        );
        if (currentRiot && 
            this.getRiotSeverityLevel(support.riotStatus) > 
            this.getRiotSeverityLevel(currentRiot.peakSeverity)) {
          currentRiot.peakSeverity = support.riotStatus;
        }
      }

      support.lastUpdated = new Date();
      await support.save();
      result.updatedPlanets++;
    }

    return result;
  }

  /**
   * 폭동 심각도 레벨 반환
   */
  private static getRiotSeverityLevel(status: RiotStatus): number {
    const levels: Record<RiotStatus, number> = {
      none: 0,
      suppressed: 1,
      unrest: 2,
      protest: 3,
      riot: 4,
      rebellion: 5
    };
    return levels[status] ?? 0;
  }

  /**
   * 폭동 진압 (군사적)
   */
  static async suppressRiotMilitary(
    sessionId: string,
    planetId: string,
    forceStrength: number
  ): Promise<IRiotSuppressionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const support = await PlanetSupport.findOne({
        sessionId,
        planetId
      }).session(session);

      if (!support) {
        throw new Gin7Error('NOT_FOUND', 'Planet support data not found');
      }

      if (support.riotStatus === 'none' || support.riotStatus === 'suppressed') {
        return {
          success: true,
          previousStatus: support.riotStatus,
          newStatus: support.riotStatus
        };
      }

      const previousStatus = support.riotStatus;
      
      // 진압 성공 확률 계산
      const suppressionPower = forceStrength * 0.5 + support.policeStrength * 0.3;
      const riotResistance = support.riotSeverity;
      const successChance = Math.min(0.9, suppressionPower / (riotResistance + 10));
      
      // 진압 결과
      const isSuccess = Math.random() < successChance;
      
      let casualties = 0;
      let damageAmount = 0;
      let supportImpact = 0;

      if (isSuccess) {
        // 진압 성공
        support.riotSeverity = Math.max(0, support.riotSeverity - forceStrength * 0.8);
        support.riotStatus = 'suppressed';
        
        // 사상자 발생
        casualties = Math.floor(Math.random() * (forceStrength * 0.1));
        
        // 지지율 하락 (군사적 진압 부작용)
        supportImpact = -Math.floor(forceStrength * 0.1);
        support.baseSupportRate = Math.max(0, support.baseSupportRate + supportImpact);
        
        // 폭동 기록 업데이트
        const currentRiot = support.riotHistory.find((r: { endedAt?: Date }) => !r.endedAt);
        if (currentRiot) {
          currentRiot.endedAt = new Date();
          currentRiot.casualties = casualties;
          currentRiot.suppressionMethod = 'military';
        }
      } else {
        // 진압 실패, 상황 악화
        support.riotSeverity = Math.min(100, support.riotSeverity + 10);
        damageAmount = Math.floor(Math.random() * 10000);
        
        // 시설 피해
        const planet = await Planet.findOne({ sessionId, planetId }).session(session);
        if (planet) {
          // 무작위 시설에 피해
          for (const facility of planet.facilities) {
            if (Math.random() < 0.2) {
              facility.hp = Math.max(0, facility.hp - Math.floor(Math.random() * 30));
              if (facility.hp === 0) {
                facility.isOperational = false;
              }
            }
          }
          await planet.save({ session });
        }

        // 폭동 기록 업데이트
        const currentRiot = support.riotHistory.find((r: { endedAt?: Date }) => !r.endedAt);
        if (currentRiot) {
          currentRiot.damageAmount += damageAmount;
        }
      }

      support.updateProductionPenalty();
      support.lastUpdated = new Date();
      await support.save({ session });

      await session.commitTransaction();

      return {
        success: isSuccess,
        previousStatus,
        newStatus: support.riotStatus,
        casualties,
        damageAmount,
        supportImpact
      };

    } catch (error) {
      await session.abortTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        previousStatus: 'none',
        newStatus: 'none',
        error: message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * 폭동 진압 (협상/양보)
   */
  static async suppressRiotNegotiation(
    sessionId: string,
    planetId: string,
    concessionType: 'tax_cut' | 'welfare_increase' | 'autonomy_grant'
  ): Promise<IRiotSuppressionResult> {
    const support = await PlanetSupport.findOne({ sessionId, planetId });

    if (!support) {
      return {
        success: false,
        previousStatus: 'none',
        newStatus: 'none',
        error: 'Planet support data not found'
      };
    }

    if (support.riotStatus === 'none' || support.riotStatus === 'suppressed') {
      return {
        success: true,
        previousStatus: support.riotStatus,
        newStatus: support.riotStatus
      };
    }

    const previousStatus = support.riotStatus;

    // 양보 효과 적용
    let supportBonus = 0;
    let description = '';

    switch (concessionType) {
      case 'tax_cut':
        supportBonus = 15;
        description = '세금 감면 양보';
        break;
      case 'welfare_increase':
        supportBonus = 20;
        description = '복지 증가 약속';
        break;
      case 'autonomy_grant':
        supportBonus = 25;
        description = '자치권 확대 양보';
        break;
    }

    // 지지율 요소 추가
    support.supportFactors.push({
      factorType: 'event',
      value: supportBonus,
      description,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90일
    });

    // 폭동 심각도 감소
    support.riotSeverity = Math.max(0, support.riotSeverity - 40);
    
    if (support.riotSeverity <= 10) {
      support.riotStatus = 'suppressed';
      
      // 폭동 기록 종료
      const currentRiot = support.riotHistory.find((r: { endedAt?: Date }) => !r.endedAt);
      if (currentRiot) {
        currentRiot.endedAt = new Date();
        currentRiot.suppressionMethod = concessionType === 'tax_cut' ? 'concession' : 'negotiation';
        currentRiot.resolutionNote = description;
      }
    } else if (support.riotSeverity <= 30) {
      support.riotStatus = 'unrest';
    } else {
      support.riotStatus = 'protest';
    }

    support.supportRate = support.calculateEffectiveSupportRate();
    support.updateProductionPenalty();
    support.lastUpdated = new Date();
    await support.save();

    return {
      success: true,
      previousStatus,
      newStatus: support.riotStatus,
      supportImpact: supportBonus
    };
  }

  /**
   * 세력 전체 지지율 요약
   */
  static async getFactionSupportSummary(
    sessionId: string,
    factionId: string
  ): Promise<{
    averageSupportRate: number;
    averageSecurityLevel: number;
    planetsInRiot: number;
    totalPlanets: number;
    lowestSupport: { planetName: string; supportRate: number } | null;
    highestRisk: { planetName: string; riskLevel: number } | null;
  }> {
    const supports = await PlanetSupport.find({ sessionId, factionId });

    if (supports.length === 0) {
      return {
        averageSupportRate: 0,
        averageSecurityLevel: 0,
        planetsInRiot: 0,
        totalPlanets: 0,
        lowestSupport: null,
        highestRisk: null
      };
    }

    let totalSupport = 0;
    let totalSecurity = 0;
    let planetsInRiot = 0;
    let lowestSupport: { planetName: string; supportRate: number } | null = null;
    let highestRisk: { planetName: string; riskLevel: number } | null = null;

    for (const support of supports) {
      totalSupport += support.supportRate;
      totalSecurity += support.securityLevel;

      if (support.riotStatus !== 'none' && support.riotStatus !== 'suppressed') {
        planetsInRiot++;
      }

      if (!lowestSupport || support.supportRate < lowestSupport.supportRate) {
        lowestSupport = {
          planetName: support.planetName,
          supportRate: support.supportRate
        };
      }

      const riskLevel = support.calculateRiotRisk();
      if (!highestRisk || riskLevel > highestRisk.riskLevel) {
        highestRisk = {
          planetName: support.planetName,
          riskLevel
        };
      }
    }

    return {
      averageSupportRate: Math.round(totalSupport / supports.length),
      averageSecurityLevel: Math.round(totalSecurity / supports.length),
      planetsInRiot,
      totalPlanets: supports.length,
      lowestSupport,
      highestRisk
    };
  }

  /**
   * 위험 행성 목록 (폭동 위험 높은 행성)
   */
  static async getRiskyPlanets(
    sessionId: string,
    factionId: string,
    riskThreshold: number = 50
  ): Promise<Array<{
    planetId: string;
    planetName: string;
    supportRate: number;
    securityLevel: number;
    riotRisk: number;
    riotStatus: RiotStatus;
  }>> {
    const supports = await PlanetSupport.find({ sessionId, factionId });

    const riskyPlanets: Array<{
      planetId: string;
      planetName: string;
      supportRate: number;
      securityLevel: number;
      riotRisk: number;
      riotStatus: RiotStatus;
    }> = [];

    for (const support of supports) {
      const riotRisk = support.calculateRiotRisk();
      
      if (riotRisk >= riskThreshold || support.riotStatus !== 'none') {
        riskyPlanets.push({
          planetId: support.planetId,
          planetName: support.planetName,
          supportRate: support.supportRate,
          securityLevel: support.securityLevel,
          riotRisk,
          riotStatus: support.riotStatus
        });
      }
    }

    // 위험도 높은 순으로 정렬
    return riskyPlanets.sort((a, b) => b.riotRisk - a.riotRisk);
  }
}

export default PublicOrderService;

