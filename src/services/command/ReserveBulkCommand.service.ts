import { GeneralTurn } from '../../models/general_turn.model';

const MAX_TURN = 30;

export class ReserveBulkCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const commandList = data.commands || data;

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다', result: false };
    }

    if (!Array.isArray(commandList)) {
      return { success: false, message: '올바른 형식이 아닙니다', result: false };
    }

    const briefList: any = {};

    for (let idx = 0; idx < commandList.length; idx++) {
      const command = commandList[idx];
      const action = command.action;
      const rawTurnList = command.turnList || [];
      const arg = sanitizeArg(command.arg || {});

      if (!action || action.length === 0) {
        return {
          success: false,
          result: false,
          briefList,
          errorIdx: idx,
          reason: `${idx}: 액션이 필요합니다`
        };
      }

      if (!rawTurnList || rawTurnList.length === 0) {
        return {
          success: false,
          result: false,
          briefList,
          errorIdx: idx,
          reason: `${idx}: 턴이 입력되지 않았습니다`
        };
      }

      const turnList = expandTurnList(rawTurnList);

      if (turnList.length === 0) {
        return {
          success: false,
          result: false,
          briefList,
          errorIdx: idx,
          reason: `${idx}: 올바른 턴이 아닙니다`
        };
      }

      try {
        const brief = action;

        for (const turnIdx of turnList) {
          await GeneralTurn.findOneAndUpdate(
            {
              session_id: sessionId,
              'data.general_id': generalId,
              'data.turn_idx': turnIdx
            },
            {
              $set: {
                'data.action': action,
                'data.arg': arg,
                'data.brief': brief
              }
            },
            { upsert: true }
          );
        }

        briefList[idx] = brief;
      } catch (error: any) {
        return {
          success: false,
          result: false,
          briefList,
          errorIdx: idx,
          reason: error.message
        };
      }
    }

    return {
      success: true,
      result: true,
      briefList,
      reason: 'success'
    };
  }
}

function expandTurnList(rawTurnList: number[]): number[] {
  const turnSet = new Set<number>();

  for (const turnIdx of rawTurnList) {
    if (!Number.isInteger(turnIdx)) continue;
    
    if (turnIdx >= 0 && turnIdx < MAX_TURN) {
      turnSet.add(turnIdx);
    } else if (turnIdx === -1) {
      for (let i = 0; i < MAX_TURN; i += 2) {
        turnSet.add(i);
      }
    } else if (turnIdx === -2) {
      for (let i = 1; i < MAX_TURN; i += 2) {
        turnSet.add(i);
      }
    } else if (turnIdx === -3) {
      for (let i = 0; i < MAX_TURN; i++) {
        turnSet.add(i);
      }
    }
  }

  return Array.from(turnSet).sort((a, b) => a - b);
}

function sanitizeArg(arg: any): any {
  if (!arg || typeof arg !== 'object') return {};
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(arg)) {
    if (Array.isArray(value)) {
      result[key] = value.map(v => sanitizeValue(v));
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  
  return result;
}

function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, '').trim();
  }
  return value;
}
