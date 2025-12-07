/**
 * GIN7 Stats Growth Service
 * 
 * 경험치 누적 및 능력치 성장 시스템
 * CP 소모 비례 경험치 획득 및 레벨업 처리
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 * @see agents/gin7-agents/gin7-legacy-analyst/formulas/personnel.ts
 * 
 * 경험치 시스템:
 * - PCP 소모 → 정치/운영/통솔/정보 경험치
 * - MCP 소모 → 지휘/기동/공격/방어 경험치
 * - 경험치 100 누적 → 해당 스탯 +1
 * 
 * 노화 시스템:
 * - 청년기 (18-35): 성장 보너스 x1.2
 * - 장년기 (36-50): 기본 성장 x1.0
 * - 중년기 (51-65): 성장 감소 x0.8, 능력치 감소 시작
 * - 노년기 (66+): 성장 거의 없음 x0.3, 능력치 감소 가속
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS, DayStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================================
// Types & Constants
// ============================================================================

/** 능력치 종류 */
export enum StatType {
  // 기본 스탯 (Character 모델)
  COMMAND = 'command',     // 통솔
  MIGHT = 'might',         // 무력
  INTELLECT = 'intellect', // 지력
  POLITICS = 'politics',   // 정치
  CHARM = 'charm',         // 매력
  
  // 확장 스탯 (extendedStats)
  OPERATION = 'operation',     // 운영
  INTELLIGENCE = 'intelligence', // 정보
  MOBILITY = 'mobility',       // 기동
  ATTACK = 'attack',           // 공격
  DEFENSE = 'defense',         // 방어
}

/** CP 종류별 경험치 매핑 */
export const CP_TO_EXP_MAP: Record<'pcp' | 'mcp', StatType[]> = {
  pcp: [StatType.POLITICS, StatType.OPERATION, StatType.COMMAND, StatType.INTELLIGENCE],
  mcp: [StatType.COMMAND, StatType.MOBILITY, StatType.ATTACK, StatType.DEFENSE],
};

/** 경험치 레벨업 기준 */
export const EXP_PER_LEVEL = 100;

/** 스탯 최대값 */
export const MAX_STAT = 100;

/** 나이대별 성장 배율 */
export const AGE_GROWTH_MULTIPLIER = {
  YOUTH: { minAge: 18, maxAge: 35, multiplier: 1.2, decay: 0 },
  ADULT: { minAge: 36, maxAge: 50, multiplier: 1.0, decay: 0 },
  MIDDLE: { minAge: 51, maxAge: 65, multiplier: 0.8, decay: 0.1 },
  ELDER: { minAge: 66, maxAge: 999, multiplier: 0.3, decay: 0.3 },
};

/** 경험치 획득 이벤트 */
export interface ExpGainEvent {
  sessionId: string;
  characterId: string;
  cpType: 'pcp' | 'mcp';
  cpAmount: number;
  expGained: Record<StatType, number>;
  levelUps: Array<{ stat: StatType; oldValue: number; newValue: number }>;
}

/** 노화 이벤트 */
export interface AgingEvent {
  sessionId: string;
  characterId: string;
  newAge: number;
  ageCategory: keyof typeof AGE_GROWTH_MULTIPLIER;
  statDecay: Record<StatType, number>;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class StatsGrowthService extends EventEmitter {
  private static instance: StatsGrowthService;
  private isSubscribed: boolean = false;
  
  // 캐릭터별 경험치 캐시 (세션 중 빠른 접근용)
  private expCache: Map<string, Record<StatType, number>> = new Map();
  
  private constructor() {
    super();
  }
  
  public static getInstance(): StatsGrowthService {
    if (!StatsGrowthService.instance) {
      StatsGrowthService.instance = new StatsGrowthService();
    }
    return StatsGrowthService.instance;
  }
  
  // ==========================================================================
  // TimeEngine Integration (노화 처리)
  // ==========================================================================
  
  /**
   * DAY_START 이벤트 구독 (노화 처리용)
   */
  public subscribe(): void {
    if (this.isSubscribed) {
      logger.warn('[StatsGrowthService] Already subscribed');
      return;
    }
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.on(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    this.isSubscribed = true;
    
    logger.info('[StatsGrowthService] Subscribed to TimeEngine DAY_START');
  }
  
  public unsubscribe(): void {
    if (!this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.off(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    this.isSubscribed = false;
  }
  
  /**
   * 일일 노화 체크 (매월 1일에만 처리)
   */
  private async handleDayStart(payload: DayStartPayload): Promise<void> {
    const { sessionId, day, month, year } = payload;
    
    // 매년 1월 1일에만 노화 처리
    if (month !== 1 || day !== 1) return;
    
    logger.info('[StatsGrowthService] Processing yearly aging', { sessionId, year });
    
    try {
      await this.processYearlyAging(sessionId, year);
    } catch (error) {
      logger.error('[StatsGrowthService] Aging process failed', { sessionId, error });
    }
  }
  
  // ==========================================================================
  // Experience Gain
  // ==========================================================================
  
  /**
   * CP 소모 시 경험치 획득
   * gin7-auth-card에서 호출
   */
  async onCPConsumed(
    sessionId: string,
    characterId: string,
    cpType: 'pcp' | 'mcp',
    cpAmount: number
  ): Promise<ExpGainEvent> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    // 나이 계산 및 성장 배율 결정
    const age = this.calculateAge(character, sessionId);
    const ageCategory = this.getAgeCategory(age);
    const growthMultiplier = AGE_GROWTH_MULTIPLIER[ageCategory].multiplier;
    
    // 경험치 획득 (CP 1당 경험치 1)
    const baseExp = cpAmount;
    const targetStats = CP_TO_EXP_MAP[cpType];
    
    // 경험치 분배 (균등 분배, 나이 배율 적용)
    const expPerStat = Math.floor((baseExp * growthMultiplier) / targetStats.length);
    
    const expGained: Record<StatType, number> = {} as Record<StatType, number>;
    const levelUps: Array<{ stat: StatType; oldValue: number; newValue: number }> = [];
    
    // 캐시에서 현재 경험치 로드
    const cacheKey = `${sessionId}:${characterId}`;
    let currentExp = this.expCache.get(cacheKey) || this.loadExpFromCharacter(character);
    
    for (const stat of targetStats) {
      // 경험치 추가
      const oldExp = currentExp[stat] || 0;
      const newExp = oldExp + expPerStat;
      expGained[stat] = expPerStat;
      
      // 레벨업 체크
      const oldLevel = Math.floor(oldExp / EXP_PER_LEVEL);
      const newLevel = Math.floor(newExp / EXP_PER_LEVEL);
      
      if (newLevel > oldLevel) {
        const levelGain = newLevel - oldLevel;
        const oldValue = this.getStatValue(character, stat);
        const newValue = Math.min(MAX_STAT, oldValue + levelGain);
        
        if (newValue > oldValue) {
          levelUps.push({ stat, oldValue, newValue });
          await this.updateStatValue(sessionId, characterId, stat, newValue);
        }
      }
      
      // 경험치는 레벨업 후 나머지만 보존
      currentExp[stat] = newExp % EXP_PER_LEVEL;
    }
    
    // 캐시 업데이트
    this.expCache.set(cacheKey, currentExp);
    
    // DB에 경험치 저장
    await this.saveExpToCharacter(sessionId, characterId, currentExp);
    
    const event: ExpGainEvent = {
      sessionId,
      characterId,
      cpType,
      cpAmount,
      expGained,
      levelUps,
    };
    
    if (levelUps.length > 0) {
      this.emit('stats:levelup', event);
      logger.info('[StatsGrowthService] Level up', {
        sessionId,
        characterId,
        levelUps,
      });
    }
    
    return event;
  }
  
  /**
   * 전투 경험치 획득
   */
  async onBattleExperience(
    sessionId: string,
    characterId: string,
    damage: number,
    isAttacker: boolean
  ): Promise<ExpGainEvent> {
    // 레거시 공식 적용
    const baseExp = damage / 50;
    const exp = isAttacker ? baseExp : baseExp * 0.8;
    
    // 전투 경험치는 MCP 관련 스탯에 분배
    const cpAmount = Math.floor(exp);
    
    return this.onCPConsumed(sessionId, characterId, 'mcp', cpAmount);
  }
  
  // ==========================================================================
  // Aging System
  // ==========================================================================
  
  /**
   * 연간 노화 처리
   */
  private async processYearlyAging(sessionId: string, year: number): Promise<void> {
    // 활성 캐릭터 조회
    const characters = await Gin7Character.find({
      sessionId,
      state: { $ne: 'dead' },
    });
    
    let agedCount = 0;
    let decayedCount = 0;
    
    for (const character of characters) {
      const age = this.calculateAge(character, sessionId);
      const ageCategory = this.getAgeCategory(age);
      const decayRate = AGE_GROWTH_MULTIPLIER[ageCategory].decay;
      
      // 능력치 감소 처리
      if (decayRate > 0) {
        const statDecay = await this.applyAgingDecay(
          sessionId, 
          character.characterId, 
          character, 
          decayRate
        );
        
        if (Object.values(statDecay).some(v => v > 0)) {
          decayedCount++;
          
          this.emit('aging:decay', {
            sessionId,
            characterId: character.characterId,
            newAge: age,
            ageCategory,
            statDecay,
          } as AgingEvent);
        }
      }
      
      agedCount++;
    }
    
    logger.info('[StatsGrowthService] Yearly aging completed', {
      sessionId,
      year,
      totalCharacters: agedCount,
      decayedCharacters: decayedCount,
    });
  }
  
  /**
   * 노화에 의한 능력치 감소
   */
  private async applyAgingDecay(
    sessionId: string,
    characterId: string,
    character: IGin7Character,
    decayRate: number
  ): Promise<Record<StatType, number>> {
    const statDecay: Record<StatType, number> = {} as Record<StatType, number>;
    
    // 각 스탯에 대해 확률적으로 감소 적용
    const baseStats: StatType[] = [
      StatType.COMMAND, 
      StatType.MIGHT, 
      StatType.INTELLECT, 
      StatType.POLITICS, 
      StatType.CHARM
    ];
    
    for (const stat of baseStats) {
      const currentValue = this.getStatValue(character, stat);
      
      // decayRate 확률로 1 감소
      if (Math.random() < decayRate && currentValue > 1) {
        const newValue = currentValue - 1;
        await this.updateStatValue(sessionId, characterId, stat, newValue);
        statDecay[stat] = 1;
      } else {
        statDecay[stat] = 0;
      }
    }
    
    return statDecay;
  }
  
  /**
   * 나이 계산
   */
  private calculateAge(character: IGin7Character, sessionId: string): number {
    // data.birthDate에서 생년월일 조회
    const birthDate = character.data?.birthDate as Date | undefined;
    if (!birthDate) return 30; // 기본값
    
    // TimeEngine에서 현재 게임 날짜 조회
    const timeEngine = TimeEngine.getInstance();
    const sessionInfo = timeEngine.getSessionInfo(sessionId);
    
    if (!sessionInfo) return 30;
    
    const currentYear = sessionInfo.gameDate.year;
    const birthYear = new Date(birthDate).getFullYear();
    
    return currentYear - birthYear;
  }
  
  /**
   * 나이대 분류
   */
  private getAgeCategory(age: number): keyof typeof AGE_GROWTH_MULTIPLIER {
    if (age <= AGE_GROWTH_MULTIPLIER.YOUTH.maxAge) return 'YOUTH';
    if (age <= AGE_GROWTH_MULTIPLIER.ADULT.maxAge) return 'ADULT';
    if (age <= AGE_GROWTH_MULTIPLIER.MIDDLE.maxAge) return 'MIDDLE';
    return 'ELDER';
  }
  
  // ==========================================================================
  // Stat Management
  // ==========================================================================
  
  /**
   * 스탯 값 조회
   */
  private getStatValue(character: IGin7Character, stat: StatType): number {
    // 기본 스탯
    if (['command', 'might', 'intellect', 'politics', 'charm'].includes(stat)) {
      return character.stats?.[stat as keyof typeof character.stats] || 50;
    }
    
    // 확장 스탯
    return character.extendedStats?.get(stat) || 50;
  }
  
  /**
   * 스탯 값 업데이트
   */
  private async updateStatValue(
    sessionId: string,
    characterId: string,
    stat: StatType,
    value: number
  ): Promise<void> {
    const update: any = {};
    
    // 기본 스탯
    if (['command', 'might', 'intellect', 'politics', 'charm'].includes(stat)) {
      update[`stats.${stat}`] = value;
    } else {
      // 확장 스탯
      update[`extendedStats.${stat}`] = value;
    }
    
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { $set: update }
    );
  }
  
  /**
   * 캐릭터에서 경험치 로드
   */
  private loadExpFromCharacter(character: IGin7Character): Record<StatType, number> {
    const exp: Record<StatType, number> = {} as Record<StatType, number>;
    
    const expData = character.data?.statExp as Record<string, number> | undefined;
    
    for (const stat of Object.values(StatType)) {
      exp[stat] = expData?.[stat] || 0;
    }
    
    return exp;
  }
  
  /**
   * 경험치 DB 저장
   */
  private async saveExpToCharacter(
    sessionId: string,
    characterId: string,
    exp: Record<StatType, number>
  ): Promise<void> {
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { $set: { 'data.statExp': exp } }
    );
  }
  
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  
  /**
   * 캐릭터 성장 정보 조회
   */
  async getCharacterGrowthInfo(
    sessionId: string,
    characterId: string
  ): Promise<{
    age: number;
    ageCategory: string;
    growthMultiplier: number;
    stats: Record<StatType, number>;
    exp: Record<StatType, number>;
    expToNextLevel: Record<StatType, number>;
  }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    const age = this.calculateAge(character, sessionId);
    const ageCategory = this.getAgeCategory(age);
    const growthMultiplier = AGE_GROWTH_MULTIPLIER[ageCategory].multiplier;
    
    const stats: Record<StatType, number> = {} as Record<StatType, number>;
    const exp: Record<StatType, number> = this.loadExpFromCharacter(character);
    const expToNextLevel: Record<StatType, number> = {} as Record<StatType, number>;
    
    for (const stat of Object.values(StatType)) {
      stats[stat] = this.getStatValue(character, stat);
      expToNextLevel[stat] = EXP_PER_LEVEL - (exp[stat] % EXP_PER_LEVEL);
    }
    
    return {
      age,
      ageCategory,
      growthMultiplier,
      stats,
      exp,
      expToNextLevel,
    };
  }
  
  /**
   * 수동 스탯 추가 (어드민/보상용)
   */
  async addStatBonus(
    sessionId: string,
    characterId: string,
    stat: StatType,
    amount: number
  ): Promise<{ oldValue: number; newValue: number }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    const oldValue = this.getStatValue(character, stat);
    const newValue = Math.min(MAX_STAT, Math.max(1, oldValue + amount));
    
    await this.updateStatValue(sessionId, characterId, stat, newValue);
    
    this.emit('stats:bonus', {
      sessionId,
      characterId,
      stat,
      oldValue,
      newValue,
      amount,
    });
    
    return { oldValue, newValue };
  }
  
  /**
   * 경험치 캐시 클리어
   */
  public clearCache(sessionId?: string): void {
    if (sessionId) {
      // 특정 세션만 클리어
      for (const key of this.expCache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          this.expCache.delete(key);
        }
      }
    } else {
      // 전체 클리어
      this.expCache.clear();
    }
  }
}

export default StatsGrowthService;

