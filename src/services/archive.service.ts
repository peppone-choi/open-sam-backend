/**
 * Archive Service
 * 명예의 전당, 기록 등 아카이브 관련 서비스
 */

import { Hall } from '../models/hall.model';
import { General } from '../models/general.model';
import { Nation } from '../models/nation.model';
import { Session } from '../models/session.model';
import { User } from '../models/user.model';
import { logger } from '../common/logger';

export class ArchiveService {
  /**
   * 명예의 전당 조회
   */
  static async getHallOfFame(seasonIdx?: number, scenarioIdx?: number) {
    try {
      // 시나리오 목록 조회 (ng_games 테이블 대신 Session 사용)
      const scenarioList: any = {};
      
      // 시즌별/시나리오별 그룹화된 세션 조회
      const sessions = await (Session as any).find({}).lean();
      
      for (const session of sessions) {
        const season = session.data?.season || 1;
        const scenario = session.data?.scenario || 0;
        const scenarioName = session.name || '삼국지';
        
        if (!scenarioList[season]) {
          scenarioList[season] = {};
        }
        
        if (!scenarioList[season][scenario]) {
          scenarioList[season][scenario] = {
            season,
            scenario,
            name: scenarioName,
            cnt: 0
          };
        }
        
        scenarioList[season][scenario].cnt++;
      }

      // 명예의 전당 타입별 조회
      const types = [
        { name: 'experience', label: '명성', format: 'int' },
        { name: 'dedication', label: '계급', format: 'int' },
        { name: 'firenum', label: '계략 성공', format: 'int' },
        { name: 'warnum', label: '전투 횟수', format: 'int' },
        { name: 'killnum', label: '승리', format: 'int' },
        { name: 'winrate', label: '승률', format: 'percent' },
        { name: 'occupied', label: '점령', format: 'int' },
        { name: 'killcrew', label: '사살', format: 'int' },
        { name: 'killrate', label: '살상률', format: 'percent' },
        { name: 'dex1', label: '보병 숙련도', format: 'int' },
        { name: 'dex2', label: '궁병 숙련도', format: 'int' },
        { name: 'dex3', label: '기병 숙련도', format: 'int' },
        { name: 'dex4', label: '귀병 숙련도', format: 'int' },
        { name: 'dex5', label: '차병 숙련도', format: 'int' }
      ];

      const hallOfFame: any = {};

      // 필터 조건
      const filter: any = {};
      if (seasonIdx !== undefined) {
        filter.season = seasonIdx;
      }
      if (scenarioIdx !== undefined && seasonIdx !== undefined) {
        filter.scenario = scenarioIdx;
      }

      // 각 타입별로 상위 10개 조회
      for (const type of types) {
        const halls = await (Hall as any)
          .find({
            ...filter,
            type: type.name
          })
          .sort({ value: -1 })
          .limit(10)
          .lean();

        // 장수 정보 조회
        const hallList = await Promise.all(
          halls.map(async (hall: any) => {
            const general = await (General as any).findOne({
              'data.no': hall.general_no
            }).lean();

            if (!general) {
              return null;
            }

            const genData = general.data || {};
            const ownerName = hall.owner 
              ? await this.getOwnerName(hall.owner)
              : null;

            // 값 포맷팅
            let printValue: string;
            if (type.format === 'percent') {
              printValue = (hall.value * 100).toFixed(2) + '%';
            } else {
              printValue = Math.floor(hall.value).toLocaleString();
            }

            return {
              general_no: hall.general_no,
              name: genData.name || general.name,
              value: hall.value,
              printValue,
              owner: hall.owner,
              ownerName,
              picture: genData.picture || '',
              color: genData.color || '#000000',
              ...hall.aux
            };
          })
        );

        hallOfFame[type.name] = {
          label: type.label,
          format: type.format,
          list: hallList.filter((h: any) => h !== null)
        };
      }

      return {
        result: true,
        scenarioList,
        hallOfFame,
        searchSeason: seasonIdx,
        searchScenario: scenarioIdx
      };
    } catch (error: any) {
      logger.error('명예의 전당 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 황제 목록 조회
   */
  static async getEmperorList() {
    try {
      // 통합 완료된 세션 조회 (isunited = 2)
      const sessions = await (Session as any)
        .find({ 'data.isunited': 2 })
        .sort({ 'data.endDate': -1 })
        .limit(100)
        .lean();

      const emperorList = await Promise.all(
        sessions.map(async (session: any) => {
          const sessionData = session.data || {};
          
          // 승리 국가 조회
          const winnerNationId = sessionData.winner_nation || sessionData.winnerNation;
          let winnerNation = null;
          
          if (winnerNationId) {
            const nation = await (Nation as any).findOne({
              session_id: session.session_id,
              'data.nation': winnerNationId
            }).lean();
            
            if (nation) {
              winnerNation = {
                nation: winnerNationId,
                name: nation.name || nation.data?.name,
                color: nation.data?.color || '#000000'
              };
            }
          }

          return {
            id: session._id,
            server_id: session.session_id,
            name: session.name,
            season: sessionData.season || 1,
            scenario: sessionData.scenario || 0,
            scenario_name: session.name,
            date: sessionData.endDate || session.updatedAt,
            winner_nation: winnerNation
          };
        })
      );

      return {
        result: true,
        emperorList
      };
    } catch (error: any) {
      logger.error('황제 목록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 황제 상세 정보 조회
   */
  static async getEmperorDetail(id: string) {
    try {
      const session = await (Session as any).findById(id).lean();
      
      if (!session || session.data?.isunited !== 2) {
        return {
          result: false,
          reason: '통합 완료된 세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data || {};
      const winnerNationId = sessionData.winner_nation || sessionData.winnerNation;
      
      let winnerNation = null;
      if (winnerNationId) {
        const nation = await (Nation as any).findOne({
          session_id: session.session_id,
          'data.nation': winnerNationId
        }).lean();
        
        if (nation) {
          const nationData = nation.data || {};
          
          // 국가 장수 목록
          const generals = await (General as any)
            .find({
              session_id: session.session_id,
              'data.nation': winnerNationId
            })
            .sort({ 'data.officer_level': -1 })
            .limit(50)
            .lean();

          winnerNation = {
            nation: winnerNationId,
            name: nation.name || nationData.name,
            color: nationData.color || '#000000',
            level: nationData.level || 0,
            gold: nationData.gold || 0,
            rice: nationData.rice || 0,
            generals: generals.map((g: any) => ({
              no: g.data?.no || g.no,
              name: g.name || g.data?.name,
              officer_level: g.data?.officer_level || 0,
              leadership: g.data?.leadership || 0,
              strength: g.data?.strength || 0,
              intel: g.data?.intel || 0
            }))
          };
        }
      }

      return {
        result: true,
        emperor: {
          id: session._id,
          server_id: session.session_id,
          name: session.name,
          season: sessionData.season || 1,
          scenario: sessionData.scenario || 0,
          startDate: sessionData.startDate || session.createdAt,
          endDate: sessionData.endDate || session.updatedAt,
          winner_nation: winnerNation,
          env: sessionData.env || {}
        }
      };
    } catch (error: any) {
      logger.error('황제 상세 정보 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 장수 기록 조회
   */
  static async getGeneralRecords(sessionId?: string, limit: number = 100) {
    try {
      const query: any = {};
      if (sessionId) {
        query.server_id = sessionId;
      }

      const halls = await (Hall as any)
        .find(query)
        .sort({ value: -1 })
        .limit(limit)
        .lean();

      const records = await Promise.all(
        halls.map(async (hall: any) => {
          const general = await (General as any).findOne({
            'data.no': hall.general_no
          }).lean();

          if (!general) {
            return null;
          }

          const genData = general.data || {};
          const ownerName = hall.owner 
            ? await this.getOwnerName(hall.owner)
            : null;

          return {
            general_no: hall.general_no,
            name: genData.name || general.name,
            type: hall.type,
            value: hall.value,
            owner: hall.owner,
            ownerName,
            season: hall.season,
            scenario: hall.scenario
          };
        })
      );

      return {
        result: true,
        records: records.filter((r: any) => r !== null)
      };
    } catch (error: any) {
      logger.error('장수 기록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 국가 기록 조회
   */
  static async getNationRecords(sessionId?: string, limit: number = 100) {
    try {
      const query: any = {};
      if (sessionId) {
        query.session_id = sessionId;
      }

      const sessions = await (Session as any)
        .find({
          ...query,
          'data.isunited': 2 // 통합 완료된 세션만
        })
        .sort({ 'data.endDate': -1 })
        .limit(limit)
        .lean();

      const records = await Promise.all(
        sessions.map(async (session: any) => {
          const sessionData = session.data || {};
          const winnerNationId = sessionData.winner_nation || sessionData.winnerNation;
          
          let winnerNation = null;
          if (winnerNationId) {
            const nation = await (Nation as any).findOne({
              session_id: session.session_id,
              'data.nation': winnerNationId
            }).lean();
            
            if (nation) {
              winnerNation = {
                nation: winnerNationId,
                name: nation.name || nation.data?.name
              };
            }
          }

          return {
            id: session._id,
            server_id: session.session_id,
            name: session.name,
            season: sessionData.season || 1,
            scenario: sessionData.scenario || 0,
            endDate: sessionData.endDate || session.updatedAt,
            winner_nation: winnerNation
          };
        })
      );

      return {
        result: true,
        records
      };
    } catch (error: any) {
      logger.error('국가 기록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 최고 장수 목록 조회
   */
  static async getBestGeneralList(sessionId: string, type: string = 'experience', btn?: string) {
    try {
      // 유저/NPC 필터
      const userFilter: any = {};
      if (btn === '유저 보기') {
        userFilter['data.npc'] = 0;
      } else if (btn === 'NPC 보기') {
        userFilter['data.npc'] = { $gt: 0 };
      }

      // Hall에서 해당 타입의 상위 장수 조회
      const halls = await (Hall as any)
        .find({
          server_id: sessionId,
          type
        })
        .sort({ value: -1 })
        .limit(100)
        .lean();

      const generalList = await Promise.all(
        halls.map(async (hall: any) => {
          const general = await (General as any).findOne({
            session_id: sessionId,
            'data.no': hall.general_no,
            ...userFilter
          }).lean();

          if (!general) {
            return null;
          }

          const genData = general.data || {};
          const ownerName = hall.owner 
            ? await this.getOwnerName(hall.owner)
            : null;

          return {
            general_no: hall.general_no,
            name: genData.name || general.name,
            type: hall.type,
            value: hall.value,
            owner: hall.owner,
            ownerName,
            ...genData
          };
        })
      );

      return {
        result: true,
        generalList: generalList.filter((g: any) => g !== null)
      };
    } catch (error: any) {
      logger.error('최고 장수 목록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 최고 장수 조회 (단일)
   */
  static async getBestGeneral(sessionId: string, type: string = 'experience') {
    try {
      const hall = await (Hall as any)
        .findOne({
          server_id: sessionId,
          type
        })
        .sort({ value: -1 })
        .lean();

      if (!hall) {
        return {
          result: false,
          reason: '기록을 찾을 수 없습니다'
        };
      }

      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': hall.general_no
      }).lean();

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};
      const ownerName = hall.owner 
        ? await this.getOwnerName(hall.owner)
        : null;

      return {
        result: true,
        general: {
          no: hall.general_no,
          name: genData.name || general.name,
          type: hall.type,
          value: hall.value,
          owner: hall.owner,
          ownerName,
          ...genData
        }
      };
    } catch (error: any) {
      logger.error('최고 장수 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 장수 목록 조회 (gen-list)
   */
  static async getGenList(sessionId: string, type?: number) {
    try {
      const query: any = { session_id: sessionId };
      
      // type이 있으면 필터 적용
      if (type !== undefined) {
        // type에 따른 필터 로직 (PHP 로직 참고 필요)
      }

      const generals = await (General as any)
        .find(query)
        .sort({ 'data.experience': -1 })
        .limit(1000)
        .lean();

      const generalList = generals.map((g: any) => {
        const genData = g.data || {};
        return {
          no: genData.no || g.no,
          name: genData.name || g.name,
          nation: genData.nation || 0,
          city: genData.city || 0,
          experience: genData.experience || 0,
          leadership: genData.leadership || 0,
          strength: genData.strength || 0,
          intel: genData.intel || 0,
          npc: genData.npc || 0
        };
      });

      return {
        result: true,
        generalList
      };
    } catch (error: any) {
      logger.error('장수 목록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 왕국 목록 조회 (kingdom-list)
   */
  static async getKingdomList() {
    try {
      // 통합 완료된 세션들을 왕국으로 간주
      const sessions = await (Session as any)
        .find({ 'data.isunited': 2 })
        .sort({ 'data.endDate': -1 })
        .limit(100)
        .lean();

      const kingdomList = sessions.map((session: any) => {
        const sessionData = session.data || {};
        return {
          id: session._id,
          server_id: session.session_id,
          name: session.name,
          season: sessionData.season || 1,
          scenario: sessionData.scenario || 0,
          endDate: sessionData.endDate || session.updatedAt,
          winner_nation: sessionData.winner_nation || sessionData.winnerNation
        };
      });

      return {
        result: true,
        kingdomList
      };
    } catch (error: any) {
      logger.error('왕국 목록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * NPC 목록 조회
   */
  static async getNPCList(sessionId: string) {
    try {
      const npcs = await (General as any)
        .find({
          session_id: sessionId,
          'data.npc': { $gt: 0 }
        })
        .sort({ 'data.experience': -1 })
        .limit(1000)
        .lean();

      const npcList = npcs.map((npc: any) => {
        const npcData = npc.data || {};
        return {
          no: npcData.no || npc.no,
          name: npcData.name || npc.name,
          nation: npcData.nation || 0,
          city: npcData.city || 0,
          experience: npcData.experience || 0,
          npc: npcData.npc || 0,
          leadership: npcData.leadership || 0,
          strength: npcData.strength || 0,
          intel: npcData.intel || 0
        };
      });

      return {
        result: true,
        npcList
      };
    } catch (error: any) {
      logger.error('NPC 목록 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 교통 정보 조회 (traffic)
   */
  static async getTraffic(sessionId: string) {
    try {
      // 도시 간 이동 통계 등
      // TODO: 실제 교통 데이터 구현 필요
      // 현재는 기본 구조만 제공
      
      const cities = await require('../models/city.model').City.find({
        session_id: sessionId
      }).lean();

      const traffic = {
        totalCities: cities.length,
        connectedCities: 0, // TODO: 도로 연결 정보 계산
        routes: [] // TODO: 주요 이동 경로 계산
      };

      return {
        result: true,
        traffic
      };
    } catch (error: any) {
      logger.error('교통 정보 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 사용자명 조회 (owner ID로)
   */
  private static async getOwnerName(ownerId: number): Promise<string | null> {
    try {
      const user = await (User as any).findById(ownerId).lean();
      return user ? (user.name || user.username) : null;
    } catch {
      return null;
    }
  }
}

