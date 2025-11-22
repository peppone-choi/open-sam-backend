import { generalRepository } from '../../repositories/general.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import GameConstants from '../../utils/game-constants';

const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

export class ReserveBulkCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!Array.isArray(data.commands) && typeof data === 'object') {
        const commandsArray = Object.values(data).filter(
          (item: any) => item && typeof item === 'object' && item.action
        );
        
        if (commandsArray.length === 0) {
          throw new Error('commands 배열이 필요합니다.');
        }
        
        data = commandsArray;
      }

      const commands = Array.isArray(data) ? data : (data.commands || []);

      if (!Array.isArray(commands) || commands.length === 0) {
        throw new Error('commands 배열이 필요합니다.');
      }

      for (let idx = 0; idx < commands.length; idx++) {
        const turn = commands[idx];
        
        if (!turn.action || turn.action.length < 1) {
          throw new Error(`${idx}: action이 입력되지 않았습니다.`);
        }

        if (!turn.turnList || !Array.isArray(turn.turnList)) {
          throw new Error(`${idx}: turnList는 배열이어야 합니다.`);
        }

        for (const turnIdx of turn.turnList) {
          if (typeof turnIdx !== 'number' || !Number.isInteger(turnIdx)) {
            throw new Error(`${idx}: turnList는 정수 배열이어야 합니다.`);
          }
        }
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

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

      const briefList: { [key: number]: string } = {};

      for (let idx = 0; idx < commands.length; idx++) {
        const turn = commands[idx];
        const action = turn.action;
        const turnList = turn.turnList;
        const arg = turn.arg || {};

        if (!turnList || turnList.length === 0) {
          return {
            success: false,
            result: false,
            briefList,
            errorIdx: idx,
            reason: `${idx}: 턴이 입력되지 않았습니다`,
            message: `${idx}: 턴이 입력되지 않았습니다`
          };
        }

        if (typeof arg !== 'object' || arg === null) {
          return {
            success: false,
            result: false,
            briefList,
            errorIdx: idx,
            reason: `${idx}: 올바른 arg 형태가 아닙니다.`,
            message: `${idx}: 올바른 arg 형태가 아닙니다.`
          };
        }

        const partialResult = await this.setNationCommand(
          sessionId,
          generalId,
          nationId,
          officerLevel,
          turnList,
          action,
          arg
        );

        if (!partialResult.result) {
          return {
            success: false,
            result: false,
            briefList,
            errorIdx: idx,
            reason: partialResult.reason,
            message: partialResult.reason
          };
        }

        briefList[idx] = partialResult.brief;
      }

      return {
        success: true,
        result: true,
        briefList,
        reason: 'success',
        message: '국가 명령 예약을 저장했습니다.'
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
      await nationTurnRepository.findOneAndUpdate(
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
