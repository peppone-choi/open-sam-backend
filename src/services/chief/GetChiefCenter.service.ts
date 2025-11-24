// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { NationFinanceService } from '../nation/NationFinance.service';
import GameConstants from '../../utils/game-constants';
import { buildChiefPolicyPayload } from '../nation/helpers/policy.helper';

/**
 * GetChiefCenter Service
 * 제왕(군주)의 특수 기능 및 정보 조회
 */
export class GetChiefCenterService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      let actualGeneralId = generalId;
      
      if (!actualGeneralId) {
        const foundGeneral = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId)
        );
        
        if (!foundGeneral) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
        
        actualGeneralId = foundGeneral.no || foundGeneral.data?.no;
      }
      
      const general = await generalRepository.findBySessionAndNo(sessionId, actualGeneralId);
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      const officerLevel = generalData.officer_level || 0;
      
      // 제왕 권한 확인 (officer_level >= 12 또는 chief)
      if (officerLevel < 12 && generalData.permission !== 'chief') {
        return {
          result: false,
          reason: '제왕 권한이 없습니다'
        };
      }
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      const nation = await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });
      
      if (!nation) {
        return {
          result: false,
          reason: '국가를 찾을 수 없습니다'
        };
      }
      
      const nationData = nation.data || {};
      
      const session = await sessionRepository.findBySessionId(sessionId);
      const sessionData = session?.data || {};
      const gameEnv = sessionData.game_env || {};

      const nationCities = await cityRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
      });

      const nationGenerals = await generalRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
        })
        .lean();

      const goldStats = await NationFinanceService.calculateGoldIncome(nation, nationCities, nationGenerals);
      const riceStats = await NationFinanceService.calculateRiceIncome(nation, nationCities, nationGenerals);

      const policyPayload =
        (await buildChiefPolicyPayload(sessionId, nationId, { nationDoc: nation })) || undefined;

      const center = {
        nation: {
          id: nationId,
          name: nationData.name || nation.name || '무명',
          level: nationData.level || nation.level || 0,
          color: nationData.color || nation.color || '#ffffff',
          capital: nationData.capital || nation.capital || 0,
          type: nationData.type || nation.type || 'none',
          cityCount: nationCities?.length || 0,
          generalCount: nationGenerals?.length || 0,
        },
        chief: {
          generalId: actualGeneralId,
          name: generalData.name || '무명',
          officerLevel: officerLevel,
        },
        powers: {
          gold: nationData.gold || nation.gold || 0,
          rice: nationData.rice || nation.rice || 0,
          tech: nationData.tech || nation.tech || 0,
        },
        policy: policyPayload?.policy || {
          rate: nationData.rate || 0,
          bill: nationData.bill || 100,
          secretLimit: nationData.secretlimit || 1,
          blockWar: Boolean(nationData.war || 0),
          blockScout: Boolean(nationData.scout || 0),
        },
        warSettingCnt:
          policyPayload?.warSettingCnt || {
            remain: 0,
            inc: GameConstants.WAR_BLOCK_SETTING_INC,
            max: GameConstants.WAR_BLOCK_SETTING_MAX,
          },
        notices: policyPayload?.notices || {
          nation: null,
          scout: '',
        },
        finance: {
          gold: {
            current: nationData.gold || nation.gold || 0,
            income: goldStats?.income || 0,
            outcome: goldStats?.outcome || 0,
            net: goldStats?.net || 0,
            breakdown: goldStats?.breakdown || { city: 0, war: 0 },
          },
          rice: {
            current: nationData.rice || nation.rice || 0,
            income: riceStats?.income || 0,
            outcome: riceStats?.outcome || 0,
            net: riceStats?.net || 0,
            breakdown: riceStats?.breakdown || { city: 0, wall: 0 },
          },
        },
        timeline: {
          year: sessionData.year || gameEnv.year || session?.year || 0,
          month: sessionData.month || gameEnv.month || session?.month || 1,
          turnTerm: sessionData.turnterm || gameEnv.turnterm || session?.turnterm || GameConstants.DEFAULT_TURN_TERM,
          maxChiefTurn: GameConstants.MAX_CHIEF_TURN,
        },
      };
      
      return {
        result: true,
        center
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '제왕 센터 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}


