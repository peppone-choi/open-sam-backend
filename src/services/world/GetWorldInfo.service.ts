import { sessionRepository } from '../../repositories/session.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { General } from '../../models/general.model';

/**
 * GetWorldInfo Service
 * 게임 세계의 전반적인 정보 조회
 */
export class GetWorldInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }
      
      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      
      // 국가 목록 조회
      const nations = await nationRepository.findBySession(sessionId);
      
      const nationList = nations.map((nation: any) => {
        const nationData = nation.data || {};
        return {
          nation: nationData.nation || nation.nation,
          name: nationData.name || nation.name || '무명',
          color: nationData.color || '#000000',
          level: nationData.level || 0,
          capital: nationData.capital || 0,
          gennum: nationData.gennum || 0,
          power: nationData.power || 0
        };
      });
      
      // 장수 통계
      const generalStats = await General.aggregate([
        { $match: { session_id: sessionId } },
        { $group: { 
          _id: '$data.npc', 
          count: { $sum: 1 } 
        } }
      ]);
      
      const genCount: [number, number][] = generalStats.map((stat: any) => [
        stat._id || 0,
        stat.count || 0
      ]);
      
      // 도시 통계
      const cityCount = await cityRepository.count({
        session_id: sessionId
      });
      
      // 세계 정보 구성
      const worldInfo = {
        session: {
          scenario: sessionData.scenario || '삼국지',
          year: gameEnv.year || sessionData.year || 180,
          month: gameEnv.month || sessionData.month || 1,
          startyear: gameEnv.startyear || sessionData.startyear || 180,
          turnterm: gameEnv.turnterm || sessionData.turnterm || 1440,
          lastExecuted: sessionData.turntime || new Date().toISOString()
        },
        nations: {
          total: nationList.length,
          list: nationList
        },
        generals: {
          total: genCount.reduce((sum, [_, count]) => sum + count, 0),
          count: genCount
        },
        cities: {
          total: cityCount
        },
        game: {
          isLocked: gameEnv.is_locked || false,
          isFiction: gameEnv.is_fiction || 0,
          npcMode: gameEnv.npcmode || 0,
          joinMode: gameEnv.join_mode === 0 ? 'onlyRandom' : 'full'
        }
      };
      
      return {
        result: true,
        world: worldInfo
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '세계 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}


