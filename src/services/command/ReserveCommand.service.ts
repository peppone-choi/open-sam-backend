import { GeneralTurn } from '../../models/general_turn.model';

const MAX_TURN = 30;

export class ReserveCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const action = data.action;
    const rawTurnList = data.turnList || [];
    const arg = sanitizeArg(data.arg || {});

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다', result: false };
    }

    if (!action || action.length === 0) {
      return { success: false, message: '액션이 필요합니다', result: false };
    }

    if (!rawTurnList || rawTurnList.length === 0) {
      return { success: false, message: '턴이 입력되지 않았습니다', result: false };
    }

    const turnList = expandTurnList(rawTurnList);

    if (turnList.length === 0) {
      return { success: false, message: '올바른 턴이 아닙니다', result: false };
    }

    const result = await setGeneralCommand(sessionId, generalId, turnList, action, arg);

    return result;
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

async function setGeneralCommand(
  sessionId: string,
  generalId: number,
  turnList: number[],
  action: string,
  arg: any
): Promise<any> {
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

    return {
      success: true,
      result: true,
      brief,
      reason: 'success'
    };
  } catch (error: any) {
    return {
      success: false,
      result: false,
      reason: error.message
    };
  }
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
