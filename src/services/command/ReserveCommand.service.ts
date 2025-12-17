import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { generalRepository } from '../../repositories/general.repository';
import { neutralize, removeSpecialCharacter, getStringWidth } from '../../utils/string-util';
import GameConstants from '../../utils/game-constants';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { resolveCommandAuthContext } from './command-auth.helper';
import Redis from 'ioredis';

// Redis 싱글턴
let redisClient: Redis | null = null;
function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (url) {
      redisClient = new Redis(url);
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      });
    }
  }
  return redisClient;
}

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
    
    // 디버깅: 요청 데이터 로깅
    console.log('[ReserveCommand] 원본 data 전체:', JSON.stringify(data));
    console.log('[ReserveCommand] 요청 데이터:', JSON.stringify({
      sessionId,
      generalId,
      action,
      brief,
      turn_idx: data.turn_idx,
      turnList: data.turnList,
      arg: data.arg,
      argType: typeof data.arg
    }));
    
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
 
    let turnList = expandTurnList(rawTurnList);
 
    if (turnList.length === 0) {
      return {
        success: false,
        result: false,
        message: '올바른 턴이 아닙니다',
        reason: '올바른 턴이 아닙니다'
      };
    }

    // 턴 실행 중인 경우 락이 풀릴 때까지 대기 (최대 30초)
    // 60분 턴에서 1시간 날리는 것 방지
    let turnAdjusted = false;
    if (turnList.includes(0)) {
      try {
        const redis = getRedisClient();
        const lockKey = `execute_engine_lock:${sessionId}`;
        
        const MAX_WAIT_MS = 30000; // 최대 30초 대기
        const CHECK_INTERVAL_MS = 500; // 0.5초마다 체크
        const startTime = Date.now();
        
        let lockExists = await redis.exists(lockKey);
        
        if (lockExists) {
          console.log(`[ReserveCommand] 턴 실행 중 감지 - 락 해제 대기 시작 (sessionId: ${sessionId})`);
          
          // 락이 풀릴 때까지 대기
          while (lockExists && (Date.now() - startTime) < MAX_WAIT_MS) {
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
            lockExists = await redis.exists(lockKey);
          }
          
          if (lockExists) {
            // 30초 지나도 락이 안 풀림 - 다음 턴으로 조정
            turnList = turnList.map(t => t === 0 ? 1 : t);
            turnList = [...new Set(turnList)].sort((a, b) => a - b);
            turnAdjusted = true;
            console.log(`[ReserveCommand] 대기 시간 초과 - turn_idx 0을 1로 조정 (대기: ${Date.now() - startTime}ms)`);
          } else {
            console.log(`[ReserveCommand] 락 해제됨 - turn_idx 0 유지 (대기: ${Date.now() - startTime}ms)`);
          }
        }
      } catch (error) {
        console.warn('[ReserveCommand] 턴 실행 락 확인 실패:', error);
        // 락 확인 실패해도 계속 진행
      }
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

    // 턴 조정 정보 추가
    if (turnAdjusted && result.success) {
      result.turnAdjusted = true;
      result.message = (result.message || '') + ' (턴 실행 중이어서 다음 턴에 예약됨)';
    }

    // 성공 시 lastActiveAt 업데이트 (플레이어 접속 상태 추적)
    if (result.success && typeof generalId === 'number') {
      try {
        await generalRepository.updateBySessionAndNo(sessionId, generalId, {
          'data.lastActiveAt': new Date().toISOString()
        });
      } catch (error: any) {
        console.error('lastActiveAt update failed:', error);
      }
      
      // 캐시 무효화
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

    // ✅ 예약 시 예상 년/월 계산을 위해 장수 정보와 세션 정보 조회
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
    const { sessionRepository } = await import('../../repositories/session.repository');
    const { ExecuteEngineService } = await import('../global/ExecuteEngine.service');
    
    const session = await sessionRepository.findBySessionId(sessionId);
    const gameEnv = session?.data || {};
    const turnterm = gameEnv.turnterm || 60; // 분 단위
    
    // 장수의 현재 turntime
    const baseTurntime = general?.turntime || general?.data?.turntime || new Date().toISOString();
    const baseTurntimeDate = new Date(baseTurntime);

    for (const turnIdx of turnList) {
      // ✅ 해당 turn_idx의 예상 실행 시간 계산
      const expectedTurntime = new Date(baseTurntimeDate.getTime() + turnIdx * turnterm * 60 * 1000);
      
      // ✅ 예상 년/월 계산 (gameEnv 복사본 사용)
      const envCopy = { ...gameEnv };
      const turnDateInfo = ExecuteEngineService.turnDate(expectedTurntime, envCopy);
      
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
            'data.brief': finalBrief,
            'data.expected_year': turnDateInfo.year,     // ✅ 예상 년도 저장
            'data.expected_month': turnDateInfo.month,   // ✅ 예상 월 저장
            'data.reserved_at': new Date().toISOString() // ✅ 예약 시간 저장
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
