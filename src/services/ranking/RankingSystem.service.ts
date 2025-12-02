// @ts-nocheck - Type issues with Mongoose models need investigation
/**
 * RankingSystemService
 * 
 * 랭킹 및 명예의 전당 시스템
 * - 개인 랭킹 (공적, 전투, 내정)
 * - 국가 랭킹
 * - 역대 기록 (명예의 전당)
 */

import { RankData } from '../../models/rank_data.model';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../utils/KVStorage';
import { logger } from '../../common/logger';

// 랭킹 타입
export enum RankingType {
  // 개인 랭킹
  MERIT = 'merit',             // 공적 랭킹
  BATTLE = 'battle',           // 전투 랭킹 (전투 횟수)
  KILL = 'kill',               // 사살 랭킹
  DEATH = 'death',             // 전사 랭킹
  DOMESTIC = 'domestic',       // 내정 랭킹
  EXPERIENCE = 'experience',   // 경험치 랭킹
  GOLD = 'gold',               // 재산 랭킹
  BET_GOLD = 'betgold',        // 베팅 금액 랭킹
  BET_WIN = 'betwin',          // 베팅 승리 횟수
  BET_WIN_GOLD = 'betwingold', // 베팅 획득 금액
  
  // 상속 관련
  INHERIT_EARNED = 'inherit_point_earned_by_action',   // 획득한 유산 포인트
  INHERIT_SPENT = 'inherit_point_spent_dynamic',       // 사용한 유산 포인트
  
  // 국가 랭킹
  NATION_POWER = 'nation_power',       // 국력
  NATION_TERRITORY = 'nation_territory', // 영토
  NATION_GENERALS = 'nation_generals', // 장수 수
  NATION_ARMY = 'nation_army',         // 군사력
}

// 랭킹 카테고리
export enum RankingCategory {
  PERSONAL = 'personal',
  NATION = 'nation',
  HALL_OF_FAME = 'hall_of_fame',
}

// 랭킹 항목 인터페이스
export interface RankingEntry {
  rank: number;
  id: number;          // generalId 또는 nationId
  name: string;
  value: number;
  extra?: Record<string, any>;
}

// 명예의 전당 항목
export interface HallOfFameEntry {
  season: number;
  sessionId: string;
  type: string;
  generalId: number;
  generalName: string;
  nationId?: number;
  nationName?: string;
  value: number;
  achievedAt: string;
  description?: string;
}

export class RankingSystemService {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 게임 환경 스토리지 가져오기
   */
  private async getGameEnvStor() {
    return KVStorage.getStorage(`game_env:${this.sessionId}`);
  }

  /**
   * 개인 랭킹 조회
   */
  async getPersonalRanking(type: RankingType, limit: number = 50): Promise<RankingEntry[]> {
    try {
      // rank_data 컬렉션에서 조회
      const rankData = await RankData.find({
        session_id: this.sessionId,
        'data.type': type
      })
        .sort({ 'data.value': -1 })
        .limit(limit)
        .lean();
      
      if (rankData.length === 0) {
        // rank_data에 없으면 general에서 직접 계산
        return this.calculatePersonalRankingFromGenerals(type, limit);
      }
      
      // 장수 정보 조회
      const generalIds = rankData.map((r: any) => r.data?.general_id).filter(Boolean);
      const generals = await General.find({
        session_id: this.sessionId,
        no: { $in: generalIds }
      }).lean();
      
      const generalMap: Record<number, any> = {};
      for (const gen of generals) {
        generalMap[gen.no] = gen;
      }
      
      const rankings: RankingEntry[] = [];
      let rank = 1;
      
      for (const data of rankData) {
        const dataObj = data.data as any;
        const generalId = dataObj?.general_id;
        const general = generalMap[generalId];
        
        if (!general) continue;
        
        rankings.push({
          rank: rank++,
          id: generalId,
          name: general.data?.name || `장수 ${generalId}`,
          value: dataObj?.value || 0,
          extra: {
            nationId: general.data?.nation,
            nationName: general.data?.nationName
          }
        });
      }
      
      return rankings;
    } catch (error: any) {
      logger.error('[RankingSystemService] getPersonalRanking error', { error: error.message });
      return [];
    }
  }

  /**
   * 장수 데이터에서 직접 랭킹 계산
   */
  private async calculatePersonalRankingFromGenerals(type: RankingType, limit: number): Promise<RankingEntry[]> {
    let sortField = '';
    
    switch (type) {
      case RankingType.MERIT:
        sortField = 'data.dedLevel';
        break;
      case RankingType.EXPERIENCE:
        sortField = 'data.experience';
        break;
      case RankingType.GOLD:
        sortField = 'data.gold';
        break;
      case RankingType.KILL:
        sortField = 'data.killnum';
        break;
      case RankingType.DEATH:
        sortField = 'data.deathnum';
        break;
      default:
        sortField = 'data.dedLevel';
    }
    
    const generals = await General.find({
      session_id: this.sessionId,
      'data.npc': { $ne: 1 } // NPC 제외
    })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .lean();
    
    const rankings: RankingEntry[] = [];
    let rank = 1;
    
    for (const general of generals) {
      const data = general.data as any;
      let value = 0;
      
      switch (type) {
        case RankingType.MERIT:
          value = data?.dedLevel || 0;
          break;
        case RankingType.EXPERIENCE:
          value = data?.experience || 0;
          break;
        case RankingType.GOLD:
          value = data?.gold || 0;
          break;
        case RankingType.KILL:
          value = data?.killnum || 0;
          break;
        case RankingType.DEATH:
          value = data?.deathnum || 0;
          break;
      }
      
      rankings.push({
        rank: rank++,
        id: general.no,
        name: data?.name || `장수 ${general.no}`,
        value,
        extra: {
          nationId: data?.nation,
          nationName: data?.nationName
        }
      });
    }
    
    return rankings;
  }

  /**
   * 국가 랭킹 조회
   */
  async getNationRanking(type: RankingType): Promise<RankingEntry[]> {
    try {
      const session = await Session.findOne({ session_id: this.sessionId }).lean();
      const sessionData = session?.data as any || {};
      const nations = sessionData.nations || [];
      
      // 살아있는 국가만 필터링
      const activeNations = nations.filter((n: any) => n.level > 0);
      
      // 랭킹 계산
      const rankings: RankingEntry[] = [];
      
      for (const nation of activeNations) {
        let value = 0;
        
        switch (type) {
          case RankingType.NATION_POWER:
            value = nation.power || nation.tech + nation.defense + nation.wall;
            break;
          case RankingType.NATION_TERRITORY:
            value = nation.cityCount || 0;
            break;
          case RankingType.NATION_GENERALS:
            value = nation.gennum || 0;
            break;
          case RankingType.NATION_ARMY:
            value = nation.totalCrew || 0;
            break;
          default:
            value = nation.power || 0;
        }
        
        rankings.push({
          rank: 0,
          id: nation.nation,
          name: nation.name || `국가 ${nation.nation}`,
          value,
          extra: {
            color: nation.color,
            ruler: nation.rulerName
          }
        });
      }
      
      // 정렬 및 순위 부여
      rankings.sort((a, b) => b.value - a.value);
      rankings.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      return rankings;
    } catch (error: any) {
      logger.error('[RankingSystemService] getNationRanking error', { error: error.message });
      return [];
    }
  }

  /**
   * 전투 랭킹 조회 (상세)
   */
  async getBattleRanking(limit: number = 50): Promise<RankingEntry[]> {
    try {
      // 전투 관련 통계 집계
      const generals = await General.aggregate([
        { $match: { session_id: this.sessionId } },
        {
          $project: {
            no: 1,
            name: '$data.name',
            nation: '$data.nation',
            nationName: '$data.nationName',
            killnum: { $ifNull: ['$data.killnum', 0] },
            deathnum: { $ifNull: ['$data.deathnum', 0] },
            battleScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$data.killnum', 0] }, 10] },
                { $multiply: [{ $ifNull: ['$data.deathnum', 0] }, -5] },
                { $ifNull: ['$data.dedLevel', 0] }
              ]
            }
          }
        },
        { $sort: { battleScore: -1 } },
        { $limit: limit }
      ]);
      
      return generals.map((gen: any, index: number) => ({
        rank: index + 1,
        id: gen.no,
        name: gen.name || `장수 ${gen.no}`,
        value: gen.battleScore,
        extra: {
          killnum: gen.killnum,
          deathnum: gen.deathnum,
          nationId: gen.nation,
          nationName: gen.nationName
        }
      }));
    } catch (error: any) {
      logger.error('[RankingSystemService] getBattleRanking error', { error: error.message });
      return [];
    }
  }

  /**
   * 내정 랭킹 조회 (상세)
   */
  async getDomesticRanking(limit: number = 50): Promise<RankingEntry[]> {
    try {
      const generals = await General.aggregate([
        { $match: { session_id: this.sessionId } },
        {
          $project: {
            no: 1,
            name: '$data.name',
            nation: '$data.nation',
            nationName: '$data.nationName',
            domesticScore: {
              $add: [
                { $ifNull: ['$data.dex1', 0] },
                { $ifNull: ['$data.dex2', 0] },
                { $ifNull: ['$data.dex3', 0] },
                { $ifNull: ['$data.dex4', 0] },
                { $ifNull: ['$data.dex5', 0] }
              ]
            }
          }
        },
        { $sort: { domesticScore: -1 } },
        { $limit: limit }
      ]);
      
      return generals.map((gen: any, index: number) => ({
        rank: index + 1,
        id: gen.no,
        name: gen.name || `장수 ${gen.no}`,
        value: gen.domesticScore,
        extra: {
          nationId: gen.nation,
          nationName: gen.nationName
        }
      }));
    } catch (error: any) {
      logger.error('[RankingSystemService] getDomesticRanking error', { error: error.message });
      return [];
    }
  }

  /**
   * 랭킹 값 업데이트
   */
  async updateRankValue(generalId: number, type: RankingType, value: number, isIncrement: boolean = false): Promise<void> {
    try {
      const filter = {
        session_id: this.sessionId,
        'data.general_id': generalId,
        'data.type': type
      };
      
      if (isIncrement) {
        await RankData.updateOne(
          filter,
          {
            $inc: { 'data.value': value },
            $set: { 'data.updated_at': new Date().toISOString() }
          },
          { upsert: true }
        );
      } else {
        await RankData.updateOne(
          filter,
          {
            $set: {
              'data.value': value,
              'data.updated_at': new Date().toISOString()
            }
          },
          { upsert: true }
        );
      }
      
      logger.debug('[RankingSystemService] Rank value updated', {
        sessionId: this.sessionId,
        generalId,
        type,
        value,
        isIncrement
      });
    } catch (error: any) {
      logger.error('[RankingSystemService] updateRankValue error', { error: error.message });
    }
  }

  /**
   * 명예의 전당 등록
   */
  async registerHallOfFame(entry: Omit<HallOfFameEntry, 'achievedAt'>): Promise<void> {
    try {
      const hallStor = KVStorage.getStorage('hall_of_fame');
      const existingEntries = await hallStor.getValue('entries') || [];
      
      const newEntry: HallOfFameEntry = {
        ...entry,
        achievedAt: new Date().toISOString()
      };
      
      existingEntries.push(newEntry);
      await hallStor.setValue('entries', existingEntries);
      
      logger.info('[RankingSystemService] Hall of Fame entry registered', {
        type: entry.type,
        generalId: entry.generalId,
        value: entry.value
      });
    } catch (error: any) {
      logger.error('[RankingSystemService] registerHallOfFame error', { error: error.message });
    }
  }

  /**
   * 명예의 전당 조회
   */
  async getHallOfFame(type?: string, limit: number = 100): Promise<HallOfFameEntry[]> {
    try {
      const hallStor = KVStorage.getStorage('hall_of_fame');
      let entries = await hallStor.getValue('entries') || [];
      
      if (type) {
        entries = entries.filter((e: HallOfFameEntry) => e.type === type);
      }
      
      // 값 기준 내림차순 정렬
      entries.sort((a: HallOfFameEntry, b: HallOfFameEntry) => b.value - a.value);
      
      return entries.slice(0, limit);
    } catch (error: any) {
      logger.error('[RankingSystemService] getHallOfFame error', { error: error.message });
      return [];
    }
  }

  /**
   * 시즌 종료 시 명예의 전당 업데이트
   */
  async updateHallOfFameOnSeasonEnd(): Promise<void> {
    try {
      const gameStor = await this.getGameEnvStor();
      const season = await gameStor.getValue('season') || 1;
      
      // 각 랭킹 카테고리별 1위 등록
      const rankingTypes = [
        { type: RankingType.MERIT, description: '공적왕' },
        { type: RankingType.KILL, description: '사살왕' },
        { type: RankingType.EXPERIENCE, description: '경험왕' },
        { type: RankingType.BET_WIN_GOLD, description: '베팅왕' },
      ];
      
      for (const rankType of rankingTypes) {
        const ranking = await this.getPersonalRanking(rankType.type, 1);
        
        if (ranking.length > 0) {
          const topEntry = ranking[0];
          
          await this.registerHallOfFame({
            season,
            sessionId: this.sessionId,
            type: rankType.description,
            generalId: topEntry.id,
            generalName: topEntry.name,
            nationId: topEntry.extra?.nationId,
            nationName: topEntry.extra?.nationName,
            value: topEntry.value,
            description: `시즌 ${season} ${rankType.description}`
          });
        }
      }
      
      // 통일 국가 등록
      const session = await Session.findOne({ session_id: this.sessionId }).lean();
      const sessionData = session?.data as any || {};
      const unifiedNation = sessionData.nations?.find((n: any) => n.level > 0);
      
      if (unifiedNation) {
        await this.registerHallOfFame({
          season,
          sessionId: this.sessionId,
          type: '통일 국가',
          generalId: 0,
          generalName: unifiedNation.rulerName || '불명',
          nationId: unifiedNation.nation,
          nationName: unifiedNation.name,
          value: season,
          description: `시즌 ${season} 천하 통일`
        });
      }
      
      logger.info('[RankingSystemService] Hall of Fame updated on season end', {
        sessionId: this.sessionId,
        season
      });
    } catch (error: any) {
      logger.error('[RankingSystemService] updateHallOfFameOnSeasonEnd error', { error: error.message });
    }
  }

  /**
   * 종합 랭킹 조회 (여러 카테고리 통합)
   */
  async getComprehensiveRanking(limit: number = 20): Promise<Record<string, RankingEntry[]>> {
    const [merit, battle, domestic, nation] = await Promise.all([
      this.getPersonalRanking(RankingType.MERIT, limit),
      this.getBattleRanking(limit),
      this.getDomesticRanking(limit),
      this.getNationRanking(RankingType.NATION_POWER)
    ]);
    
    return {
      merit,
      battle,
      domestic,
      nation
    };
  }

  /**
   * 장수의 랭킹 순위 조회
   */
  async getGeneralRanks(generalId: number): Promise<Record<RankingType, number | null>> {
    const result: Record<string, number | null> = {};
    
    const types = [
      RankingType.MERIT,
      RankingType.BATTLE,
      RankingType.KILL,
      RankingType.EXPERIENCE,
      RankingType.GOLD
    ];
    
    for (const type of types) {
      const ranking = await this.getPersonalRanking(type, 500);
      const entry = ranking.find(e => e.id === generalId);
      result[type] = entry?.rank || null;
    }
    
    return result as Record<RankingType, number | null>;
  }
}

/**
 * 서비스 API 엔드포인트
 */
export class RankingSystemAPI {
  /**
   * 개인 랭킹 조회
   */
  static async getPersonalRanking(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const type = data.type as RankingType || RankingType.MERIT;
    const limit = parseInt(data.limit) || 50;
    
    try {
      const service = new RankingSystemService(sessionId);
      const ranking = await service.getPersonalRanking(type, limit);
      
      return { success: true, result: ranking };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 국가 랭킹 조회
   */
  static async getNationRanking(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const type = data.type as RankingType || RankingType.NATION_POWER;
    
    try {
      const service = new RankingSystemService(sessionId);
      const ranking = await service.getNationRanking(type);
      
      return { success: true, result: ranking };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 명예의 전당 조회
   */
  static async getHallOfFame(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const type = data.type || undefined;
    const limit = parseInt(data.limit) || 100;
    
    try {
      const service = new RankingSystemService(sessionId);
      const entries = await service.getHallOfFame(type, limit);
      
      return { success: true, result: entries };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 종합 랭킹 조회
   */
  static async getComprehensiveRanking(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const limit = parseInt(data.limit) || 20;
    
    try {
      const service = new RankingSystemService(sessionId);
      const ranking = await service.getComprehensiveRanking(limit);
      
      return { success: true, result: ranking };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 랭킹 순위 조회
   */
  static async getGeneralRanks(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다.' };
    }
    
    try {
      const service = new RankingSystemService(sessionId);
      const ranks = await service.getGeneralRanks(generalId);
      
      return { success: true, result: ranks };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

