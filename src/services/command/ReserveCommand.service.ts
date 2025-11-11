import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { neutralize, removeSpecialCharacter, getStringWidth } from '../../utils/string-util';
import GameConstants from '../../utils/game-constants';

const MAX_TURN = GameConstants.MAX_TURN;

export class ReserveCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    // general_id를 숫자로 변환 (문자열일 수도 있음)
    let generalId = user?.generalId || data.general_id;
    if (generalId) {
      generalId = Number(generalId);
      if (isNaN(generalId) || generalId === 0) {
        generalId = undefined;
      }
    }
    
    console.log('ReserveCommand.execute:', {
      sessionId,
      generalId,
      generalIdType: typeof generalId,
      userGeneralId: user?.generalId,
      dataGeneralId: data.general_id,
      dataGeneralIdType: typeof data.general_id,
      user: user ? { userId: user.userId, id: user.id } : null,
      data: { action: data.action, turn_idx: data.turn_idx, brief: data.brief }
    });
    
    const action = data.action;
    const brief = data.brief || action; // brief가 있으면 사용, 없으면 action 사용
    // turn_idx (단일 턴) 또는 turnList (여러 턴) 지원
    let rawTurnList: number[] = [];
    if (data.turn_idx !== undefined) {
      rawTurnList = [data.turn_idx];
    } else if (data.turnList) {
      rawTurnList = data.turnList;
    }
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

    // 인자 검증
    const argError = checkCommandArg(arg);
    if (argError !== null) {
      return {
        success: false,
        result: false,
        reason: argError,
        test: 'checkCommandArg',
        target: 'arg'
      };
    }

    const result = await setGeneralCommand(sessionId, generalId, turnList, action, arg, brief);

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
  arg: any,
  brief?: string
): Promise<any> {
  try {
    const finalBrief = brief || action;

    for (const turnIdx of turnList) {
      const result = await generalTurnRepository.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': turnIdx
        },
        {
          $set: {
            'data.action': action,
            'data.arg': arg,
            'data.brief': finalBrief
          }
        },
        { upsert: true, new: true }
      );
      
      console.log('[ReserveCommand] 명령 저장 완료:', {
        sessionId,
        generalId,
        turnIdx,
        action,
        arg,
        brief: finalBrief,
        saved: !!result
      });
    }

    return {
      success: true,
      result: true,
      brief: finalBrief,
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

/**
 * 인자 정제 (PHP sanitizeArg 함수 변환)
 */
function sanitizeArg(arg: any): any {
  if (arg === null || arg === undefined) {
    return arg;
  }

  if (typeof arg !== 'object') {
    return arg;
  }

  const result: any = {};
  
  for (const [key, value] of Object.entries(arg)) {
    if (Array.isArray(value)) {
      result[key] = sanitizeArg(value);
    } else if (typeof value === 'string') {
      result[key] = neutralize(removeSpecialCharacter(value));
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 커맨드 인자 검증 (PHP checkCommandArg 함수 변환)
 */
function checkCommandArg(arg: any): string | null {
  if (arg === null || arg === undefined) {
    return null;
  }

  // 정수 검증
  const intFields = [
    'crewType', 'destGeneralID', 'destCityID', 'destNationID',
    'amount', 'colorType',
    'srcArmType', 'destArmType'
  ];
  for (const field of intFields) {
    if (arg[field] !== undefined && !Number.isInteger(arg[field])) {
      return `${field}는 정수여야 합니다`;
    }
  }

  // 불리언 검증
  const boolFields = ['isGold', 'buyRice'];
  for (const field of boolFields) {
    if (arg[field] !== undefined && typeof arg[field] !== 'boolean') {
      return `${field}는 불리언이어야 합니다`;
    }
  }

  // 범위 검증
  if (arg.month !== undefined) {
    const month = arg.month;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return 'month는 1-12 사이여야 합니다';
    }
  }

  // 최소값 검증
  const minChecks: Array<[string, number]> = [
    ['year', 0],
    ['destGeneralID', 1],
    ['destCityID', 1],
    ['destNationID', 1],
    ['amount', 1],
    ['crewType', 0]
  ];
  for (const [field, min] of minChecks) {
    if (arg[field] !== undefined) {
      const value = arg[field];
      if (!Number.isInteger(value) || value < min) {
        return `${field}는 ${min} 이상이어야 합니다`;
      }
    }
  }

  // 정수 배열 검증
  const intArrayFields = ['destNationIDList', 'destGeneralIDList', 'amountList'];
  for (const field of intArrayFields) {
    if (arg[field] !== undefined) {
      if (!Array.isArray(arg[field])) {
        return `${field}는 배열이어야 합니다`;
      }
      for (const item of arg[field]) {
        if (!Number.isInteger(item)) {
          return `${field}의 모든 항목은 정수여야 합니다`;
        }
      }
    }
  }

  // 문자열 폭 검증
  if (arg.nationName !== undefined) {
    const width = getStringWidth(arg.nationName);
    if (width < 1 || width > 18) {
      return 'nationName의 문자열 폭은 1-18 사이여야 합니다';
    }
  }

  return null;
}
