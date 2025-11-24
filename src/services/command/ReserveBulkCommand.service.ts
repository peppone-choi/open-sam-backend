import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { resolveCommandAuthContext } from './command-auth.helper';

const MAX_TURN = 50;
 
export class ReserveBulkCommandService {
  static async execute(data: any, user?: any) {
    const authResult = resolveCommandAuthContext(data, user);
    if (!authResult.ok) {
      return authResult.error;
    }

    const { sessionId, generalId, userId } = authResult.context;
    const commandList = data.commands || data;

    const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
    if (!ownershipCheck.valid) {
      return {
        success: false,
        result: false,
        message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.',
        reason: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.'
      };
    }

    if (!Array.isArray(commandList)) {
      return { success: false, message: '올바른 형식이 아닙니다', result: false, reason: '올바른 형식이 아닙니다' };
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
          message: `${idx}: 액션이 필요합니다`,
          reason: `${idx}: 액션이 필요합니다`,
          briefList,
          errorIdx: idx
        };
      }
 
      if (!rawTurnList || rawTurnList.length === 0) {
        return {
          success: false,
          result: false,
          message: `${idx}: 턴이 입력되지 않았습니다`,
          reason: `${idx}: 턴이 입력되지 않았습니다`,
          briefList,
          errorIdx: idx
        };
      }
 
      const turnList = expandTurnList(rawTurnList);
 
      if (turnList.length === 0) {
        return {
          success: false,
          result: false,
          message: `${idx}: 올바른 턴이 아닙니다`,
          reason: `${idx}: 올바른 턴이 아닙니다`,
          briefList,
          errorIdx: idx
        };
      }


      try {
        const brief = action;

        for (const turnIdx of turnList) {
          await generalTurnRepository.findOneAndUpdate(
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
          message: error.message,
          reason: error.message,
          briefList,
          errorIdx: idx
        };
      }
    }


    const response = {
      success: true,
      result: true,
      briefList,
      reason: 'success'
    };

    await invalidateCache('general', sessionId, Number(generalId));

    return response;

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
