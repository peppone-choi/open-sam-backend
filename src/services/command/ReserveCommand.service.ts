import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { neutralize, removeSpecialCharacter, getStringWidth } from '../../utils/string-util';
import GameConstants from '../../utils/game-constants';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { resolveCommandAuthContext } from './command-auth.helper';

const MAX_TURN = GameConstants.MAX_TURN; // 50

export class ReserveCommandService {
  static async execute(data: any, user?: any) {
    const authResult = resolveCommandAuthContext(data, user);
    if (!authResult.ok) {
      return authResult.error;
    }

    const { sessionId, generalId, userId } = authResult.context;

    const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
    if (!ownershipCheck.valid) {
      return {
        success: false,
        result: false,
        message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.',
        reason: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.'
      };
    }

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
 
    if (!action || action.length === 0) {
      return {
        success: false,
        result: false,
        message: '액션이 필요합니다',
        reason: '액션이 필요합니다'
      };
    }
 
    if (!rawTurnList || rawTurnList.length === 0) {
      return {
        success: false,
        result: false,
        message: '턴이 입력되지 않았습니다',
        reason: '턴이 입력되지 않았습니다'
      };
    }
 
    const turnList = expandTurnList(rawTurnList);
 
    if (turnList.length === 0) {
      return {
        success: false,
        result: false,
        message: '올바른 턴이 아닙니다',
        reason: '올바른 턴이 아닙니다'
      };
    }
 
    // 인자 검증
    const argError = checkCommandArg(arg);
    if (argError !== null) {
      return {
        success: false,
        result: false,
        message: argError,
        reason: argError,
        test: 'checkCommandArg',
        target: 'arg'
      };
    }


    // 커맨드 예약은 turntime에 영향을 주지 않음
    // turntime은 장수 생성 시간 + (turnterm × N)으로 고정
    // 데몬이 밀린 턴을 while 루프로 모두 처리함

    const result = await setGeneralCommand(sessionId, generalId, turnList, action, arg, brief);

    // 캐시 무효화
    if (result.success && typeof generalId === 'number') {
      try {
        await invalidateCache('general', sessionId, generalId);
      } catch (error: any) {
        console.error('Cache invalidation failed:', error);
      }
    }

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
      // 기존 데이터 확인
      const existing = await generalTurnRepository.findOneByFilter({
        session_id: sessionId,
        'data.general_id': generalId,
        'data.turn_idx': turnIdx
      });
      
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
