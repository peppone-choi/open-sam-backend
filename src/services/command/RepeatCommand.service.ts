import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { resolveCommandAuthContext } from './command-auth.helper';

const MAX_TURN = 50;

export class RepeatCommandService {
  static async execute(data: any, user?: any) {
    const authResult = resolveCommandAuthContext(data, user);
    if (!authResult.ok) {
      return authResult.error;
    }

    const { sessionId, generalId, userId } = authResult.context;
    const amount = parseInt(data.amount);

    const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
    if (!ownershipCheck.valid) {
      return {
        success: false,
        result: false,
        message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.',
        reason: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.'
      };
    }

    if (isNaN(amount) || amount < 1 || amount > 12) {
      return {
        success: false,
        result: false,
        message: '반복 횟수는 1~12 범위여야 합니다.',
        reason: '반복 횟수는 1~12 범위여야 합니다.'
      };
    }

    await repeatGeneralCommand(sessionId, generalId, amount);

    // 캐시 무효화
    try {
      await invalidateCache('general', sessionId, Number(generalId));
    } catch (error: any) {
      console.error('Cache invalidation failed:', error);
    }

    return {
      success: true,
      result: true,
      reason: 'success'
    };
  }
}

async function repeatGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  let reqTurn = turnCnt;
  if (turnCnt * 2 > MAX_TURN) {
    reqTurn = MAX_TURN - turnCnt;
  }

  const turnList = await generalTurnRepository.findByFilter({
    session_id: sessionId,
    'data.general_id': generalId,
    'data.turn_idx': { $lt: reqTurn }
  });
  
  // 정순 정렬
  turnList.sort((a: any, b: any) => a.turn_idx - b.turn_idx);

  for (const turn of turnList) {
    const turnIdx = turn.turn_idx;
    const action = turn.action;
    const arg = turn.arg;
    const brief = turn.brief;

    const targetIndices: number[] = [];
    for (let i = turnIdx + turnCnt; i < MAX_TURN; i += turnCnt) {
      targetIndices.push(i);
    }

    if (targetIndices.length > 0) {
      await generalTurnRepository.updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $in: targetIndices }
        },
        {
          $set: {
            'data.action': action,
            'data.arg': arg,
            'data.brief': brief
          }
        }
      );
    }
  }
}
