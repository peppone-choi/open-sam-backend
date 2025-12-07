/**
 * GIN7 Promotion Service
 * 
 * 자동 승진 및 수동 승진 시스템
 * TimeEngine의 MONTH_START 이벤트를 구독하여 월간 인사 처리
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 * 
 * 승진 규칙:
 * - 자동 승진: 대령(O6) 이하, 매월 계급별 라더 1위
 * - 수동 승진: 준장(G1) 이상, 인사권자의 명령 필요
 * - T.O(정원) 체크 필수
 * - 최소 복무 기간 충족 필요
 */

import { EventEmitter } from 'events';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { RankLadderService } from './RankLadderService';
import { RankLadder, IRankLadderEntry } from '../../models/gin7/RankLadder';
import { Gin7Character } from '../../models/gin7/Character';
import { 
  RankCode, 
  RANK_TABLE,
  getRankDefinition, 
  getNextRank, 
  getPreviousRank,
  getAutoPromotableRanks,
  compareRanks,
  hasAuthorityLevel,
} from '../../config/gin7/ranks';
import { logger } from '../../common/logger';

// ============================================================================
// Types
// ============================================================================

export interface PromotionResult {
  success: boolean;
  characterId: string;
  characterName: string;
  oldRank: RankCode;
  newRank: RankCode;
  reason?: string;
  error?: string;
}

export interface DemotionResult {
  success: boolean;
  characterId: string;
  characterName: string;
  oldRank: RankCode;
  newRank: RankCode;
  reason: string;
  error?: string;
}

export interface MonthlyPromotionReport {
  sessionId: string;
  factionId: string;
  month: number;
  year: number;
  promotions: PromotionResult[];
  totalPromoted: number;
  totalFailed: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class PromotionService extends EventEmitter {
  private static instance: PromotionService;
  private isSubscribed: boolean = false;
  private ladderService: RankLadderService;
  
  // 세션별 설정 (T.O 배율 등)
  private sessionConfigs: Map<string, {
    toMultiplier: number;        // T.O 배율
    autoPromotionEnabled: boolean;
  }> = new Map();
  
  private constructor() {
    super();
    this.ladderService = RankLadderService.getInstance();
  }
  
  public static getInstance(): PromotionService {
    if (!PromotionService.instance) {
      PromotionService.instance = new PromotionService();
    }
    return PromotionService.instance;
  }
  
  // ==========================================================================
  // TimeEngine Integration
  // ==========================================================================
  
  /**
   * TimeEngine MONTH_START 이벤트 구독
   */
  public subscribe(): void {
    if (this.isSubscribed) {
      logger.warn('[PromotionService] Already subscribed to TimeEngine');
      return;
    }
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.on(GIN7_EVENTS.MONTH_START, this.handleMonthStart.bind(this));
    this.isSubscribed = true;
    
    logger.info('[PromotionService] Subscribed to TimeEngine MONTH_START');
  }
  
  /**
   * TimeEngine 구독 해제
   */
  public unsubscribe(): void {
    if (!this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.off(GIN7_EVENTS.MONTH_START, this.handleMonthStart.bind(this));
    this.isSubscribed = false;
    
    logger.info('[PromotionService] Unsubscribed from TimeEngine');
  }
  
  /**
   * MONTH_START 이벤트 핸들러 - 자동 승진 처리
   */
  private async handleMonthStart(payload: MonthStartPayload): Promise<void> {
    const { sessionId, month, year } = payload;
    
    logger.info('[PromotionService] Processing monthly promotions', { sessionId, month, year });
    
    try {
      // 세션의 모든 세력에 대해 자동 승진 처리
      const factions = await this.getSessionFactions(sessionId);
      
      for (const factionId of factions) {
        const report = await this.processAutoPromotions(sessionId, factionId, month, year);
        
        if (report.totalPromoted > 0) {
          this.emit('promotions:monthly', report);
          
          logger.info('[PromotionService] Monthly promotions completed', {
            sessionId,
            factionId,
            month,
            year,
            promoted: report.totalPromoted,
            failed: report.totalFailed,
          });
        }
      }
    } catch (error) {
      logger.error('[PromotionService] Monthly promotion failed', { sessionId, error });
    }
  }
  
  /**
   * 세션의 모든 세력 ID 조회
   */
  private async getSessionFactions(sessionId: string): Promise<string[]> {
    const factions = await RankLadder.distinct('factionId', { sessionId, status: 'active' });
    return factions;
  }
  
  // ==========================================================================
  // Auto Promotion Logic
  // ==========================================================================
  
  /**
   * 자동 승진 처리 (세력별)
   */
  async processAutoPromotions(
    sessionId: string,
    factionId: string,
    month: number,
    year: number
  ): Promise<MonthlyPromotionReport> {
    const config = this.sessionConfigs.get(sessionId) || {
      toMultiplier: 1.0,
      autoPromotionEnabled: true,
    };
    
    if (!config.autoPromotionEnabled) {
      return {
        sessionId,
        factionId,
        month,
        year,
        promotions: [],
        totalPromoted: 0,
        totalFailed: 0,
      };
    }
    
    const promotions: PromotionResult[] = [];
    const autoPromotableRanks = getAutoPromotableRanks();
    
    // 각 자동 승진 가능 계급에 대해 처리 (낮은 계급부터)
    for (const rankDef of autoPromotableRanks) {
      const nextRank = getNextRank(rankDef.code);
      if (!nextRank) continue;
      
      // T.O 체크
      const to = await this.ladderService.checkTO(
        sessionId, 
        factionId, 
        nextRank.code, 
        config.toMultiplier
      );
      
      if (to.max !== -1 && to.available <= 0) {
        continue; // 정원 초과
      }
      
      // 라더 1위 조회
      const candidate = await this.ladderService.getPromotionCandidate(
        sessionId, 
        factionId, 
        rankDef.code
      );
      
      if (!candidate) continue;
      
      // 승진 조건 검증
      const validation = await this.validatePromotion(candidate, nextRank.code);
      
      if (!validation.valid) {
        promotions.push({
          success: false,
          characterId: candidate.characterId,
          characterName: candidate.characterName,
          oldRank: rankDef.code,
          newRank: nextRank.code,
          error: validation.reason,
        });
        continue;
      }
      
      // 승진 실행
      const result = await this.executePromotion(
        sessionId,
        candidate.characterId,
        nextRank.code,
        'auto'
      );
      
      promotions.push(result);
    }
    
    return {
      sessionId,
      factionId,
      month,
      year,
      promotions,
      totalPromoted: promotions.filter(p => p.success).length,
      totalFailed: promotions.filter(p => !p.success).length,
    };
  }
  
  /**
   * 승진 조건 검증
   */
  private async validatePromotion(
    candidate: IRankLadderEntry,
    targetRank: RankCode
  ): Promise<{ valid: boolean; reason?: string }> {
    const currentRankDef = getRankDefinition(candidate.rank as RankCode);
    const targetRankDef = getRankDefinition(targetRank);
    
    // 1. 필요 공적치 체크
    if (currentRankDef.meritForPromotion > 0 && 
        candidate.merit < currentRankDef.meritForPromotion) {
      return { 
        valid: false, 
        reason: `Merit insufficient: ${candidate.merit}/${currentRankDef.meritForPromotion}` 
      };
    }
    
    // 2. 최소 복무 기간 체크
    if (candidate.serviceMonths < currentRankDef.minServiceMonths) {
      return { 
        valid: false, 
        reason: `Service months insufficient: ${candidate.serviceMonths}/${currentRankDef.minServiceMonths}` 
      };
    }
    
    // 3. 상태 체크
    if (candidate.status !== 'active') {
      return { valid: false, reason: `Invalid status: ${candidate.status}` };
    }
    
    // 4. 연속 승진 체크 (같은 달 중복 승진 방지)
    const promotionDate = candidate.promotionDate;
    const now = new Date();
    const monthsSincePromotion = 
      (now.getFullYear() - promotionDate.getFullYear()) * 12 +
      (now.getMonth() - promotionDate.getMonth());
    
    if (monthsSincePromotion < 1) {
      return { valid: false, reason: 'Too soon since last promotion' };
    }
    
    return { valid: true };
  }
  
  // ==========================================================================
  // Manual Promotion Logic
  // ==========================================================================
  
  /**
   * 수동 승진 (인사권자 명령)
   */
  async manualPromotion(
    sessionId: string,
    appointerId: string,
    targetId: string,
    targetRank: RankCode
  ): Promise<PromotionResult> {
    // 인사권자 검증
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: targetRank,
        error: 'Appointer not found',
      };
    }
    
    // 인사권 체크 (장관급 이상 또는 직위 보유)
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    const targetRankDef = getRankDefinition(targetRank);
    
    // 인사권자는 자신보다 낮은 계급만 승진 가능
    if (compareRanks(appointer.rank as RankCode, targetRank) <= 0) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: targetRank,
        error: 'Appointer rank too low',
      };
    }
    
    // 인사권 레벨 체크 (최소 레벨 11 필요)
    if (appointerRankDef.authorityLevel < 11) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: targetRank,
        error: 'Insufficient authority level for manual promotion',
      };
    }
    
    // 대상자 조회
    const target = await RankLadder.findOne({ 
      sessionId, 
      characterId: targetId, 
      status: 'active' 
    });
    
    if (!target) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: targetRank,
        error: 'Target not found',
      };
    }
    
    // 같은 세력 체크
    if (target.factionId !== appointer.factionId) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank: target.rank as RankCode,
        newRank: targetRank,
        error: 'Different faction',
      };
    }
    
    // T.O 체크
    const config = this.sessionConfigs.get(sessionId) || { toMultiplier: 1.0 };
    const to = await this.ladderService.checkTO(
      sessionId, 
      target.factionId, 
      targetRank, 
      config.toMultiplier
    );
    
    if (to.max !== -1 && to.available <= 0) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank: target.rank as RankCode,
        newRank: targetRank,
        error: 'T.O exceeded',
      };
    }
    
    // 승진 실행
    return this.executePromotion(sessionId, targetId, targetRank, 'manual', appointerId);
  }
  
  /**
   * 승진 실행
   */
  private async executePromotion(
    sessionId: string,
    characterId: string,
    newRank: RankCode,
    type: 'auto' | 'manual',
    appointerId?: string
  ): Promise<PromotionResult> {
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    
    if (!entry) {
      return {
        success: false,
        characterId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank,
        error: 'Character not found',
      };
    }
    
    const oldRank = entry.rank as RankCode;
    
    try {
      // 계급 변경
      await this.ladderService.changeRank(sessionId, characterId, newRank, 'promotion');
      
      // Character 모델 동기화 (commandCards 업데이트 등 필요 시)
      await this.syncCharacterRank(sessionId, characterId, newRank);
      
      // 이벤트 발행
      this.emit('promotion:executed', {
        sessionId,
        characterId,
        characterName: entry.characterName,
        oldRank,
        newRank,
        type,
        appointerId,
        timestamp: new Date(),
      });
      
      logger.info('[PromotionService] Promotion executed', {
        sessionId,
        characterId,
        oldRank,
        newRank,
        type,
      });
      
      return {
        success: true,
        characterId,
        characterName: entry.characterName,
        oldRank,
        newRank,
        reason: type === 'auto' ? 'Automatic monthly promotion' : `Manual promotion by ${appointerId}`,
      };
    } catch (error) {
      logger.error('[PromotionService] Promotion execution failed', { 
        sessionId, characterId, error 
      });
      
      return {
        success: false,
        characterId,
        characterName: entry.characterName,
        oldRank,
        newRank,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ==========================================================================
  // Demotion Logic
  // ==========================================================================
  
  /**
   * 강등 처리
   */
  async demote(
    sessionId: string,
    appointerId: string,
    targetId: string,
    reason: string
  ): Promise<DemotionResult> {
    // 인사권자 검증
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: RankCode.PRIVATE_2ND,
        reason,
        error: 'Appointer not found',
      };
    }
    
    // 대상자 조회
    const target = await RankLadder.findOne({ 
      sessionId, 
      characterId: targetId, 
      status: 'active' 
    });
    
    if (!target) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        oldRank: RankCode.PRIVATE_2ND,
        newRank: RankCode.PRIVATE_2ND,
        reason,
        error: 'Target not found',
      };
    }
    
    // 인사권 체크
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    if (appointerRankDef.authorityLevel < 11) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank: target.rank as RankCode,
        newRank: target.rank as RankCode,
        reason,
        error: 'Insufficient authority',
      };
    }
    
    // 인사권자보다 낮은 계급만 강등 가능
    if (compareRanks(appointer.rank as RankCode, target.rank as RankCode) <= 0) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank: target.rank as RankCode,
        newRank: target.rank as RankCode,
        reason,
        error: 'Cannot demote equal or higher rank',
      };
    }
    
    // 이전 계급 조회
    const prevRank = getPreviousRank(target.rank as RankCode);
    
    if (!prevRank) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank: target.rank as RankCode,
        newRank: target.rank as RankCode,
        reason,
        error: 'Already at lowest rank',
      };
    }
    
    const oldRank = target.rank as RankCode;
    
    try {
      // 계급 변경
      await this.ladderService.changeRank(sessionId, targetId, prevRank.code, 'demotion');
      
      // Character 모델 동기화
      await this.syncCharacterRank(sessionId, targetId, prevRank.code);
      
      // 이벤트 발행
      this.emit('demotion:executed', {
        sessionId,
        characterId: targetId,
        characterName: target.characterName,
        oldRank,
        newRank: prevRank.code,
        reason,
        appointerId,
        timestamp: new Date(),
      });
      
      logger.info('[PromotionService] Demotion executed', {
        sessionId,
        characterId: targetId,
        oldRank,
        newRank: prevRank.code,
        reason,
      });
      
      return {
        success: true,
        characterId: targetId,
        characterName: target.characterName,
        oldRank,
        newRank: prevRank.code,
        reason,
      };
    } catch (error) {
      logger.error('[PromotionService] Demotion failed', { sessionId, targetId, error });
      
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        oldRank,
        newRank: prevRank.code,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ==========================================================================
  // Character Sync
  // ==========================================================================
  
  /**
   * Character 모델과 계급 동기화
   */
  private async syncCharacterRank(
    sessionId: string,
    characterId: string,
    rank: RankCode
  ): Promise<void> {
    // extendedStats에 rank 저장 (기존 Character 스키마 활용)
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { 
        $set: { 
          'extendedStats.rank': RANK_TABLE[rank].tier,
          'data.rank': rank,
          'data.rankName': RANK_TABLE[rank].name,
        } 
      }
    );
  }
  
  // ==========================================================================
  // Configuration
  // ==========================================================================
  
  /**
   * 세션 설정 업데이트
   */
  public setSessionConfig(
    sessionId: string,
    config: { toMultiplier?: number; autoPromotionEnabled?: boolean }
  ): void {
    const existing = this.sessionConfigs.get(sessionId) || {
      toMultiplier: 1.0,
      autoPromotionEnabled: true,
    };
    
    this.sessionConfigs.set(sessionId, { ...existing, ...config });
    
    logger.info('[PromotionService] Session config updated', { sessionId, config });
  }
  
  /**
   * 세션 설정 조회
   */
  public getSessionConfig(sessionId: string): { toMultiplier: number; autoPromotionEnabled: boolean } {
    return this.sessionConfigs.get(sessionId) || {
      toMultiplier: 1.0,
      autoPromotionEnabled: true,
    };
  }
}

export default PromotionService;

