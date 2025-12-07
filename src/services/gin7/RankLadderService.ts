/**
 * GIN7 RankLadder Service
 * 
 * Redis ZSet 기반 실시간 랭킹 시스템
 * 동점자 처리를 위해 복합 스코어 사용
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 * 
 * 동점자 처리 규칙:
 * 1차: 공적치 (merit)
 * 2차: 임관일 (enlistmentDate) - 빠를수록 우선
 * 3차: 나이 (birthDate) - 많을수록 우선
 */

import { EventEmitter } from 'events';
import { redis } from '../../config/redis';
import { RankLadder, IRankLadderEntry } from '../../models/gin7/RankLadder';
import { RankCode, getRankDefinition, getNextRank } from '../../config/gin7/ranks';
import { logger } from '../../common/logger';

// ============================================================================
// Types
// ============================================================================

export interface LadderUpdatePayload {
  sessionId: string;
  factionId: string;
  characterId: string;
  rank: RankCode;
  merit: number;
  position: number;
}

export interface LadderEntry {
  characterId: string;
  characterName: string;
  rank: RankCode;
  merit: number;
  position: number;
  enlistmentDate: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class RankLadderService extends EventEmitter {
  private static instance: RankLadderService;
  
  /**
   * Redis Key 패턴:
   * - ladder:{sessionId}:{factionId}:{rank} - 계급별 ZSet
   * - ladder:global:{sessionId}:{factionId} - 전체 랭킹 ZSet
   */
  private readonly LADDER_KEY_PREFIX = 'gin7:ladder';
  
  private constructor() {
    super();
  }
  
  public static getInstance(): RankLadderService {
    if (!RankLadderService.instance) {
      RankLadderService.instance = new RankLadderService();
    }
    return RankLadderService.instance;
  }
  
  // ==========================================================================
  // Core Redis Operations
  // ==========================================================================
  
  /**
   * Redis Key 생성
   */
  private getLadderKey(sessionId: string, factionId: string, rank: RankCode): string {
    return `${this.LADDER_KEY_PREFIX}:${sessionId}:${factionId}:${rank}`;
  }
  
  private getGlobalKey(sessionId: string, factionId: string): string {
    return `${this.LADDER_KEY_PREFIX}:global:${sessionId}:${factionId}`;
  }
  
  /**
   * 복합 스코어 계산
   * 
   * 스코어 = merit * 1e12 + (MAX_TIMESTAMP - enlistmentTimestamp) * 1e6 + (MAX_TIMESTAMP - birthTimestamp)
   * 
   * 이렇게 하면:
   * - 공적치가 높을수록 스코어 높음
   * - 공적치가 같으면 임관일이 빠를수록(timestamp 작을수록) 스코어 높음
   * - 둘 다 같으면 생년월일이 빠를수록(나이 많을수록) 스코어 높음
   */
  private calculateCompositeScore(
    merit: number,
    enlistmentDate: Date,
    birthDate: Date
  ): number {
    const MAX_TIMESTAMP = 9999999999999; // 먼 미래 (2286년경)
    
    const enlistmentMs = enlistmentDate.getTime();
    const birthMs = birthDate.getTime();
    
    // 공적치 부분: 최대 999,999 정도 가정
    const meritScore = merit * 1e12;
    
    // 임관일 부분: 빠를수록 높은 점수
    const enlistmentScore = (MAX_TIMESTAMP - enlistmentMs) * 1e-3;
    
    // 생년월일 부분: 빠를수록 높은 점수
    const birthScore = (MAX_TIMESTAMP - birthMs) * 1e-12;
    
    return meritScore + enlistmentScore + birthScore;
  }
  
  /**
   * 공적치 업데이트 (ZADD)
   */
  async updateMerit(
    sessionId: string,
    factionId: string,
    characterId: string,
    merit: number,
    enlistmentDate: Date,
    birthDate: Date,
    rank: RankCode
  ): Promise<void> {
    const key = this.getLadderKey(sessionId, factionId, rank);
    const globalKey = this.getGlobalKey(sessionId, factionId);
    const score = this.calculateCompositeScore(merit, enlistmentDate, birthDate);
    
    // Redis ZSet 업데이트
    await Promise.all([
      redis.zAdd(key, { score, value: characterId }),
      redis.zAdd(globalKey, { score, value: characterId }),
    ]);
    
    // MongoDB 동기화
    await RankLadder.updateOne(
      { sessionId, characterId },
      { $set: { merit, lastUpdated: new Date() } }
    );
    
    // 순위 조회
    const position = await this.getPosition(sessionId, factionId, characterId, rank);
    
    // 이벤트 발행
    this.emit('ladder:updated', {
      sessionId,
      factionId,
      characterId,
      rank,
      merit,
      position,
    } as LadderUpdatePayload);
    
    logger.debug('[RankLadderService] Merit updated', { 
      sessionId, factionId, characterId, rank, merit, position 
    });
  }
  
  /**
   * 공적치 증가
   */
  async addMerit(
    sessionId: string,
    characterId: string,
    amount: number
  ): Promise<{ newMerit: number; position: number }> {
    // MongoDB에서 현재 정보 조회
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    if (!entry) {
      throw new Error(`Character ${characterId} not found in ladder`);
    }
    
    const newMerit = entry.merit + amount;
    const newTotalMerit = entry.totalMerit + amount;
    
    // 업데이트
    await RankLadder.updateOne(
      { sessionId, characterId },
      { 
        $set: { 
          merit: newMerit, 
          totalMerit: newTotalMerit,
          lastUpdated: new Date() 
        } 
      }
    );
    
    // Redis 동기화
    await this.updateMerit(
      sessionId,
      entry.factionId,
      characterId,
      newMerit,
      entry.enlistmentDate,
      entry.birthDate,
      entry.rank as RankCode
    );
    
    const position = await this.getPosition(
      sessionId, 
      entry.factionId, 
      characterId, 
      entry.rank as RankCode
    );
    
    return { newMerit, position };
  }
  
  /**
   * 순위 조회 (ZREVRANK)
   */
  async getPosition(
    sessionId: string,
    factionId: string,
    characterId: string,
    rank: RankCode
  ): Promise<number> {
    const key = this.getLadderKey(sessionId, factionId, rank);
    const rankIndex = await redis.zRevRank(key, characterId);
    
    // Redis에 없으면 MongoDB에서 계산
    if (rankIndex === null) {
      return RankLadder.calculateRankInLadder(sessionId, factionId, rank, characterId);
    }
    
    return rankIndex + 1; // 1-based
  }
  
  /**
   * 계급별 라더 조회 (ZREVRANGE)
   */
  async getLadder(
    sessionId: string,
    factionId: string,
    rank: RankCode,
    start: number = 0,
    end: number = 99
  ): Promise<LadderEntry[]> {
    const key = this.getLadderKey(sessionId, factionId, rank);
    
    // Redis에서 순위순 조회
    const members = await redis.zRange(key, start, end, { REV: true });
    
    if (members.length === 0) {
      // Redis에 없으면 MongoDB에서 조회
      const dbEntries = await RankLadder.getLadder(sessionId, factionId, rank, end - start + 1);
      return dbEntries.map((entry, idx) => ({
        characterId: entry.characterId,
        characterName: entry.characterName,
        rank: entry.rank as RankCode,
        merit: entry.merit,
        position: start + idx + 1,
        enlistmentDate: entry.enlistmentDate,
      }));
    }
    
    // MongoDB에서 상세 정보 조회
    const entries = await RankLadder.find({
      sessionId,
      characterId: { $in: members },
    });
    
    const entryMap = new Map(entries.map(e => [e.characterId, e]));
    
    return members.map((charId, idx) => {
      const entry = entryMap.get(charId);
      return {
        characterId: charId,
        characterName: entry?.characterName || 'Unknown',
        rank,
        merit: entry?.merit || 0,
        position: start + idx + 1,
        enlistmentDate: entry?.enlistmentDate || new Date(),
      };
    });
  }
  
  /**
   * 승진 대상자 조회 (1위)
   */
  async getPromotionCandidate(
    sessionId: string,
    factionId: string,
    rank: RankCode
  ): Promise<IRankLadderEntry | null> {
    const key = this.getLadderKey(sessionId, factionId, rank);
    
    // Redis에서 1위 조회
    const topMember = await redis.zRange(key, 0, 0, { REV: true });
    
    if (topMember.length === 0) {
      return RankLadder.getPromotionCandidate(sessionId, factionId, rank);
    }
    
    return RankLadder.findOne({ 
      sessionId, 
      characterId: topMember[0],
      status: 'active' 
    });
  }
  
  // ==========================================================================
  // Ladder Management
  // ==========================================================================
  
  /**
   * 신규 입대자 등록
   */
  async registerNewRecruit(params: {
    sessionId: string;
    characterId: string;
    factionId: string;
    characterName: string;
    enlistmentDate: Date;
    birthDate: Date;
    initialRank?: RankCode;
  }): Promise<IRankLadderEntry> {
    const {
      sessionId,
      characterId,
      factionId,
      characterName,
      enlistmentDate,
      birthDate,
      initialRank = RankCode.PRIVATE_2ND,
    } = params;
    
    // MongoDB에 생성
    const entry = await RankLadder.create({
      characterId,
      sessionId,
      factionId,
      characterName,
      rank: initialRank,
      merit: 0,
      totalMerit: 0,
      enlistmentDate,
      promotionDate: enlistmentDate,
      birthDate,
      serviceMonths: 0,
      status: 'active',
      lastUpdated: new Date(),
    });
    
    // Redis에 등록
    await this.updateMerit(
      sessionId,
      factionId,
      characterId,
      0,
      enlistmentDate,
      birthDate,
      initialRank
    );
    
    logger.info('[RankLadderService] New recruit registered', { 
      sessionId, characterId, characterName, initialRank 
    });
    
    return entry;
  }
  
  /**
   * 계급 변경 (승진/강등)
   */
  async changeRank(
    sessionId: string,
    characterId: string,
    newRank: RankCode,
    reason: 'promotion' | 'demotion' | 'appointment'
  ): Promise<void> {
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    if (!entry) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    const oldRank = entry.rank as RankCode;
    const oldKey = this.getLadderKey(sessionId, entry.factionId, oldRank);
    const newKey = this.getLadderKey(sessionId, entry.factionId, newRank);
    
    // 이전 계급 라더에서 제거
    await redis.zRem(oldKey, characterId);
    
    // 승진 시 공적치 리셋, 강등 시 유지
    const newMerit = reason === 'promotion' ? 0 : entry.merit;
    
    // MongoDB 업데이트
    await RankLadder.updateOne(
      { sessionId, characterId },
      {
        $set: {
          rank: newRank,
          merit: newMerit,
          promotionDate: new Date(),
          lastUpdated: new Date(),
        }
      }
    );
    
    // 새 계급 라더에 추가
    const score = this.calculateCompositeScore(newMerit, entry.enlistmentDate, entry.birthDate);
    await redis.zAdd(newKey, { score, value: characterId });
    
    this.emit('rank:changed', {
      sessionId,
      characterId,
      oldRank,
      newRank,
      reason,
    });
    
    logger.info('[RankLadderService] Rank changed', {
      sessionId, characterId, oldRank, newRank, reason
    });
  }
  
  /**
   * 라더에서 제거 (퇴역/사망/해임)
   */
  async removeFromLadder(
    sessionId: string,
    characterId: string,
    reason: 'retired' | 'deceased' | 'dismissed'
  ): Promise<void> {
    const entry = await RankLadder.findOne({ sessionId, characterId });
    if (!entry) return;
    
    const key = this.getLadderKey(sessionId, entry.factionId, entry.rank as RankCode);
    const globalKey = this.getGlobalKey(sessionId, entry.factionId);
    
    // Redis에서 제거
    await Promise.all([
      redis.zRem(key, characterId),
      redis.zRem(globalKey, characterId),
    ]);
    
    // MongoDB 상태 업데이트
    await RankLadder.updateOne(
      { sessionId, characterId },
      { $set: { status: reason, lastUpdated: new Date() } }
    );
    
    this.emit('ladder:removed', {
      sessionId,
      characterId,
      reason,
    });
    
    logger.info('[RankLadderService] Removed from ladder', {
      sessionId, characterId, reason
    });
  }
  
  // ==========================================================================
  // Sync & Maintenance
  // ==========================================================================
  
  /**
   * Redis와 MongoDB 동기화
   * 서버 시작 시 또는 정기적으로 실행
   */
  async syncLadderToRedis(sessionId: string, factionId: string): Promise<void> {
    logger.info('[RankLadderService] Starting ladder sync', { sessionId, factionId });
    
    // MongoDB에서 모든 활성 엔트리 조회
    const entries = await RankLadder.find({
      sessionId,
      factionId,
      status: 'active',
    });
    
    // 계급별로 그룹화
    const rankGroups = new Map<RankCode, IRankLadderEntry[]>();
    for (const entry of entries) {
      const rank = entry.rank as RankCode;
      if (!rankGroups.has(rank)) {
        rankGroups.set(rank, []);
      }
      rankGroups.get(rank)!.push(entry);
    }
    
    // 각 계급별로 Redis ZSet 재구성
    for (const [rank, groupEntries] of rankGroups) {
      const key = this.getLadderKey(sessionId, factionId, rank);
      
      // 기존 데이터 삭제
      await redis.del(key);
      
      // 새로 추가
      if (groupEntries.length > 0) {
        const members = groupEntries.map(entry => ({
          score: this.calculateCompositeScore(entry.merit, entry.enlistmentDate, entry.birthDate),
          value: entry.characterId,
        }));
        
        await redis.zAdd(key, members);
      }
    }
    
    // 전체 랭킹 ZSet 재구성
    const globalKey = this.getGlobalKey(sessionId, factionId);
    await redis.del(globalKey);
    
    if (entries.length > 0) {
      const globalMembers = entries.map(entry => ({
        score: this.calculateCompositeScore(entry.totalMerit, entry.enlistmentDate, entry.birthDate),
        value: entry.characterId,
      }));
      
      await redis.zAdd(globalKey, globalMembers);
    }
    
    logger.info('[RankLadderService] Ladder sync completed', {
      sessionId,
      factionId,
      totalEntries: entries.length,
      rankGroups: rankGroups.size,
    });
  }
  
  /**
   * 계급별 인원수 조회
   */
  async getRankCounts(
    sessionId: string,
    factionId: string
  ): Promise<Map<RankCode, number>> {
    const counts = await RankLadder.aggregate([
      { $match: { sessionId, factionId, status: 'active' } },
      { $group: { _id: '$rank', count: { $sum: 1 } } },
    ]);
    
    const result = new Map<RankCode, number>();
    for (const item of counts) {
      result.set(item._id as RankCode, item.count);
    }
    
    return result;
  }
  
  /**
   * T.O(정원) 체크
   */
  async checkTO(
    sessionId: string,
    factionId: string,
    rank: RankCode,
    toMultiplier: number = 1.0
  ): Promise<{ current: number; max: number; available: number }> {
    const rankDef = getRankDefinition(rank);
    const baseTO = rankDef.baseTO;
    
    // 무제한(-1)인 경우
    if (baseTO === -1) {
      return { current: 0, max: -1, available: -1 };
    }
    
    const maxTO = Math.floor(baseTO * toMultiplier);
    const currentCount = await RankLadder.countDocuments({
      sessionId,
      factionId,
      rank,
      status: 'active',
    });
    
    return {
      current: currentCount,
      max: maxTO,
      available: maxTO - currentCount,
    };
  }
}

export default RankLadderService;

