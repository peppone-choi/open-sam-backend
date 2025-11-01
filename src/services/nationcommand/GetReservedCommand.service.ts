import { NationTurn } from '../../models/nation_turn.model';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';
import GameConstants from '../../utils/game-constants';

const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

export class GetReservedCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        throw new Error('장수 정보를 찾을 수 없습니다.');
      }

      const generalData = general.data;
      const nationId = generalData.nation;
      const officerLevel = generalData.officer_level || 1;

      if (!nationId) {
        throw new Error('국가에 소속되어있지 않습니다.');
      }

      const permission = this.checkSecretPermission(generalData);
      if (permission < 0) {
        throw new Error('국가에 소속되어있지 않습니다.');
      } else if (permission < 1) {
        throw new Error('수뇌부가 아니거나 사관년도가 부족합니다.');
      }

      const nation = await Nation.findOne({
        session_id: sessionId,
        'data.nation': nationId
      });

      const nationLevel = nation?.data.level || 0;

      const chiefs = await General.find({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $gte: 5 }
      });

      const generalsByLevel: { [key: number]: any } = {};
      for (const chief of chiefs) {
        generalsByLevel[chief.data.officer_level] = chief.data;
      }

      const nationTurns = await NationTurn.find({
        session_id: sessionId,
        'data.nation_id': nationId
      }).sort({ 'data.officer_level': -1, 'data.turn_idx': 1 });

      const nationTurnList: { [key: number]: { [key: number]: any } } = {};
      const invalidUnderTurnList: { [key: number]: number } = {};
      const invalidOverTurnList: { [key: number]: number } = {};

      for (const turn of nationTurns) {
        let { officer_level, turn_idx, action, arg, brief } = turn.data;

        if (!nationTurnList[officer_level]) {
          nationTurnList[officer_level] = {};
        }

        if (turn_idx < 0) {
          invalidUnderTurnList[officer_level] = turn_idx;
          turn_idx += MAX_CHIEF_TURN;
        } else if (turn_idx >= MAX_CHIEF_TURN) {
          invalidOverTurnList[officer_level] = turn_idx;
          turn_idx -= MAX_CHIEF_TURN;
        }

        nationTurnList[officer_level][turn_idx] = {
          action,
          brief,
          arg: typeof arg === 'string' ? JSON.parse(arg) : arg
        };
      }

      if (Object.keys(invalidUnderTurnList).length > 0) {
        for (const level of Object.keys(invalidUnderTurnList)) {
          await NationTurn.updateMany(
            {
              session_id: sessionId,
              'data.nation_id': nationId,
              'data.officer_level': parseInt(level),
              'data.turn_idx': { $lt: 0 }
            },
            {
              $inc: { 'data.turn_idx': MAX_CHIEF_TURN }
            }
          );
        }
      }

      if (Object.keys(invalidOverTurnList).length > 0) {
        for (const level of Object.keys(invalidOverTurnList)) {
          await NationTurn.updateMany(
            {
              session_id: sessionId,
              'data.nation_id': nationId,
              'data.officer_level': parseInt(level),
              'data.turn_idx': { $gte: MAX_CHIEF_TURN }
            },
            {
              $inc: { 'data.turn_idx': -MAX_CHIEF_TURN }
            }
          );
        }
      }

      const troops = await Troop.find({
        session_id: sessionId,
        'data.nation': nationId
      });

      const troopList: { [key: number]: string } = {};
      for (const troop of troops) {
        troopList[troop.data.troop_leader] = troop.data.name;
      }

      const nationChiefList: { [key: number]: any } = {};
      for (const [level, turnBrief] of Object.entries(nationTurnList)) {
        const officerLevelNum = parseInt(level);
        const chiefGeneral = generalsByLevel[officerLevelNum];

        if (!chiefGeneral) {
          nationChiefList[officerLevelNum] = {
            name: null,
            turnTime: null,
            officerLevelText: this.getOfficerLevelText(officerLevelNum, nationLevel),
            npcType: null,
            turn: turnBrief
          };
          continue;
        }

        nationChiefList[officerLevelNum] = {
          name: chiefGeneral.name,
          turnTime: chiefGeneral.turntime,
          officerLevel: chiefGeneral.officer_level,
          officerLevelText: this.getOfficerLevelText(chiefGeneral.officer_level, nationLevel),
          npcType: chiefGeneral.npc,
          turn: turnBrief
        };
      }

      const sessionData = await Session.findOne({ session_id: sessionId });
      const gameEnv = sessionData?.data?.game_env || {};

      return {
        success: true,
        result: true,
        lastExecute: gameEnv.turntime || new Date(),
        year: gameEnv.year || 184,
        month: gameEnv.month || 1,
        turnTerm: gameEnv.turnterm || 600,
        date: new Date(),
        chiefList: nationChiefList,
        troopList,
        isChief: officerLevel > 4,
        autorun_limit: generalData.autorun_limit || 0,
        officerLevel,
        commandList: {},
        mapName: gameEnv.mapName || 'default',
        unitSet: gameEnv.unitSet || 'default'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static checkSecretPermission(generalData: any): number {
    const officerLevel = generalData.officer_level || 1;
    const permission = generalData.permission || '';
    const penalty = generalData.penalty || 0;
    const belong = generalData.belong || 0;

    if (belong === 0) {
      return -1;
    }

    if (officerLevel >= 5) {
      return 2;
    }

    if (permission.includes('SecretTurnPush')) {
      return 1;
    }

    return 0;
  }

  private static getOfficerLevelText(officerLevel: number, nationLevel: number): string {
    const officerNames = [
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['수뇌', '수뇌', '수뇌', '수뇌', '수뇌'],
      ['수뇌', '수뇌', '장군', '장군', '장군'],
      ['수뇌', '군단장', '대장군', '대장군', '대장군'],
      ['수뇌', '군단장', '대장군', '대장군', '대장군'],
      ['수뇌', '부군주', '군주보', '태위', '대사마'],
      ['군주', '군주', '군주', '군주', '군주'],
      ['황제', '황제', '황제', '황제', '황제'],
      ['태황제', '태황제', '태황제', '태황제', '태황제']
    ];

    if (officerLevel >= officerNames.length) {
      return '태황제';
    }

    const levelIdx = Math.min(Math.max(nationLevel, 0), 4);
    return officerNames[officerLevel]?.[levelIdx] || '일반';
  }
}
