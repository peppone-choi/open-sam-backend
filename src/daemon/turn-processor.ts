import { General } from '../models/general.model';
import { GeneralTurn } from '../models/general_turn.model';
import { Session } from '../models/session.model';
import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';

/**
 * 턴 처리 데몬
 * 
 * 역할:
 * 1. 매 turnterm마다 전체 게임 턴 진행 (ExecuteEngine 호출)
 * 2. 각 장수의 현재 턴 커맨드 실행
 * 3. 게임 시간 진행 (년/월 증가)
 * 
 * ⭐ 핵심: 전체가 동시에 턴이 진행됨!
 */

export async function processTurn() {
  try {
    // 모든 활성 세션 조회
    const sessions = await Session.find({ status: 'running' });

    for (const session of sessions) {
      const sessionId = session.session_id;
      const turnTerm = (session.data?.turnterm || 10) * 60; // 분 -> 초 변환
      const now = new Date();
      const lastTurnTime = session.data?.turntime ? new Date(session.data.turntime) : new Date(0);

      // 턴 간격 체크
      const elapsed = (now.getTime() - lastTurnTime.getTime()) / 1000;
      if (elapsed < turnTerm) {
        continue; // 아직 턴 시간 아님
      }

      console.log(`📅 [${sessionId}] 턴 ${session.data?.turn || 0} 진행! (${elapsed.toFixed(1)}초 경과, ${session.data?.turnterm || 10}분턴)`);

      // ExecuteEngine 호출 (PHP의 TurnExecutionHelper와 동일)
      const result = await ExecuteEngineService.execute({
        session_id: sessionId
      });

      if (result.success && result.updated) {
        console.log(`✅ [${sessionId}] 턴 완료: ${session.data?.year || 184}년 ${session.data?.month || 1}월`);
      } else if (!result.success) {
        console.error(`❌ [${sessionId}] 턴 실행 실패:`, result.reason);
      }
    }
  } catch (error) {
    console.error('❌ 턴 처리 오류:', error);
  }
}

/**
 * 모든 장수의 턴을 1칸씩 앞으로 당기기
 * 0번이 사라지고, 1->0, 2->1, ... 29->28, 29번은 휴식으로 채워짐
 */
async function pullAllTurns(sessionId: string) {
  try {
    // 0번 턴 삭제
    await GeneralTurn.deleteMany({
      session_id: sessionId,
      'data.turn_idx': 0
    });

    // 모든 턴을 1 감소
    const turns = await GeneralTurn.find({ session_id: sessionId });
    for (const turn of turns) {
      if (turn.data.turn_idx > 0) {
        turn.data.turn_idx -= 1;
        turn.markModified('data');
        await turn.save();
      }
    }

    // 29번 턴이 비어있으면 휴식으로 채우기
    const generals = await General.find({ session_id: sessionId });
    for (const general of generals) {
      const generalId = general.data?.no;
      if (!generalId) continue;

      const turn29 = await GeneralTurn.findOne({
        session_id: sessionId,
        'data.general_id': generalId,
        'data.turn_idx': 29
      });

      if (!turn29) {
        await GeneralTurn.create({
          session_id: sessionId,
          data: {
            general_id: generalId,
            turn_idx: 29,
            action: '휴식',
            arg: {},
            brief: '휴식'
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ 턴 당기기 실패:', error);
  }
}

// 턴 스케줄러 시작
export function startTurnScheduler() {
  const CHECK_INTERVAL = 10000; // 10초마다 체크 (실제로는 턴타임 확인)
  
  setInterval(() => {
    processTurn();
  }, CHECK_INTERVAL);
  
  console.log('⏰ 턴 프로세서 시작 (10초마다 체크)');
  
  // 즉시 한 번 실행
  setTimeout(() => processTurn(), 1000);
}
