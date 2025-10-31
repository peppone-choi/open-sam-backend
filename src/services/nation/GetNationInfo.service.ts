import { nationRepository } from '../../repositories/nation.repository';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';

/**
 * GetNationInfo Service
 * 국가 정보 조회
 * PHP: /sam/hwe/sammo/API/Nation/GetNationInfo.php
 */
export class GetNationInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const isFull = data.full === 'true' || data.full === true;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      // 장수 정보 조회
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;

      // 국가가 없으면 재야 정보 반환
      if (nationId === 0) {
        return {
          success: true,
          result: true,
          nation: {
            nation: 0,
            name: '재야',
            color: 0,
            capital: 0,
            gennum: 0,
            gold: 0,
            rice: 0,
            bill: 0,
            rate: 10,
            secretlimit: 0,
            chief_set: null,
            scout: 0,
            war: 0,
            strategic_cmd_limit: {},
            surlimit: 0,
            tech: 0,
            power: 0,
            level: 0,
            type: 'None'
          }
        };
      }

      // 간단한 정보만 필요한 경우
      if (!isFull) {
        const nation = await Nation.findOne({
          session_id: sessionId,
          'data.nation': nationId
        });

        if (!nation) {
          return { success: false, message: '국가를 찾을 수 없습니다' };
        }

        return {
          success: true,
          result: true,
          nation: {
            nation: nationId,
            name: nation.data?.name || '무명',
            color: nation.data?.color || 0,
            capital: nation.data?.capital || 0,
            gennum: nation.data?.gennum || 0,
            gold: nation.data?.gold || 0,
            rice: nation.data?.rice || 0,
            level: nation.data?.level || 0,
            type: nation.data?.type || 'None'
          }
        };
      }

      // 전체 정보 조회
      const nation = await Nation.findOne({
        session_id: sessionId,
        'data.nation': nationId
      });

      if (!nation) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      // 세션 정보 (year, month 등)
      const session = await Session.findOne({ session_id: sessionId });
      const sessionData = session?.data || {};

      // 부대 정보 조회
      const troops = await Troop.find({
        session_id: sessionId,
        'data.nation': nationId
      });

      const troopName: Record<number, string> = {};
      troops.forEach(troop => {
        const troopLeader = troop.data?.troop_leader;
        const name = troop.data?.name;
        if (troopLeader && name) {
          troopName[troopLeader] = name;
        }
      });

      // impossibleStrategicCommandLists는 복잡한 로직이므로 일단 빈 배열로
      const impossibleStrategicCommandLists: any[] = [];

      const result = {
        success: true,
        result: true,
        isFull: true,
        nation: {
          nation: nationId,
          name: nation.data?.name || '무명',
          color: nation.data?.color || 0,
          capital: nation.data?.capital || 0,
          gennum: nation.data?.gennum || 0,
          gold: nation.data?.gold || 0,
          rice: nation.data?.rice || 0,
          bill: nation.data?.bill || 0,
          rate: nation.data?.rate || 10,
          secretlimit: nation.data?.secretlimit || 0,
          chief_set: nation.data?.chief_set || null,
          scout: nation.data?.scout || 0,
          war: nation.data?.war || 0,
          strategic_cmd_limit: nation.data?.strategic_cmd_limit || {},
          surlimit: nation.data?.surlimit || 0,
          tech: nation.data?.tech || 0,
          power: nation.data?.power || 0,
          level: nation.data?.level || 0,
          type: nation.data?.type || 'None'
        },
        impossibleStrategicCommandLists,
        troops: troopName
      };

      return result;
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
