import { generalTurnRepository } from '../../repositories/general-turn.repository';

const MAX_TURN = 30;

export class PushCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다' };
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
  turns.sort((a: any, b: any) => b.data.turn_idx - a.data.turn_idx);

  for (const turn of turns) {
    const newIdx = turn.data.turn_idx + turnCnt;
    
    if (newIdx >= MAX_TURN) {
      turn.data.turn_idx = newIdx - MAX_TURN;
      turn.data.action = '휴식';
      turn.data.arg = {};
      turn.data.brief = '휴식';
    } else {
      turn.data.turn_idx = newIdx;
    }
    
    await turn.save();
  }
}

async function pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  const turns = await generalTurnRepository.findByFilter({
    session_id: sessionId,
    'data.general_id': generalId
  });
  
  // 정순 정렬
  turns.sort((a: any, b: any) => a.data.turn_idx - b.data.turn_idx);

  for (const turn of turns) {
    const oldIdx = turn.data.turn_idx;
    
    if (oldIdx < turnCnt) {
      turn.data.turn_idx = oldIdx + MAX_TURN;
      turn.data.action = '휴식';
      turn.data.arg = {};
      turn.data.brief = '휴식';
    } else {
      turn.data.turn_idx = oldIdx - turnCnt;
    }
    
    await turn.save();
  }
}
