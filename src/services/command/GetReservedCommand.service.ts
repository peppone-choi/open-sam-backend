import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

const MAX_TURN = 30;
const FLIPPED_MAX_TURN = 14;

export class GetReservedCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    // general_id를 숫자로 변환 (쿼리 파라미터는 문자열로 올 수 있음)
    let generalId = user?.generalId || data.general_id;
    if (generalId) {
      generalId = Number(generalId);
      if (isNaN(generalId) || generalId === 0) {
        generalId = undefined;
      }
    }
    
    console.log('GetReservedCommand.execute:', {
      sessionId,
      generalId,
      generalIdType: typeof generalId,
      userGeneralId: user?.generalId,
      dataGeneralId: data.general_id,
      dataGeneralIdType: typeof data.general_id,
    });
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
      };
    }

    const rawTurns = await generalTurnRepository.findByGeneral(sessionId, generalId);

    const commandList: any = {};
    let invalidTurnList = 0;

    for (const turn of rawTurns) {
      let turnIdx = turn.data.turn_idx;
      const action = turn.data.action;
      const arg = turn.data.arg;
      const brief = turn.data.brief;

      if (turnIdx < 0) {
        invalidTurnList = -1;
        turnIdx += MAX_TURN;
      } else if (turnIdx >= MAX_TURN) {
        invalidTurnList = 1;
        turnIdx -= MAX_TURN;
      }

      commandList[turnIdx] = {
        action,
        brief: brief || action, // brief가 없으면 action 사용
        arg: typeof arg === 'string' ? JSON.parse(arg) : arg
      };
    }

    if (invalidTurnList > 0) {
      await generalTurnRepository.updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $gte: MAX_TURN }
        },
        {
          $inc: { 'data.turn_idx': -MAX_TURN },
          $set: { 
            'data.action': '휴식',
            'data.arg': {},
            'data.brief': '휴식'
          }
        }
      );
    } else if (invalidTurnList < 0) {
      await generalTurnRepository.updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $lt: 0 }
        },
        {
          $inc: { 'data.turn_idx': MAX_TURN }
        }
      );
    }

    // General 모델에서 장수 찾기
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

    console.log('General 조회 결과:', {
      generalId,
      found: !!general,
      generalNo: general?.no,
    });

    if (!general) {
      return {
        success: false,
        message: '장수를 찾을 수 없습니다'
      };
    }

    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      return {
        success: false,
        message: '세션을 찾을 수 없습니다'
      };
    }

    // session.data 또는 session.data.game_env에서 값 가져오기
    const sessionData = session.data || {};
    const gameEnv = sessionData.game_env || {};
    
    const turnTermInMinutes = gameEnv.turnterm || sessionData.turnterm || 60; // 분 단위
    const turnTerm = turnTermInMinutes * 60; // 초 단위로 변환
    let year = gameEnv.year || sessionData.year || 180;
    let month = gameEnv.month || sessionData.month || 1;
    const lastExecute = gameEnv.turntime || sessionData.turntime || new Date();
    
    // general.turntime이 있으면 사용, 없으면 현재 시간 기준으로 계산만 (DB 저장 안 함)
    let turnTime = general.turntime;
    if (!turnTime) {
      // turntime이 없으면 현재 시간 기준으로 다음 턴 시간 계산 (표시용만)
      const turnTermInSeconds = turnTermInMinutes * 60;
      
      const cutTurnFunc = (time: Date, term: number): Date => {
        const timeInSeconds = Math.floor(time.getTime() / 1000);
        const cutSeconds = Math.floor(timeInSeconds / term) * term;
        return new Date(cutSeconds * 1000);
      };
      
      const addTurnFunc = (time: Date, term: number): Date => {
        return new Date(time.getTime() + term * 1000);
      };
      
      const now = new Date();
      const cutNow = cutTurnFunc(now, turnTermInSeconds);
      const nextTurnTime = addTurnFunc(cutNow, turnTermInSeconds);
      
      turnTime = nextTurnTime.getTime() <= now.getTime() 
        ? addTurnFunc(nextTurnTime, turnTermInSeconds)
        : nextTurnTime;
      
      // DB에는 저장하지 않음 (조회 API이므로 읽기 전용)
      // 실제 turntime은 ExecuteEngine에서만 업데이트
    } else if (typeof turnTime === 'string') {
      turnTime = new Date(turnTime);
    } else if (!(turnTime instanceof Date)) {
      turnTime = new Date(turnTime);
    }
    
    // turnTime은 그대로 사용 (과거 시간이어도 수정하지 않음)
    // 실제 턴 시간 업데이트는 ExecuteEngine.updateTurnTime에서만 수행

    // turnTime을 기준으로 정확한 년월 계산 (ExecuteEngine.turnDate와 동일한 로직)
    // starttime 기준으로 경과한 턴 수를 계산하여 년월 결정
    const starttime = new Date(sessionData.starttime || sessionData.turntime || new Date());
    const startyear = sessionData.startyear || 180;
    
    // turnTime을 turnterm 단위로 자르기
    const cutTurnFunc = (time: Date, termInMinutes: number): Date => {
      const baseDate = new Date(time);
      baseDate.setDate(baseDate.getDate() - 1);
      baseDate.setHours(1, 0, 0, 0);
      
      const diffMinutes = Math.floor((time.getTime() - baseDate.getTime()) / (1000 * 60));
      const cutMinutes = Math.floor(diffMinutes / termInMinutes) * termInMinutes;
      
      return new Date(baseDate.getTime() + cutMinutes * 60 * 1000);
    };
    
    const curturn = cutTurnFunc(turnTime, turnTermInMinutes);
    const starttimeCut = cutTurnFunc(starttime, turnTermInMinutes);
    
    // 경과한 턴 수 계산
    const timeDiffMinutes = (curturn.getTime() - starttimeCut.getTime()) / (1000 * 60);
    const numTurns = Math.max(0, Math.floor(timeDiffMinutes / turnTermInMinutes));
    
    // 년월 계산
    const date = startyear * 12 + numTurns;
    year = Math.floor(date / 12);
    month = (date % 12) + 1;

    // 초기 상태(명령이 하나도 없을 때)를 14턴까지 휴식으로 자동 채우기
    // 명령이 있을 때는 그걸 대체
    const turnArray: any[] = [];
    const emptyTurns: number[] = [];
    
    for (let i = 0; i < MAX_TURN; i++) {
      if (commandList[i]) {
        // 명령이 있으면 그걸 사용
        turnArray.push(commandList[i]);
      } else {
        // 빈 턴 발견
        if (i < FLIPPED_MAX_TURN) {
          // 14턴까지만 자동으로 휴식 명령 저장
          emptyTurns.push(i);
        }
        turnArray.push({
          action: '휴식',
          brief: '휴식',
          arg: {}
        });
      }
    }
    
    // 초기 상태(명령이 하나도 없을 때) 또는 빈 턴이 있으면 DB에 자동으로 휴식 명령 저장 (14턴까지만)
    if (emptyTurns.length > 0) {
      // 명령이 하나도 없으면 초기 상태로 14턴까지 모두 휴식으로 저장
      // 명령이 일부만 있으면 빈 턴만 휴식으로 저장
      const bulkOps = emptyTurns.map(turnIdx => ({
        updateOne: {
          filter: {
            session_id: sessionId,
            'data.general_id': generalId,
            'data.turn_idx': turnIdx
          },
          update: {
            $set: {
              session_id: sessionId,
              'data.general_id': generalId,
              'data.turn_idx': turnIdx,
              'data.action': '휴식',
              'data.brief': '휴식',
              'data.arg': {}
            }
          },
          upsert: true
        }
      }));
      
      if (bulkOps.length > 0) {
        await generalTurnRepository.bulkWrite(bulkOps);
      }
    }

    // 세션의 현재 년/월도 함께 반환 (타임라인 표시용)
    const sessionTurntime = new Date(sessionData.turntime || new Date());
    const sessionCurturn = cutTurnFunc(sessionTurntime, turnTermInMinutes);
    const sessionTimeDiffMinutes = (sessionCurturn.getTime() - starttimeCut.getTime()) / (1000 * 60);
    const sessionNumTurns = Math.max(0, Math.floor(sessionTimeDiffMinutes / turnTermInMinutes));
    const sessionDate = startyear * 12 + sessionNumTurns;
    const sessionYear = Math.floor(sessionDate / 12);
    const sessionMonth = (sessionDate % 12) + 1;
    
    return {
      success: true,
      result: true,
      turnTime: turnTime instanceof Date ? turnTime.toISOString() : new Date(turnTime).toISOString(),
      turnTerm: turnTermInMinutes, // PHP 버전과 동일하게 분 단위로 반환
      year, // 장수의 다음 turntime 기준 년월
      month,
      sessionYear, // 세션의 현재 년월
      sessionMonth,
      date: new Date().toISOString(),
      turn: turnArray, // 배열로 변경
      autorun_limit: general.aux?.autorun_limit || null
    };
  }

}
