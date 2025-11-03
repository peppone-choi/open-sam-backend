import { Session } from '../models/session.model';
import { General } from '../models/general.model';
import { getCommandDuration as getDefaultDuration } from './command-duration';
import { getCommandDuration as getSessionDuration } from './session-config';

/**
 * 커맨드 완료 시각 계산
 * 
 * 턴제: 유저의 다음 턴 시각
 * 리얼타임: 현재 시각 + 대기시간
 */

export async function calculateCompletionTime(
  generalId: number,
  action: string,
  arg?: any
): Promise<Date> {
  const general = await (General as any).findOne({ no: generalId });
  if (!general) throw new Error('장수를 찾을 수 없습니다');
  
  const sessionId = general.session_id;
  const session = await (Session as any).findOne({ session_id: sessionId });
  if (!session) throw new Error('세션을 찾을 수 없습니다');
  
  if (session.game_mode === 'turn') {
    // 턴제: 다음 턴 시각 계산
    return calculateNextTurnTime(general, session);
  } else {
    // 리얼타임: 현재 + 대기시간 (세션별 설정 적용)
    const defaultDuration = getDefaultDuration(action, arg);
    const duration = await getSessionDuration(sessionId, action, defaultDuration);
    const speedMultiplier = session.realtime_config?.speed_multiplier || 1;
    const actualDuration = duration / speedMultiplier;
    
    return new Date(Date.now() + actualDuration * 1000);
  }
}

function calculateNextTurnTime(general: any, session: any): Date {
  const now = new Date();
  
  // 유저가 유산으로 턴 시각을 변경했는지 확인
  const turnHour = general.custom_turn_hour ?? session.turn_config?.default_hour ?? 21;
  const turnMinute = general.custom_turn_minute ?? session.turn_config?.default_minute ?? 0;
  
  // 다음 턴 시각 계산
  const nextTurn = new Date();
  nextTurn.setHours(turnHour, turnMinute, 0, 0);
  
  // 이미 오늘 턴이 지났으면 내일
  if (nextTurn <= now) {
    nextTurn.setDate(nextTurn.getDate() + 1);
  }
  
  return nextTurn;
}
