/**
 * FamePointService - 명성 포인트 시스템
 * 플레이어의 명성 획득, 사용, 랭킹 관리
 *
 * 기능:
 * - 명성 획득 (전투 승리, 행성 점령, 승진, 메달, 세션 종료 등)
 * - 명성 사용 (특별 기능 해금)
 * - 명성 잔액 조회
 * - 명성 랭킹
 * - 세션 종료 시 명성 계산
 */

import { EventEmitter } from 'events';
import { Gin7Character } from '../../models/gin7/Character';
import { Gin7GameSession } from '../../models/gin7/GameSession';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

/**
 * 명성 획득 소스
 */
export enum FameSource {
  BATTLE_VICTORY = 'BATTLE_VICTORY',           // 전투 승리
  PLANET_CAPTURE = 'PLANET_CAPTURE',           // 행성 점령
  PROMOTION = 'PROMOTION',                     // 승진
  MEDAL = 'MEDAL',                             // 메달 수여
  SESSION_END = 'SESSION_END',                 // 세션 종료
  SPECIAL_ACHIEVEMENT = 'SPECIAL_ACHIEVEMENT', // 특별 업적
  DAILY_LOGIN = 'DAILY_LOGIN',                 // 일일 로그인
  MISSION_COMPLETE = 'MISSION_COMPLETE',       // 미션 완료
  LEADERSHIP = 'LEADERSHIP',                   // 지도력 보너스
  SURVIVAL = 'SURVIVAL',                       // 생존 보너스
}

/**
 * 명성 사용 용도
 */
export enum FameUsage {
  CHARACTER_UNLOCK = 'CHARACTER_UNLOCK',       // 캐릭터 해금
  COSMETIC = 'COSMETIC',                       // 코스메틱
  TITLE = 'TITLE',                             // 칭호 구매
  BOOST = 'BOOST',                             // 부스트 구매
  REROLL = 'REROLL',                           // 리롤 (캐릭터 추첨)
  PREMIUM_FEATURE = 'PREMIUM_FEATURE',         // 프리미엄 기능
}

/**
 * 명성 트랜잭션 타입
 */
export enum FameTransactionType {
  EARN = 'EARN',     // 획득
  SPEND = 'SPEND',   // 사용
  BONUS = 'BONUS',   // 보너스
  PENALTY = 'PENALTY', // 패널티
  TRANSFER = 'TRANSFER', // 이전
}

/**
 * 명성 트랜잭션 기록
 */
export interface FameTransaction {
  transactionId: string;
  playerId: string;
  sessionId?: string;
  type: FameTransactionType;
  source?: FameSource;
  usage?: FameUsage;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 플레이어 명성 상태
 */
export interface PlayerFameState {
  playerId: string;
  totalFame: number;           // 총 누적 명성
  currentFame: number;         // 현재 사용 가능 명성
  lifetimeEarned: number;      // 평생 획득 명성
  lifetimeSpent: number;       // 평생 사용 명성
  rank: number;                // 전체 순위
  tier: FameTier;              // 명성 티어
  achievements: string[];      // 획득한 업적
  lastEarnedAt?: Date;
  createdAt: Date;
}

/**
 * 명성 티어
 */
export enum FameTier {
  BRONZE = 'BRONZE',           // 0 - 999
  SILVER = 'SILVER',           // 1,000 - 4,999
  GOLD = 'GOLD',               // 5,000 - 19,999
  PLATINUM = 'PLATINUM',       // 20,000 - 49,999
  DIAMOND = 'DIAMOND',         // 50,000 - 99,999
  LEGENDARY = 'LEGENDARY',     // 100,000+
}

/**
 * 랭킹 항목
 */
export interface FameRankingEntry {
  rank: number;
  playerId: string;
  playerName: string;
  totalFame: number;
  tier: FameTier;
  recentActivity: string;
}

/**
 * 세션 종료 명성 계산 결과
 */
export interface SessionEndFameResult {
  playerId: string;
  sessionId: string;
  baseAmount: number;
  bonuses: Array<{ reason: string; amount: number }>;
  penalties: Array<{ reason: string; amount: number }>;
  totalAmount: number;
  breakdown: string[];
}

// ============================================================
// 명성 획득량 정의
// ============================================================

const FAME_AMOUNTS: Record<FameSource, number | ((context: any) => number)> = {
  [FameSource.BATTLE_VICTORY]: (ctx) => {
    const baseAmount = 50;
    const sizeBonus = Math.min(ctx.enemyShipsDestroyed || 0, 500);
    return baseAmount + sizeBonus;
  },
  [FameSource.PLANET_CAPTURE]: 200,
  [FameSource.PROMOTION]: (ctx) => {
    const rankBonuses: Record<string, number> = {
      'MARSHAL': 500,
      'FLEET_ADMIRAL': 400,
      'ADMIRAL': 300,
      'VICE_ADMIRAL': 200,
      'REAR_ADMIRAL': 150,
      'COMMODORE': 100,
      'CAPTAIN': 80,
      'COMMANDER': 60,
      'LIEUTENANT_COMMANDER': 50,
      'LIEUTENANT': 40,
    };
    return rankBonuses[ctx.newRank] || 30;
  },
  [FameSource.MEDAL]: (ctx) => {
    const medalValues: Record<string, number> = {
      'GRAND_CROSS': 1000,
      'DISTINGUISHED_SERVICE': 500,
      'COMBAT_MERIT': 200,
      'SERVICE_MEDAL': 100,
    };
    return medalValues[ctx.medalType] || 50;
  },
  [FameSource.SESSION_END]: 0, // calculateSessionEndFame에서 별도 계산
  [FameSource.SPECIAL_ACHIEVEMENT]: 500,
  [FameSource.DAILY_LOGIN]: 10,
  [FameSource.MISSION_COMPLETE]: 100,
  [FameSource.LEADERSHIP]: (ctx) => ctx.subordinateCount * 5,
  [FameSource.SURVIVAL]: (ctx) => Math.floor(ctx.survivalDays / 10) * 10,
};

// 티어 임계값
const TIER_THRESHOLDS: Record<FameTier, number> = {
  [FameTier.BRONZE]: 0,
  [FameTier.SILVER]: 1000,
  [FameTier.GOLD]: 5000,
  [FameTier.PLATINUM]: 20000,
  [FameTier.DIAMOND]: 50000,
  [FameTier.LEGENDARY]: 100000,
};

// ============================================================
// FamePointService Class
// ============================================================

export class FamePointService extends EventEmitter {
  private static instance: FamePointService;

  // 플레이어별 명성 상태
  private playerStates: Map<string, PlayerFameState> = new Map();
  
  // 트랜잭션 기록
  private transactions: Map<string, FameTransaction[]> = new Map();

  private constructor() {
    super();
    logger.info('[FamePointService] Initialized');
  }

  public static getInstance(): FamePointService {
    if (!FamePointService.instance) {
      FamePointService.instance = new FamePointService();
    }
    return FamePointService.instance;
  }

  // ============================================================
  // 명성 획득
  // ============================================================

  /**
   * 명성 획득
   */
  public async awardFame(
    playerId: string,
    source: FameSource,
    context: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<{
    success: boolean;
    amount: number;
    newBalance: number;
    transaction?: FameTransaction;
    error?: string;
  }> {
    try {
      // 획득량 계산
      const amountDef = FAME_AMOUNTS[source];
      const amount = typeof amountDef === 'function' ? amountDef(context) : amountDef;

      if (amount <= 0) {
        return { success: false, amount: 0, newBalance: 0, error: '획득량이 0 이하입니다.' };
      }

      // 플레이어 상태 조회/생성
      let state = this.playerStates.get(playerId);
      if (!state) {
        state = this.createPlayerState(playerId);
      }

      // 명성 추가
      state.currentFame += amount;
      state.totalFame += amount;
      state.lifetimeEarned += amount;
      state.lastEarnedAt = new Date();

      // 티어 업데이트
      state.tier = this.calculateTier(state.totalFame);

      // 트랜잭션 기록
      const transaction = this.recordTransaction(playerId, {
        type: FameTransactionType.EARN,
        source,
        amount,
        balanceAfter: state.currentFame,
        description: this.getSourceDescription(source, context),
        sessionId,
        metadata: context,
      });

      this.emit('fame:awarded', {
        playerId,
        source,
        amount,
        newBalance: state.currentFame,
        tier: state.tier,
      });

      logger.info(`[FamePointService] ${playerId} earned ${amount} fame from ${source}`);

      return {
        success: true,
        amount,
        newBalance: state.currentFame,
        transaction,
      };
    } catch (error) {
      logger.error('[FamePointService] awardFame error:', error);
      return { success: false, amount: 0, newBalance: 0, error: '명성 획득 중 오류 발생' };
    }
  }

  // ============================================================
  // 명성 사용
  // ============================================================

  /**
   * 명성 사용
   */
  public async spendFame(
    playerId: string,
    amount: number,
    usage: FameUsage,
    description?: string,
  ): Promise<{
    success: boolean;
    newBalance: number;
    transaction?: FameTransaction;
    error?: string;
  }> {
    try {
      const state = this.playerStates.get(playerId);
      if (!state) {
        return { success: false, newBalance: 0, error: '플레이어를 찾을 수 없습니다.' };
      }

      if (state.currentFame < amount) {
        return {
          success: false,
          newBalance: state.currentFame,
          error: `명성 포인트가 부족합니다. (필요: ${amount}, 보유: ${state.currentFame})`,
        };
      }

      // 명성 차감
      state.currentFame -= amount;
      state.lifetimeSpent += amount;

      // 트랜잭션 기록
      const transaction = this.recordTransaction(playerId, {
        type: FameTransactionType.SPEND,
        usage,
        amount: -amount,
        balanceAfter: state.currentFame,
        description: description || this.getUsageDescription(usage),
      });

      this.emit('fame:spent', {
        playerId,
        usage,
        amount,
        newBalance: state.currentFame,
      });

      logger.info(`[FamePointService] ${playerId} spent ${amount} fame for ${usage}`);

      return {
        success: true,
        newBalance: state.currentFame,
        transaction,
      };
    } catch (error) {
      logger.error('[FamePointService] spendFame error:', error);
      return { success: false, newBalance: 0, error: '명성 사용 중 오류 발생' };
    }
  }

  /**
   * 명성 사용 가능 여부 확인
   */
  public canSpend(playerId: string, amount: number): boolean {
    const state = this.playerStates.get(playerId);
    return state ? state.currentFame >= amount : false;
  }

  // ============================================================
  // 잔액 조회
  // ============================================================

  /**
   * 명성 잔액 조회
   */
  public getFameBalance(playerId: string): {
    currentFame: number;
    totalFame: number;
    tier: FameTier;
    rank?: number;
  } {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return { currentFame: 0, totalFame: 0, tier: FameTier.BRONZE };
    }

    return {
      currentFame: state.currentFame,
      totalFame: state.totalFame,
      tier: state.tier,
      rank: state.rank,
    };
  }

  /**
   * 상세 명성 상태 조회
   */
  public getPlayerState(playerId: string): PlayerFameState | undefined {
    return this.playerStates.get(playerId);
  }

  /**
   * 트랜잭션 히스토리 조회
   */
  public getTransactionHistory(
    playerId: string,
    limit: number = 50,
  ): FameTransaction[] {
    const transactions = this.transactions.get(playerId) || [];
    return transactions.slice(-limit).reverse();
  }

  // ============================================================
  // 랭킹
  // ============================================================

  /**
   * 명성 랭킹 조회
   */
  public async getFameRanking(
    limit: number = 100,
    offset: number = 0,
  ): Promise<FameRankingEntry[]> {
    // 모든 플레이어 상태를 정렬
    const allStates = Array.from(this.playerStates.values());
    allStates.sort((a, b) => b.totalFame - a.totalFame);

    // 순위 업데이트
    allStates.forEach((state, index) => {
      state.rank = index + 1;
    });

    // 페이지네이션
    const pagedStates = allStates.slice(offset, offset + limit);

    // 랭킹 엔트리 생성
    const entries: FameRankingEntry[] = await Promise.all(
      pagedStates.map(async (state) => {
        const playerName = await this.getPlayerName(state.playerId);
        const recentTx = this.transactions.get(state.playerId)?.slice(-1)[0];

        return {
          rank: state.rank,
          playerId: state.playerId,
          playerName,
          totalFame: state.totalFame,
          tier: state.tier,
          recentActivity: recentTx?.description || '활동 없음',
        };
      }),
    );

    return entries;
  }

  /**
   * 특정 플레이어 순위 조회
   */
  public getPlayerRank(playerId: string): number | undefined {
    const state = this.playerStates.get(playerId);
    if (!state) return undefined;

    // 전체 순위 재계산
    const allStates = Array.from(this.playerStates.values());
    allStates.sort((a, b) => b.totalFame - a.totalFame);
    
    const index = allStates.findIndex((s) => s.playerId === playerId);
    return index >= 0 ? index + 1 : undefined;
  }

  // ============================================================
  // 세션 종료 시 명성 계산
  // ============================================================

  /**
   * 세션 종료 시 명성 계산
   */
  public async calculateSessionEndFame(
    playerId: string,
    sessionId: string,
  ): Promise<SessionEndFameResult> {
    try {
      // 캐릭터 정보 조회
      const character = await Gin7Character.findOne({
        sessionId,
        playerId,
      }).lean();

      // 세션 정보 조회
      const session = await Gin7GameSession.findOne({ sessionId }).lean();

      const bonuses: Array<{ reason: string; amount: number }> = [];
      const penalties: Array<{ reason: string; amount: number }> = [];
      const breakdown: string[] = [];

      // 기본 참가 보상
      const baseAmount = 100;
      breakdown.push(`기본 참가 보상: ${baseAmount}`);

      // 1. 생존 보너스
      if (character?.status === 'ACTIVE') {
        const survivalBonus = 200;
        bonuses.push({ reason: '생존 보너스', amount: survivalBonus });
        breakdown.push(`생존 보너스: +${survivalBonus}`);
      }

      // 2. 계급 보너스
      if (character?.rank) {
        const rankBonus = this.calculateRankBonus(character.rank);
        if (rankBonus > 0) {
          bonuses.push({ reason: `계급 보너스 (${character.rank})`, amount: rankBonus });
          breakdown.push(`계급 보너스: +${rankBonus}`);
        }
      }

      // 3. 승리 진영 보너스
      const winnerFactionId = (session?.data as any)?.winnerId;
      if (winnerFactionId && character?.factionId === winnerFactionId) {
        const winBonus = 500;
        bonuses.push({ reason: '승리 진영 보너스', amount: winBonus });
        breakdown.push(`승리 진영 보너스: +${winBonus}`);
      }

      // 4. 직책 보너스
      if ((character as any)?.currentPosition) {
        const positionBonus = ((character as any).currentPosition?.authorityLevel || 0) * 20;
        if (positionBonus > 0) {
          bonuses.push({ reason: '직책 보너스', amount: positionBonus });
          breakdown.push(`직책 보너스: +${positionBonus}`);
        }
      }

      // 5. 플레이 시간 보너스
      const sessionDuration = this.calculateSessionDuration(session);
      if (sessionDuration > 0) {
        const durationBonus = Math.floor(sessionDuration / 24) * 10; // 1일당 10포인트
        if (durationBonus > 0) {
          bonuses.push({ reason: `플레이 시간 보너스 (${Math.floor(sessionDuration / 24)}일)`, amount: durationBonus });
          breakdown.push(`플레이 시간 보너스: +${durationBonus}`);
        }
      }

      // 6. 사망 패널티
      if (character?.status !== 'ACTIVE') {
        const deathPenalty = 50;
        penalties.push({ reason: '사망 패널티', amount: deathPenalty });
        breakdown.push(`사망 패널티: -${deathPenalty}`);
      }

      // 총합 계산
      const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0);
      const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);
      const totalAmount = Math.max(0, baseAmount + totalBonuses - totalPenalties);

      breakdown.push(`----- 합계 -----`);
      breakdown.push(`총 획득 명성: ${totalAmount}`);

      // 명성 지급
      await this.awardFame(playerId, FameSource.SESSION_END, {
        sessionId,
        baseAmount,
        bonuses,
        penalties,
      }, sessionId);

      const result: SessionEndFameResult = {
        playerId,
        sessionId,
        baseAmount,
        bonuses,
        penalties,
        totalAmount,
        breakdown,
      };

      this.emit('fame:sessionEndCalculated', result);
      logger.info(`[FamePointService] Session end fame for ${playerId}: ${totalAmount}`);

      return result;
    } catch (error) {
      logger.error('[FamePointService] calculateSessionEndFame error:', error);
      return {
        playerId,
        sessionId,
        baseAmount: 0,
        bonuses: [],
        penalties: [],
        totalAmount: 0,
        breakdown: ['계산 중 오류 발생'],
      };
    }
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  /**
   * 플레이어 상태 생성
   */
  private createPlayerState(playerId: string): PlayerFameState {
    const state: PlayerFameState = {
      playerId,
      totalFame: 0,
      currentFame: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      rank: 0,
      tier: FameTier.BRONZE,
      achievements: [],
      createdAt: new Date(),
    };
    this.playerStates.set(playerId, state);
    return state;
  }

  /**
   * 티어 계산
   */
  private calculateTier(totalFame: number): FameTier {
    if (totalFame >= TIER_THRESHOLDS[FameTier.LEGENDARY]) return FameTier.LEGENDARY;
    if (totalFame >= TIER_THRESHOLDS[FameTier.DIAMOND]) return FameTier.DIAMOND;
    if (totalFame >= TIER_THRESHOLDS[FameTier.PLATINUM]) return FameTier.PLATINUM;
    if (totalFame >= TIER_THRESHOLDS[FameTier.GOLD]) return FameTier.GOLD;
    if (totalFame >= TIER_THRESHOLDS[FameTier.SILVER]) return FameTier.SILVER;
    return FameTier.BRONZE;
  }

  /**
   * 트랜잭션 기록
   */
  private recordTransaction(
    playerId: string,
    data: Omit<FameTransaction, 'transactionId' | 'playerId' | 'createdAt'>,
  ): FameTransaction {
    const transaction: FameTransaction = {
      transactionId: `FAME-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      playerId,
      ...data,
      createdAt: new Date(),
    };

    if (!this.transactions.has(playerId)) {
      this.transactions.set(playerId, []);
    }
    this.transactions.get(playerId)!.push(transaction);

    // 최대 1000개 유지
    const txs = this.transactions.get(playerId)!;
    if (txs.length > 1000) {
      this.transactions.set(playerId, txs.slice(-1000));
    }

    return transaction;
  }

  /**
   * 소스 설명 반환
   */
  private getSourceDescription(source: FameSource, context: Record<string, unknown>): string {
    const descriptions: Record<FameSource, string | ((ctx: any) => string)> = {
      [FameSource.BATTLE_VICTORY]: (ctx) => `전투 승리 (적 함정 ${ctx.enemyShipsDestroyed || 0}척 격파)`,
      [FameSource.PLANET_CAPTURE]: (ctx) => `행성 점령: ${ctx.planetName || '알 수 없음'}`,
      [FameSource.PROMOTION]: (ctx) => `승진: ${ctx.newRank || '알 수 없음'}`,
      [FameSource.MEDAL]: (ctx) => `메달 수여: ${ctx.medalName || '알 수 없음'}`,
      [FameSource.SESSION_END]: '세션 종료 보상',
      [FameSource.SPECIAL_ACHIEVEMENT]: (ctx) => `특별 업적: ${ctx.achievementName || '알 수 없음'}`,
      [FameSource.DAILY_LOGIN]: '일일 로그인 보상',
      [FameSource.MISSION_COMPLETE]: (ctx) => `미션 완료: ${ctx.missionName || '알 수 없음'}`,
      [FameSource.LEADERSHIP]: (ctx) => `지도력 보너스 (부하 ${ctx.subordinateCount || 0}명)`,
      [FameSource.SURVIVAL]: (ctx) => `생존 보너스 (${ctx.survivalDays || 0}일)`,
    };

    const desc = descriptions[source];
    return typeof desc === 'function' ? desc(context) : desc;
  }

  /**
   * 사용 설명 반환
   */
  private getUsageDescription(usage: FameUsage): string {
    const descriptions: Record<FameUsage, string> = {
      [FameUsage.CHARACTER_UNLOCK]: '캐릭터 해금',
      [FameUsage.COSMETIC]: '코스메틱 구매',
      [FameUsage.TITLE]: '칭호 구매',
      [FameUsage.BOOST]: '부스트 구매',
      [FameUsage.REROLL]: '캐릭터 리롤',
      [FameUsage.PREMIUM_FEATURE]: '프리미엄 기능 해금',
    };
    return descriptions[usage] || usage;
  }

  /**
   * 플레이어 이름 조회
   */
  private async getPlayerName(playerId: string): Promise<string> {
    try {
      const character = await Gin7Character.findOne({ playerId }).lean();
      return character?.name || playerId;
    } catch (error) {
      return playerId;
    }
  }

  /**
   * 계급 보너스 계산
   */
  private calculateRankBonus(rank: string): number {
    const rankBonuses: Record<string, number> = {
      'MARSHAL': 300,
      'FLEET_ADMIRAL': 250,
      'ADMIRAL': 200,
      'VICE_ADMIRAL': 150,
      'REAR_ADMIRAL': 120,
      'COMMODORE': 100,
      'CAPTAIN': 80,
      'COMMANDER': 60,
      'LIEUTENANT_COMMANDER': 40,
      'LIEUTENANT': 30,
      'LIEUTENANT_JG': 20,
      'ENSIGN': 10,
    };
    return rankBonuses[rank] || 0;
  }

  /**
   * 세션 시간 계산 (시간 단위)
   */
  private calculateSessionDuration(session: any): number {
    if (!session?.timeConfig?.gameStartDate || !session?.currentState?.gameDate) {
      return 0;
    }

    const start = new Date(
      session.timeConfig.gameStartDate.year,
      session.timeConfig.gameStartDate.month - 1,
      session.timeConfig.gameStartDate.day,
    );
    const current = new Date(session.currentState.gameDate);
    return (current.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  // ============================================================
  // 티어 정보
  // ============================================================

  /**
   * 티어 이름 반환
   */
  public getTierName(tier: FameTier): string {
    const names: Record<FameTier, string> = {
      [FameTier.BRONZE]: '브론즈',
      [FameTier.SILVER]: '실버',
      [FameTier.GOLD]: '골드',
      [FameTier.PLATINUM]: '플래티넘',
      [FameTier.DIAMOND]: '다이아몬드',
      [FameTier.LEGENDARY]: '레전더리',
    };
    return names[tier] || tier;
  }

  /**
   * 다음 티어까지 필요 명성
   */
  public getNextTierProgress(playerId: string): {
    currentTier: FameTier;
    nextTier: FameTier | null;
    currentAmount: number;
    requiredAmount: number;
    progress: number;
  } | null {
    const state = this.playerStates.get(playerId);
    if (!state) return null;

    const tiers = Object.entries(TIER_THRESHOLDS)
      .sort(([, a], [, b]) => a - b) as [FameTier, number][];
    
    const currentTierIndex = tiers.findIndex(([tier]) => tier === state.tier);
    if (currentTierIndex === tiers.length - 1) {
      // 최고 티어
      return {
        currentTier: state.tier,
        nextTier: null,
        currentAmount: state.totalFame,
        requiredAmount: TIER_THRESHOLDS[state.tier],
        progress: 100,
      };
    }

    const nextTier = tiers[currentTierIndex + 1][0];
    const nextThreshold = tiers[currentTierIndex + 1][1];
    const currentThreshold = TIER_THRESHOLDS[state.tier];

    const rangeTotal = nextThreshold - currentThreshold;
    const rangeCurrent = state.totalFame - currentThreshold;
    const progress = Math.min(100, (rangeCurrent / rangeTotal) * 100);

    return {
      currentTier: state.tier,
      nextTier,
      currentAmount: state.totalFame,
      requiredAmount: nextThreshold,
      progress: Math.round(progress),
    };
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId?: string): void {
    if (sessionId) {
      // 특정 세션 관련 트랜잭션 정리
      for (const [playerId, txs] of Array.from(this.transactions)) {
        const filtered = txs.filter((tx) => tx.sessionId !== sessionId);
        this.transactions.set(playerId, filtered);
      }
    }
    logger.info(`[FamePointService] Cleaned up${sessionId ? ` session: ${sessionId}` : ''}`);
  }
}

export const famePointService = FamePointService.getInstance();
export default FamePointService;

