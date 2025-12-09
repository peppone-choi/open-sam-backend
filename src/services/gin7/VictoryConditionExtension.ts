/**
 * VictoryConditionExtension - 승리 조건 확장 시스템
 * 다양한 승리 조건 및 패배 조건, 승리 보상 관리
 *
 * 기능:
 * - 군사적/정치적/경제적/문화적/생존/숨겨진 승리 조건
 * - 패배 조건 확인
 * - 승리 보상 계산
 */

import { EventEmitter } from 'events';
import { Planet } from '../../models/gin7/Planet';
import { Fleet } from '../../models/gin7/Fleet';
import { Gin7Character } from '../../models/gin7/Character';
import { Gin7GameSession } from '../../models/gin7/GameSession';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

/**
 * 확장 승리 유형 (VictoryConditionService의 VictoryType과 구분)
 */
export enum ExtVictoryType {
  MILITARY = 'MILITARY',       // 군사적 승리 (적 수도 점령)
  POLITICAL = 'POLITICAL',     // 정치적 승리 (황제 옹립/민주주의 달성)
  ECONOMIC = 'ECONOMIC',       // 경제적 승리 (경제 지배)
  CULTURAL = 'CULTURAL',       // 문화적 승리 (문화 우위)
  SURVIVAL = 'SURVIVAL',       // 생존 승리 (시간 경과)
  HIDDEN = 'HIDDEN',           // 숨겨진 승리 (특수 조건)
}

/**
 * 패배 사유
 */
export enum DefeatReason {
  CAPITAL_LOST = 'CAPITAL_LOST',
  LEADER_KILLED = 'LEADER_KILLED',
  BANKRUPT = 'BANKRUPT',
  REBELLION_OVERTHROW = 'REBELLION_OVERTHROW',
  NO_MILITARY = 'NO_MILITARY',
  SURRENDER = 'SURRENDER',
  TIME_OUT = 'TIME_OUT',
}

/**
 * 승리 요구사항
 */
export interface VictoryRequirement {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  isMet: boolean;
}

/**
 * 승리 조건 상태
 */
export interface VictoryConditionState {
  sessionId: string;
  factionId: string;
  victoryType: ExtVictoryType;
  progress: number;
  requirements: VictoryRequirement[];
  estimatedTurns?: number;
  isAchieved: boolean;
  achievedAt?: Date;
}

/**
 * 승리 보상
 */
export interface VictoryReward {
  famePoints: number;
  experienceBonus: number;
  resourceBonus: number;
  specialUnlocks: string[];
  achievementId?: string;
  rankingBonus: number;
}

/**
 * 승리 체크 결과
 */
export interface ExtVictoryCheckResult {
  hasVictory: boolean;
  victoryType?: ExtVictoryType;
  winnerFactionId?: string;
  explanation: string;
  progress: Record<ExtVictoryType, number>;
}

// ============================================================
// 승리 조건 상수
// ============================================================

const VICTORY_THRESHOLDS = {
  MILITARY: { capitalControl: true, fleetRatio: 10, populationRatio: 0.9 },
  POLITICAL: { supportRating: 80, politicalControl: 70, noRebellion: true },
  ECONOMIC: { gdpDominance: 0.75, tradeControl: 0.8, treasuryMinimum: 50000000 },
};

// ============================================================
// VictoryConditionExtension Class
// ============================================================

export class VictoryConditionExtension extends EventEmitter {
  private static instance: VictoryConditionExtension;
  private conditionStates: Map<string, Map<string, VictoryConditionState[]>> = new Map();

  private constructor() {
    super();
    logger.info('[VictoryConditionExtension] Initialized');
  }

  public static getInstance(): VictoryConditionExtension {
    if (!VictoryConditionExtension.instance) {
      VictoryConditionExtension.instance = new VictoryConditionExtension();
    }
    return VictoryConditionExtension.instance;
  }

  // ============================================================
  // 군사적 승리
  // ============================================================

  public async checkMilitaryVictory(
    sessionId: string,
    factionId: string,
  ): Promise<VictoryConditionState> {
    const requirements: VictoryRequirement[] = [];
    const enemyFactionId = this.getEnemyFaction(factionId);

    const capitalCaptured = await this.isEnemyCapitalCaptured(sessionId, factionId, enemyFactionId);
    requirements.push({
      id: 'capital_captured',
      name: '적 수도 점령',
      description: '적의 수도를 점령해야 합니다.',
      currentValue: capitalCaptured ? 1 : 0,
      targetValue: 1,
      isMet: capitalCaptured,
    });

    const fleetRatio = await this.calculateFleetRatio(sessionId, factionId, enemyFactionId);
    requirements.push({
      id: 'fleet_ratio',
      name: '함정 우위',
      description: `적의 10배 이상 함정 보유 (현재: ${fleetRatio.toFixed(1)}배)`,
      currentValue: fleetRatio,
      targetValue: VICTORY_THRESHOLDS.MILITARY.fleetRatio,
      isMet: fleetRatio >= VICTORY_THRESHOLDS.MILITARY.fleetRatio,
    });

    const populationRatio = await this.calculatePopulationRatio(sessionId, factionId);
    requirements.push({
      id: 'population_dominance',
      name: '인구 지배',
      description: `전체 인구의 90% 이상 지배 (현재: ${(populationRatio * 100).toFixed(1)}%)`,
      currentValue: populationRatio * 100,
      targetValue: VICTORY_THRESHOLDS.MILITARY.populationRatio * 100,
      isMet: populationRatio >= VICTORY_THRESHOLDS.MILITARY.populationRatio,
    });

    const metCount = requirements.filter((r) => r.isMet).length;
    const progress = (metCount / requirements.length) * 100;
    const isAchieved = requirements.every((r) => r.isMet);

    const state: VictoryConditionState = {
      sessionId,
      factionId,
      victoryType: ExtVictoryType.MILITARY,
      progress,
      requirements,
      isAchieved,
      achievedAt: isAchieved ? new Date() : undefined,
    };

    if (isAchieved) {
      this.emit('victory:military', { sessionId, factionId, state });
      logger.info(`[VictoryConditionExtension] Military victory achieved by ${factionId}`);
    }

    return state;
  }

  // ============================================================
  // 정치적 승리
  // ============================================================

  public async checkPoliticalVictory(
    sessionId: string,
    factionId: string,
  ): Promise<VictoryConditionState> {
    const requirements: VictoryRequirement[] = [];

    const supportRating = await this.calculateSupportRating(sessionId, factionId);
    requirements.push({
      id: 'support_rating',
      name: '지지율',
      description: `국민 지지율 80% 이상 (현재: ${supportRating}%)`,
      currentValue: supportRating,
      targetValue: VICTORY_THRESHOLDS.POLITICAL.supportRating,
      isMet: supportRating >= VICTORY_THRESHOLDS.POLITICAL.supportRating,
    });

    const politicalControl = await this.calculatePoliticalControl(sessionId, factionId);
    requirements.push({
      id: 'political_control',
      name: '정치 영향력',
      description: `정치 영향력 70% 이상 (현재: ${politicalControl}%)`,
      currentValue: politicalControl,
      targetValue: VICTORY_THRESHOLDS.POLITICAL.politicalControl,
      isMet: politicalControl >= VICTORY_THRESHOLDS.POLITICAL.politicalControl,
    });

    const hasRebellion = await this.hasActiveRebellion(sessionId, factionId);
    requirements.push({
      id: 'no_rebellion',
      name: '정치 안정',
      description: '활성 반란이 없어야 합니다.',
      currentValue: hasRebellion ? 0 : 1,
      targetValue: 1,
      isMet: !hasRebellion,
    });

    const metCount = requirements.filter((r) => r.isMet).length;
    const progress = (metCount / requirements.length) * 100;
    const isAchieved = requirements.every((r) => r.isMet);

    return {
      sessionId,
      factionId,
      victoryType: ExtVictoryType.POLITICAL,
      progress,
      requirements,
      isAchieved,
      achievedAt: isAchieved ? new Date() : undefined,
    };
  }

  // ============================================================
  // 경제적 승리
  // ============================================================

  public async checkEconomicVictory(
    sessionId: string,
    factionId: string,
  ): Promise<VictoryConditionState> {
    const requirements: VictoryRequirement[] = [];

    const gdpDominance = await this.calculateGDPDominance(sessionId, factionId);
    requirements.push({
      id: 'gdp_dominance',
      name: 'GDP 지배',
      description: `전체 GDP의 75% 이상 (현재: ${(gdpDominance * 100).toFixed(1)}%)`,
      currentValue: gdpDominance * 100,
      targetValue: VICTORY_THRESHOLDS.ECONOMIC.gdpDominance * 100,
      isMet: gdpDominance >= VICTORY_THRESHOLDS.ECONOMIC.gdpDominance,
    });

    const tradeControl = await this.calculateTradeControl(sessionId, factionId);
    requirements.push({
      id: 'trade_control',
      name: '무역 장악',
      description: `전체 무역의 80% 이상 (현재: ${(tradeControl * 100).toFixed(1)}%)`,
      currentValue: tradeControl * 100,
      targetValue: VICTORY_THRESHOLDS.ECONOMIC.tradeControl * 100,
      isMet: tradeControl >= VICTORY_THRESHOLDS.ECONOMIC.tradeControl,
    });

    const treasury = await this.getTreasuryBalance(sessionId, factionId);
    requirements.push({
      id: 'treasury_balance',
      name: '국고 잔고',
      description: `국고 5000만 이상 (현재: ${treasury.toLocaleString()})`,
      currentValue: treasury,
      targetValue: VICTORY_THRESHOLDS.ECONOMIC.treasuryMinimum,
      isMet: treasury >= VICTORY_THRESHOLDS.ECONOMIC.treasuryMinimum,
    });

    const metCount = requirements.filter((r) => r.isMet).length;
    const progress = (metCount / requirements.length) * 100;
    const isAchieved = requirements.every((r) => r.isMet);

    return {
      sessionId,
      factionId,
      victoryType: ExtVictoryType.ECONOMIC,
      progress,
      requirements,
      isAchieved,
      achievedAt: isAchieved ? new Date() : undefined,
    };
  }

  // ============================================================
  // 패배 조건
  // ============================================================

  public async checkDefeatCondition(
    sessionId: string,
    factionId: string,
  ): Promise<{ isDefeated: boolean; reason?: DefeatReason; description?: string }> {
    const isCapitalLost = await this.isOwnCapitalLost(sessionId, factionId);
    if (isCapitalLost) {
      this.emit('defeat:capitalLost', { sessionId, factionId });
      return { isDefeated: true, reason: DefeatReason.CAPITAL_LOST, description: '수도가 점령되었습니다.' };
    }

    const isLeaderDead = await this.isLeaderDead(sessionId, factionId);
    if (isLeaderDead) {
      this.emit('defeat:leaderKilled', { sessionId, factionId });
      return { isDefeated: true, reason: DefeatReason.LEADER_KILLED, description: '지도자가 사망했습니다.' };
    }

    const treasury = await this.getTreasuryBalance(sessionId, factionId);
    if (treasury < -10000000) {
      this.emit('defeat:bankrupt', { sessionId, factionId });
      return { isDefeated: true, reason: DefeatReason.BANKRUPT, description: '국가가 파산했습니다.' };
    }

    const totalFleets = await this.getTotalFleetCount(sessionId, factionId);
    if (totalFleets === 0) {
      this.emit('defeat:noMilitary', { sessionId, factionId });
      return { isDefeated: true, reason: DefeatReason.NO_MILITARY, description: '모든 함대가 소멸했습니다.' };
    }

    return { isDefeated: false };
  }

  // ============================================================
  // 승리 보상
  // ============================================================

  public async calculateVictoryRewards(
    sessionId: string,
    factionId: string,
    victoryType: ExtVictoryType,
  ): Promise<VictoryReward> {
    const baseRewards: Record<ExtVictoryType, Partial<VictoryReward>> = {
      [ExtVictoryType.MILITARY]: { famePoints: 10000, experienceBonus: 500, resourceBonus: 1000000, rankingBonus: 100 },
      [ExtVictoryType.POLITICAL]: { famePoints: 8000, experienceBonus: 400, resourceBonus: 800000, rankingBonus: 80 },
      [ExtVictoryType.ECONOMIC]: { famePoints: 7000, experienceBonus: 350, resourceBonus: 1500000, rankingBonus: 70 },
      [ExtVictoryType.CULTURAL]: { famePoints: 6000, experienceBonus: 300, resourceBonus: 500000, rankingBonus: 60 },
      [ExtVictoryType.SURVIVAL]: { famePoints: 5000, experienceBonus: 250, resourceBonus: 300000, rankingBonus: 50 },
      [ExtVictoryType.HIDDEN]: { famePoints: 15000, experienceBonus: 1000, resourceBonus: 2000000, rankingBonus: 150 },
    };

    const base = baseRewards[victoryType] || {};
    const sessionStats = await this.getSessionStats(sessionId);
    const durationBonus = Math.min(sessionStats.durationDays * 10, 1000);

    return {
      famePoints: (base.famePoints || 5000) + durationBonus,
      experienceBonus: (base.experienceBonus || 200) + sessionStats.playerCount * 50,
      resourceBonus: base.resourceBonus || 500000,
      specialUnlocks: this.getSpecialUnlocks(victoryType),
      achievementId: `VICTORY_${victoryType}_${sessionId}`,
      rankingBonus: base.rankingBonus || 50,
    };
  }

  // ============================================================
  // 전체 승리 체크
  // ============================================================

  public async checkAllVictoryConditions(
    sessionId: string,
    factionId: string,
  ): Promise<ExtVictoryCheckResult> {
    const progress: Record<ExtVictoryType, number> = {
      [ExtVictoryType.MILITARY]: 0,
      [ExtVictoryType.POLITICAL]: 0,
      [ExtVictoryType.ECONOMIC]: 0,
      [ExtVictoryType.CULTURAL]: 0,
      [ExtVictoryType.SURVIVAL]: 0,
      [ExtVictoryType.HIDDEN]: 0,
    };

    const militaryState = await this.checkMilitaryVictory(sessionId, factionId);
    progress[ExtVictoryType.MILITARY] = militaryState.progress;
    if (militaryState.isAchieved) {
      return {
        hasVictory: true,
        victoryType: ExtVictoryType.MILITARY,
        winnerFactionId: factionId,
        explanation: '군사적 승리 달성!',
        progress,
      };
    }

    const politicalState = await this.checkPoliticalVictory(sessionId, factionId);
    progress[ExtVictoryType.POLITICAL] = politicalState.progress;
    if (politicalState.isAchieved) {
      return {
        hasVictory: true,
        victoryType: ExtVictoryType.POLITICAL,
        winnerFactionId: factionId,
        explanation: '정치적 승리 달성!',
        progress,
      };
    }

    const economicState = await this.checkEconomicVictory(sessionId, factionId);
    progress[ExtVictoryType.ECONOMIC] = economicState.progress;
    if (economicState.isAchieved) {
      return {
        hasVictory: true,
        victoryType: ExtVictoryType.ECONOMIC,
        winnerFactionId: factionId,
        explanation: '경제적 승리 달성!',
        progress,
      };
    }

    return {
      hasVictory: false,
      explanation: '아직 승리 조건을 충족하지 못했습니다.',
      progress,
    };
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private getEnemyFaction(factionId: string): string {
    return factionId.toLowerCase().includes('empire') ? 'ALLIANCE' : 'EMPIRE';
  }

  private async isEnemyCapitalCaptured(sessionId: string, factionId: string, enemyFactionId: string): Promise<boolean> {
    try {
      const isEmpire = factionId.toLowerCase().includes('empire');
      const enemyCapitalId = isEmpire ? 'HEINESSEN' : 'ODIN';
      const capital = await Planet.findOne({ sessionId, planetId: enemyCapitalId }).lean();
      return capital?.ownerId === factionId;
    } catch (error) {
      logger.error('[VictoryConditionExtension] isEnemyCapitalCaptured error:', error);
      return false;
    }
  }

  private async isOwnCapitalLost(sessionId: string, factionId: string): Promise<boolean> {
    try {
      const isEmpire = factionId.toLowerCase().includes('empire');
      const ownCapitalId = isEmpire ? 'ODIN' : 'HEINESSEN';
      const capital = await Planet.findOne({ sessionId, planetId: ownCapitalId }).lean();
      return capital?.ownerId !== factionId;
    } catch (error) {
      logger.error('[VictoryConditionExtension] isOwnCapitalLost error:', error);
      return false;
    }
  }

  private async calculateFleetRatio(sessionId: string, factionId: string, enemyFactionId: string): Promise<number> {
    try {
      const ourFleets = await Fleet.find({ sessionId, factionId }).lean();
      const enemyFleets = await Fleet.find({ sessionId, factionId: enemyFactionId }).lean();
      const ourCount = ourFleets.reduce((sum, f) => sum + (f.units?.reduce((s, u) => s + (u.currentShipCount || 0), 0) || 0), 0);
      const enemyCount = enemyFleets.reduce((sum, f) => sum + (f.units?.reduce((s, u) => s + (u.currentShipCount || 0), 0) || 0), 0);
      return enemyCount > 0 ? ourCount / enemyCount : Infinity;
    } catch (error) {
      logger.error('[VictoryConditionExtension] calculateFleetRatio error:', error);
      return 0;
    }
  }

  private async calculatePopulationRatio(sessionId: string, factionId: string): Promise<number> {
    try {
      const allPlanets = await Planet.find({ sessionId }).lean();
      const totalPop = allPlanets.reduce((sum, p) => sum + (p.population || 0), 0);
      const ourPop = allPlanets.filter((p) => p.ownerId === factionId).reduce((sum, p) => sum + (p.population || 0), 0);
      return totalPop > 0 ? ourPop / totalPop : 0;
    } catch (error) {
      logger.error('[VictoryConditionExtension] calculatePopulationRatio error:', error);
      return 0;
    }
  }

  private async calculateSupportRating(sessionId: string, factionId: string): Promise<number> {
    try {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      if (planets.length === 0) return 0;
      const avgSatisfaction = planets.reduce((sum, p: any) => sum + (p.satisfaction || 50), 0) / planets.length;
      return Math.round(avgSatisfaction);
    } catch (error) {
      logger.error('[VictoryConditionExtension] calculateSupportRating error:', error);
      return 50;
    }
  }

  private async calculatePoliticalControl(sessionId: string, factionId: string): Promise<number> {
    try {
      const characters = await Gin7Character.find({ sessionId, factionId }).lean();
      const politicalPower = characters.reduce((sum, c: any) => sum + (c.currentPosition?.authorityLevel || 1), 0);
      return Math.min(100, politicalPower * 5);
    } catch (error) {
      logger.error('[VictoryConditionExtension] calculatePoliticalControl error:', error);
      return 0;
    }
  }

  private async hasActiveRebellion(sessionId: string, factionId: string): Promise<boolean> {
    try {
      const session = await Gin7GameSession.findOne({ sessionId }).lean();
      const events = (session?.data as any)?.events || [];
      return events.some((e: any) => e.type === 'REBELLION' && e.factionId === factionId && e.status === 'ACTIVE');
    } catch (error) {
      logger.error('[VictoryConditionExtension] hasActiveRebellion error:', error);
      return false;
    }
  }

  private async calculateGDPDominance(sessionId: string, factionId: string): Promise<number> {
    try {
      const allPlanets = await Planet.find({ sessionId }).lean();
      const totalGDP = allPlanets.reduce((sum, p) => sum + (p.population || 0) * 100, 0);
      const ourGDP = allPlanets.filter((p) => p.ownerId === factionId).reduce((sum, p) => sum + (p.population || 0) * 100, 0);
      return totalGDP > 0 ? ourGDP / totalGDP : 0;
    } catch (error) {
      logger.error('[VictoryConditionExtension] calculateGDPDominance error:', error);
      return 0;
    }
  }

  private async calculateTradeControl(sessionId: string, factionId: string): Promise<number> {
    const populationRatio = await this.calculatePopulationRatio(sessionId, factionId);
    return populationRatio * 0.9;
  }

  private async getTreasuryBalance(sessionId: string, factionId: string): Promise<number> {
    try {
      const session = await Gin7GameSession.findOne({ sessionId }).lean();
      return (session?.data as any)?.factions?.[factionId]?.treasury || 0;
    } catch (error) {
      logger.error('[VictoryConditionExtension] getTreasuryBalance error:', error);
      return 0;
    }
  }

  private async getTotalFleetCount(sessionId: string, factionId: string): Promise<number> {
    try {
      const fleets = await Fleet.find({ sessionId, factionId }).lean();
      return fleets.reduce((sum, f) => sum + (f.units?.reduce((s, u) => s + (u.currentShipCount || 0), 0) || 0), 0);
    } catch (error) {
      logger.error('[VictoryConditionExtension] getTotalFleetCount error:', error);
      return 0;
    }
  }

  private async isLeaderDead(sessionId: string, factionId: string): Promise<boolean> {
    try {
      const leader = await Gin7Character.findOne({
        sessionId,
        factionId,
        $or: [
          { 'currentPosition.positionId': 'EMPEROR' },
          { 'currentPosition.positionId': 'SUPREME_COMMANDER' },
        ],
      }).lean();
      return leader ? leader.status !== 'ACTIVE' : true;
    } catch (error) {
      logger.error('[VictoryConditionExtension] isLeaderDead error:', error);
      return false;
    }
  }

  private async getSessionStats(sessionId: string): Promise<{ durationDays: number; playerCount: number }> {
    try {
      const session = await Gin7GameSession.findOne({ sessionId }).lean();
      const startDate = session?.timeConfig?.gameStartDate;
      const currentDate = session?.currentState?.gameDate;
      let durationDays = 0;
      if (startDate && currentDate) {
        const start = new Date(startDate.year, startDate.month - 1, startDate.day);
        const current = new Date(currentDate);
        durationDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
      const characters = await Gin7Character.countDocuments({ sessionId, playerId: { $exists: true, $ne: null } });
      return { durationDays, playerCount: characters };
    } catch (error) {
      logger.error('[VictoryConditionExtension] getSessionStats error:', error);
      return { durationDays: 0, playerCount: 0 };
    }
  }

  private getSpecialUnlocks(victoryType: ExtVictoryType): string[] {
    const unlocks: Record<ExtVictoryType, string[]> = {
      [ExtVictoryType.MILITARY]: ['TITLE_CONQUEROR', 'SHIP_CLASS_ELITE'],
      [ExtVictoryType.POLITICAL]: ['TITLE_DIPLOMAT', 'POLITICAL_BONUS'],
      [ExtVictoryType.ECONOMIC]: ['TITLE_TYCOON', 'TRADE_BONUS'],
      [ExtVictoryType.CULTURAL]: ['TITLE_PATRON', 'CULTURAL_BONUS'],
      [ExtVictoryType.SURVIVAL]: ['TITLE_SURVIVOR', 'DEFENSE_BONUS'],
      [ExtVictoryType.HIDDEN]: ['TITLE_MASTERMIND', 'SECRET_UNLOCK'],
    };
    return unlocks[victoryType] || [];
  }

  public cleanup(sessionId: string): void {
    this.conditionStates.delete(sessionId);
    logger.info(`[VictoryConditionExtension] Cleaned up session: ${sessionId}`);
  }
}

export const victoryConditionExtension = VictoryConditionExtension.getInstance();
export default VictoryConditionExtension;
