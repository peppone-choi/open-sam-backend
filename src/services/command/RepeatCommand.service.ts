import { generalTurnRepository } from '../../repositories/general-turn.repository';

const MAX_TURN = 50;

export class RepeatCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다' };
    }

    if (isNaN(amount) || amount < 1 || amount > 12) {
      return { success: false, message: 'amount는 1 ~ 12 사이여야 합니다' };
    }

    await repeatGeneralCommand(sessionId, generalId, amount);

    // 캐시 무효화
    try {
      const { cacheManager } = await import('../../cache/CacheManager');
      await cacheManager.delete(`general:${sessionId}:${generalId}`);
    } catch (error: any) {
      console.error('Cache invalidation failed:', error);
    }

    return {
      success: true,
      result: true
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
