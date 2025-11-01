import { General } from '../../models/general.model';
import { NationTurn } from '../../models/nation_turn.model';
import GameConstants from '../../utils/game-constants';

const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

export class ReserveCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      const action = data.action;
      const turnList = data.turnList || [];
      const arg = data.arg || {};

      if (!action || action.length < 1) {
        throw new Error('action이 입력되지 않았습니다.');
      }

      if (!turnList || turnList.length === 0) {
        throw new Error('턴이 입력되지 않았습니다');
      }

      if (!Array.isArray(turnList)) {
        throw new Error('turnList는 배열이어야 합니다.');
      }

      for (const turn of turnList) {
        if (typeof turn !== 'number' || !Number.isInteger(turn)) {
          throw new Error('turnList는 정수 배열이어야 합니다.');
        }
      }

      if (typeof arg !== 'object' || arg === null) {
        throw new Error('올바른 arg 형태가 아닙니다.');
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        throw new Error('장수 정보를 찾을 수 없습니다.');
      }

      const generalData = general.data;
      const officerLevel = generalData.officer_level || 1;
      const nationId = generalData.nation;

      if (!nationId) {
        throw new Error('국가에 소속되어 있지 않습니다.');
      }

      if (officerLevel < 5) {
        throw new Error('수뇌가 아닙니다');
      }

      const result = await this.setNationCommand(
        sessionId,
        generalId,
        nationId,
        officerLevel,
        turnList,
        action,
        arg
      );

      return {
        success: result.result,
        result: result.result,
        brief: result.brief,
        reason: result.reason,
        message: result.reason
      };
    } catch (error: any) {
      return {
        success: false,
        result: false,
        message: error.message,
        reason: error.message
      };
    }
  }

  private static async setNationCommand(
    sessionId: string,
    generalId: number,
    nationId: number,
    officerLevel: number,
    turnList: number[],
    command: string,
    arg: any
  ): Promise<any> {
    const uniqueTurnList = [...new Set(turnList)];

    for (const turnIdx of uniqueTurnList) {
      if (!Number.isInteger(turnIdx) || turnIdx < 0 || turnIdx >= MAX_CHIEF_TURN) {
        return {
          result: false,
          reason: `올바른 턴이 아닙니다. : ${turnIdx}`,
          test: 'turnIdx',
          target: turnIdx
        };
      }
    }

    const brief = this.generateBrief(command, arg);

    for (const turnIdx of uniqueTurnList) {
      await NationTurn.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.nation_id': nationId,
          'data.officer_level': officerLevel,
          'data.turn_idx': turnIdx
        },
        {
          $set: {
            session_id: sessionId,
            'data.nation_id': nationId,
            'data.officer_level': officerLevel,
            'data.turn_idx': turnIdx,
            'data.action': command,
            'data.arg': arg,
            'data.brief': brief
          }
        },
        { upsert: true }
      );
    }

    return {
      result: true,
      brief,
      arg_test: true,
      reason: 'success'
    };
  }

  private static generateBrief(command: string, arg: any): string {
    if (arg.destCityID) {
      return `${command} -> ${arg.destCityID}`;
    }
    if (arg.targetGeneralID) {
      return `${command} -> ${arg.targetGeneralID}`;
    }
    return command;
  }
}
