import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { resolveCommandAuthContext } from './command-auth.helper';

const MAX_TURN = 50;

export class PushCommandService {
  static async execute(data: any, user?: any) {
    const authResult = resolveCommandAuthContext(data, user);
    if (!authResult.ok) {
      return authResult.error;
    }

    const { sessionId, generalId, userId } = authResult.context;
    const amount = parseInt(data.amount);

    // 🔒 보안: 장수 소유권 검증
    const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
    if (!ownershipCheck.valid) {
      return {
        success: false,
        result: false,
        message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.',
        reason: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.'
      };
    }

    if (isNaN(amount) || amount < -12 || amount > 12) {
      return {
        success: false,
        result: false,
        message: '증감 값은 -12 ~ 12 범위여야 합니다.',
        reason: '증감 값은 -12 ~ 12 범위여야 합니다.'
      };
    }

    if (amount === 0) {
      return { success: true, result: true, reason: 'success' };
    }

    if (amount > 0) {
      await pushGeneralCommand(sessionId, generalId, amount);
    } else {
      await pullGeneralCommand(sessionId, generalId, -amount);
    }

    // 캐시 무효화 (턴 데이터 변경으로 장수 정보도 영향받을 수 있음)
    try {
      await invalidateCache('general', sessionId, Number(generalId));
    } catch (error: any) {
      console.error('Cache invalidation failed:', error);
      // 캐시 무효화 실패해도 계속 진행
    }

    return {
      success: true,
      result: true,
      reason: 'success'
    };
  }
}

async function pushGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  const turns = await generalTurnRepository.findByFilter({
    session_id: sessionId,
    'data.general_id': generalId
  });
  
  // 역순 정렬
  turns.sort((a: any, b: any) => b.turn_idx - a.turn_idx);

  for (const turn of turns) {
    const newIdx = turn.turn_idx + turnCnt;
    
    if (newIdx >= MAX_TURN) {
      await generalTurnRepository.updateOne(
        { _id: turn._id },
        {
          $set: {
            'data.turn_idx': newIdx - MAX_TURN,
            'data.action': '휴식',
            'data.arg': {},
            'data.brief': '휴식'
          }
        }
      );
    } else {
      await generalTurnRepository.updateOne(
        { _id: turn._id },
        { $set: { 'data.turn_idx': newIdx } }
      );
    }
  }
}

async function pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  const turns = await generalTurnRepository.findByFilter({
    session_id: sessionId,
    'data.general_id': generalId
  });
  
  // 정순 정렬
  turns.sort((a: any, b: any) => a.turn_idx - b.turn_idx);

  for (const turn of turns) {
    const oldIdx = turn.turn_idx;
    
    if (oldIdx < turnCnt) {
      await generalTurnRepository.updateOne(
        { _id: turn._id },
        {
          $set: {
            'data.turn_idx': oldIdx + MAX_TURN,
            'data.action': '휴식',
            'data.arg': {},
            'data.brief': '휴식'
          }
        }
      );
    } else {
      await generalTurnRepository.updateOne(
        { _id: turn._id },
        { $set: { 'data.turn_idx': oldIdx - turnCnt } }
      );
    }
  }
}
