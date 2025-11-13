import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';

const MAX_TURN = 50;

export class PushCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const amount = parseInt(data.amount);

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다' };
    }

    if (!userId) {
      return { success: false, message: '사용자 인증이 필요합니다' };
    }

    // 🔒 보안: 장수 소유권 검증
    const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
    if (!ownershipCheck.valid) {
      return { success: false, message: ownershipCheck.error };
    }

    if (isNaN(amount) || amount < -12 || amount > 12) {
      return { success: false, message: 'amount는 -12 ~ 12 사이여야 합니다' };
    }

    if (amount === 0) {
      return { success: true, result: true };
    }

    if (amount > 0) {
      await pushGeneralCommand(sessionId, generalId, amount);
    } else {
      await pullGeneralCommand(sessionId, generalId, -amount);
    }

    // 캐시 무효화 (턴 데이터 변경으로 장수 정보도 영향받을 수 있음)
    try {
      const { cacheManager } = await import('../../cache/CacheManager');
      await cacheManager.delete(`general:${sessionId}:${generalId}`);
    } catch (error: any) {
      console.error('Cache invalidation failed:', error);
      // 캐시 무효화 실패해도 계속 진행
    }

    return {
      success: true,
      result: true
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
