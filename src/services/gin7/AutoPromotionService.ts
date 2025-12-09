/**
 * AutoPromotionService - 자동 승진/강등 시스템
 * 매뉴얼 1751-1769행 기반 구현
 *
 * 기능:
 * - 대좌 이하 자동 승진 (30일마다)
 * - 각 계급 래더 1위 자동 승진
 * - 승진 시 래더 평균 공적 부여
 * - 자동 강등 조건 체크
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

export interface AutoPromotionResult {
  promoted: Array<{
    characterId: string;
    characterName: string;
    previousRank: string;
    newRank: string;
    newMerit: number;
  }>;
  demoted: Array<{
    characterId: string;
    characterName: string;
    previousRank: string;
    newRank: string;
    newMerit: number;
  }>;
}

// ============================================================
// 계급 정의
// ============================================================

// 대좌 이하 계급 (자동 승진 대상)
const AUTO_PROMOTION_RANKS = [
  // 사병
  { rank: '이등병', nextRank: '일등병', minMerit: 100 },
  { rank: '일등병', nextRank: '상등병', minMerit: 100 },
  { rank: '상등병', nextRank: '병장', minMerit: 100 },
  { rank: '병장', nextRank: '하사', minMerit: 150 },
  // 부사관
  { rank: '하사', nextRank: '중사', minMerit: 150 },
  { rank: '중사', nextRank: '상사', minMerit: 150 },
  { rank: '상사', nextRank: '원사', minMerit: 200 },
  { rank: '원사', nextRank: '소위', minMerit: 250 },
  // 위관
  { rank: '소위', nextRank: '중위', minMerit: 200 },
  { rank: '중위', nextRank: '대위', minMerit: 250 },
  { rank: '대위', nextRank: '소령', minMerit: 300 },
  // 영관
  { rank: '소령', nextRank: '중령', minMerit: 300 },
  { rank: '중령', nextRank: '대령', minMerit: 350 },
  { rank: '대령', nextRank: '준장', minMerit: 400 },
];

// 자동 승진 대상 계급 목록
const AUTO_PROMOTION_RANK_NAMES = AUTO_PROMOTION_RANKS.map(r => r.rank);

// 강등 기준 계급
const DEMOTION_RANKS = [
  { rank: '준장', prevRank: '대령', maxMerit: -100 },
  { rank: '소장', prevRank: '준장', maxMerit: -100 },
  { rank: '중장', prevRank: '소장', maxMerit: -100 },
  { rank: '대장', prevRank: '중장', maxMerit: -100 },
  { rank: '원수', prevRank: '대장', maxMerit: -100 },
];

// ============================================================
// AutoPromotionService Class
// ============================================================

export class AutoPromotionService extends EventEmitter {
  private static instance: AutoPromotionService;
  
  // 자동 승진 주기 (게임일 기준)
  private readonly AUTO_PROMOTION_INTERVAL_DAYS = 30;
  
  // 마지막 자동 승진 체크 일자 (sessionId -> gameDay)
  private lastCheckDay: Map<string, number> = new Map();

  private constructor() {
    super();
    logger.info('[AutoPromotionService] Initialized');
  }

  public static getInstance(): AutoPromotionService {
    if (!AutoPromotionService.instance) {
      AutoPromotionService.instance = new AutoPromotionService();
    }
    return AutoPromotionService.instance;
  }

  // ============================================================
  // 자동 승진 (TimeEngine에서 호출)
  // ============================================================

  /**
   * 일일 틱에서 자동 승진 체크
   * 매뉴얼: "매 게임 30일마다 대좌 이하 각 계급 래더 1위 자동 승진"
   */
  public async onDailyTick(sessionId: string, gameDay: number): Promise<AutoPromotionResult | null> {
    const lastDay = this.lastCheckDay.get(sessionId) || 0;
    
    // 30일마다 체크
    if (gameDay - lastDay < this.AUTO_PROMOTION_INTERVAL_DAYS) {
      return null;
    }
    
    this.lastCheckDay.set(sessionId, gameDay);
    
    return this.processAutoPromotions(sessionId);
  }

  /**
   * 자동 승진 처리
   */
  public async processAutoPromotions(sessionId: string): Promise<AutoPromotionResult> {
    const result: AutoPromotionResult = {
      promoted: [],
      demoted: [],
    };
    
    // 각 계급별로 처리
    for (const rankInfo of AUTO_PROMOTION_RANKS) {
      const topCharacter = await this.getTopCharacterInRank(sessionId, rankInfo.rank);
      
      if (topCharacter && topCharacter.merit >= rankInfo.minMerit) {
        // 승진 처리
        const promoted = await this.promoteCharacter(
          sessionId,
          topCharacter.characterId,
          rankInfo.nextRank,
        );
        
        if (promoted) {
          result.promoted.push({
            characterId: topCharacter.characterId,
            characterName: topCharacter.name,
            previousRank: rankInfo.rank,
            newRank: rankInfo.nextRank,
            newMerit: promoted.newMerit,
          });
        }
      }
    }
    
    // 자동 강등 체크
    const demotions = await this.processAutoDemotions(sessionId);
    result.demoted = demotions;
    
    // 결과 이벤트 발생
    if (result.promoted.length > 0 || result.demoted.length > 0) {
      this.emit('autoPromotion:completed', {
        sessionId,
        promoted: result.promoted.length,
        demoted: result.demoted.length,
      });
      
      logger.info(`[AutoPromotionService] Session ${sessionId}: ${result.promoted.length} promoted, ${result.demoted.length} demoted`);
    }
    
    return result;
  }

  /**
   * 특정 계급의 래더 1위 캐릭터 조회
   */
  private async getTopCharacterInRank(
    sessionId: string,
    rank: string,
  ): Promise<IGin7Character | null> {
    const characters = await Gin7Character.find({
      sessionId,
      rank,
      status: 'active',
      isNPC: false, // 플레이어 캐릭터만
    })
      .sort({ merit: -1 })
      .limit(1)
      .lean() as unknown as IGin7Character[];
    
    return characters[0] || null;
  }

  /**
   * 캐릭터 승진 처리
   */
  private async promoteCharacter(
    sessionId: string,
    characterId: string,
    newRank: string,
  ): Promise<{ newMerit: number } | null> {
    // 새 계급의 평균 공적 계산
    const avgMerit = await this.getAverageRankMerit(sessionId, newRank);
    
    const result = await Gin7Character.findOneAndUpdate(
      { sessionId, characterId },
      {
        rank: newRank,
        merit: avgMerit,
        $push: {
          promotionHistory: {
            date: new Date(),
            newRank,
            merit: avgMerit,
            type: 'auto',
          },
        },
      },
      { new: true },
    );
    
    if (result) {
      this.emit('character:promoted', {
        sessionId,
        characterId,
        characterName: result.name,
        newRank,
        merit: avgMerit,
        type: 'auto',
      });
      
      return { newMerit: avgMerit };
    }
    
    return null;
  }

  /**
   * 특정 계급의 평균 공적 계산
   */
  private async getAverageRankMerit(sessionId: string, rank: string): Promise<number> {
    const result = await Gin7Character.aggregate([
      { $match: { sessionId, rank, status: 'active' } },
      { $group: { _id: null, avgMerit: { $avg: '$merit' } } },
    ]);
    
    return result[0]?.avgMerit || 0;
  }

  // ============================================================
  // 자동 강등
  // ============================================================

  /**
   * 자동 강등 처리
   * 매뉴얼: "강등 조건 자동 체크"
   */
  private async processAutoDemotions(sessionId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    previousRank: string;
    newRank: string;
    newMerit: number;
  }>> {
    const demotions: Array<{
      characterId: string;
      characterName: string;
      previousRank: string;
      newRank: string;
      newMerit: number;
    }> = [];
    
    for (const demotionInfo of DEMOTION_RANKS) {
      // 해당 계급에서 공적이 기준 이하인 캐릭터 조회
      const candidates = await Gin7Character.find({
        sessionId,
        rank: demotionInfo.rank,
        merit: { $lte: demotionInfo.maxMerit },
        status: 'active',
        isNPC: false,
      }).lean();
      
      for (const candidate of candidates) {
        const demoted = await this.demoteCharacter(
          sessionId,
          candidate.characterId,
          demotionInfo.prevRank,
        );
        
        if (demoted) {
          demotions.push({
            characterId: candidate.characterId,
            characterName: candidate.name,
            previousRank: demotionInfo.rank,
            newRank: demotionInfo.prevRank,
            newMerit: demoted.newMerit,
          });
        }
      }
    }
    
    return demotions;
  }

  /**
   * 캐릭터 강등 처리
   */
  private async demoteCharacter(
    sessionId: string,
    characterId: string,
    newRank: string,
  ): Promise<{ newMerit: number } | null> {
    // 강등 시 공적 100으로 설정
    const newMerit = 100;
    
    const result = await Gin7Character.findOneAndUpdate(
      { sessionId, characterId },
      {
        rank: newRank,
        merit: newMerit,
        $push: {
          promotionHistory: {
            date: new Date(),
            newRank,
            merit: newMerit,
            type: 'demotion',
          },
        },
      },
      { new: true },
    );
    
    if (result) {
      this.emit('character:demoted', {
        sessionId,
        characterId,
        characterName: result.name,
        newRank,
        merit: newMerit,
        type: 'auto',
      });
      
      return { newMerit };
    }
    
    return null;
  }

  // ============================================================
  // 수동 승진/강등
  // ============================================================

  /**
   * 수동 승진
   */
  public async manualPromotion(
    sessionId: string,
    characterId: string,
    newRank: string,
    promotedBy: string,
  ): Promise<boolean> {
    const result = await this.promoteCharacter(sessionId, characterId, newRank);
    
    if (result) {
      this.emit('character:promoted', {
        sessionId,
        characterId,
        newRank,
        merit: result.newMerit,
        type: 'manual',
        promotedBy,
      });
      return true;
    }
    
    return false;
  }

  /**
   * 수동 강등
   */
  public async manualDemotion(
    sessionId: string,
    characterId: string,
    newRank: string,
    demotedBy: string,
  ): Promise<boolean> {
    const result = await this.demoteCharacter(sessionId, characterId, newRank);
    
    if (result) {
      this.emit('character:demoted', {
        sessionId,
        characterId,
        newRank,
        merit: result.newMerit,
        type: 'manual',
        demotedBy,
      });
      return true;
    }
    
    return false;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 계급별 래더 조회
   */
  public async getRankLadder(
    sessionId: string,
    rank: string,
    limit: number = 20,
  ): Promise<IGin7Character[]> {
    return Gin7Character.find({
      sessionId,
      rank,
      status: 'active',
    })
      .sort({ merit: -1 })
      .limit(limit)
      .lean() as unknown as IGin7Character[];
  }

  /**
   * 승진 대상 후보 조회
   */
  public async getPromotionCandidates(sessionId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    rank: string;
    merit: number;
    nextRank: string;
    meritNeeded: number;
  }>> {
    const candidates: Array<{
      characterId: string;
      characterName: string;
      rank: string;
      merit: number;
      nextRank: string;
      meritNeeded: number;
    }> = [];
    
    for (const rankInfo of AUTO_PROMOTION_RANKS) {
      const topChar = await this.getTopCharacterInRank(sessionId, rankInfo.rank);
      if (topChar) {
        candidates.push({
          characterId: topChar.characterId,
          characterName: topChar.name,
          rank: rankInfo.rank,
          merit: topChar.merit,
          nextRank: rankInfo.nextRank,
          meritNeeded: rankInfo.minMerit,
        });
      }
    }
    
    return candidates;
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    this.lastCheckDay.delete(sessionId);
    logger.info(`[AutoPromotionService] Cleaned up session: ${sessionId}`);
  }
}

export const autoPromotionService = AutoPromotionService.getInstance();
export default AutoPromotionService;





