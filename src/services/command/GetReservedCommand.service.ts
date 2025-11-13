import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

const MAX_TURN = 50;
const FLIPPED_MAX_TURN = 30;

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
      // data 객체에서 필드 추출
      const turnData = turn.data || turn;
      let turnIdx = turnData.turn_idx;
      const action = turnData.action;
      const arg = turnData.arg;
      const brief = turnData.brief;

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
    let year = gameEnv.year || sessionData.year || session.year || 184;
    let month = gameEnv.month || sessionData.month || 1;
    const lastExecute = gameEnv.turntime || sessionData.turntime || new Date();
    
    // general.turntime이 있으면 사용, 없으면 현재 시간 기준으로 계산만 (DB 저장 안 함)
    let turnTime = general.turntime;
    const turnTermInSeconds = turnTermInMinutes * 60;
    
    const cutTurnFunc = (time: Date, term: number): Date => {
      const timeInSeconds = Math.floor(time.getTime() / 1000);
      const cutSeconds = Math.floor(timeInSeconds / term) * term;
      return new Date(cutSeconds * 1000);
    };
    
    const addTurnFunc = (time: Date, term: number): Date => {
      return new Date(time.getTime() + term * 1000);
    };
    
    if (!turnTime) {
      // turntime이 없으면 현재 시간 기준으로 다음 턴 시간 계산 (표시용만)
      const now = new Date();
      const cutNow = cutTurnFunc(now, turnTermInSeconds);
      const nextTurnTime = addTurnFunc(cutNow, turnTermInSeconds);
      
      turnTime = nextTurnTime.getTime() <= now.getTime() 
        ? addTurnFunc(nextTurnTime, turnTermInSeconds)
        : nextTurnTime;
      
      // DB에는 저장하지 않음 (조회 API이므로 읽기 전용)
      // 실제 turntime은 ExecuteEngine에서만 업데이트
    } else {
      // turnTime을 Date 객체로 변환
      if (typeof turnTime === 'string') {
        turnTime = new Date(turnTime);
      } else if (!(turnTime instanceof Date)) {
        turnTime = new Date(turnTime);
      }
      
      // turnTime이 과거라면, 현재 시간 기준으로 다음 턴 시간 계산
      const now = new Date();
      if (turnTime.getTime() < now.getTime()) {
        const cutNow = cutTurnFunc(now, turnTermInSeconds);
        const nextTurnTime = addTurnFunc(cutNow, turnTermInSeconds);
        
        turnTime = nextTurnTime.getTime() <= now.getTime() 
          ? addTurnFunc(nextTurnTime, turnTermInSeconds)
          : nextTurnTime;
      }
    }

    // turnTime을 기준으로 정확한 년월 계산 (ExecuteEngine.turnDate와 동일한 로직)
    // starttime 기준으로 경과한 턴 수를 계산하여 년월 결정
    const starttime = new Date(sessionData.starttime || sessionData.turntime || new Date());
    const startyear = gameEnv.startyear || gameEnv.startYear || sessionData.startyear || session.startyear || 184;
    
    // ⚠️ CRITICAL FIX: starttime 유효성 검증
    const now = new Date();
    const MAX_YEAR_DIFF = 10; // 최대 10년
    const maxDiffMs = MAX_YEAR_DIFF * 365 * 24 * 60 * 60 * 1000;
    
    if (Math.abs(now.getTime() - starttime.getTime()) > maxDiffMs) {
      console.error(`[GetReservedCommand] ⚠️ Invalid starttime detected: ${starttime.toISOString()}, resetting to current time`);
      // starttime이 손상되었으면 현재 시간으로 리셋
      sessionData.starttime = now.toISOString();
      sessionData.year = startyear;
      sessionData.month = 1;
      
      // 안전한 기본값 반환
      year = startyear;
      month = 1;
    } else {
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
      
      // ⚠️ CRITICAL FIX: 비정상적으로 큰 numTurns 체크
      const MAX_REASONABLE_TURNS = MAX_YEAR_DIFF * 365 * 24 * 60 / turnTermInMinutes;
      if (numTurns > MAX_REASONABLE_TURNS) {
        console.error(`[GetReservedCommand] ⚠️ Calculated ${numTurns} turns (> ${MAX_REASONABLE_TURNS}), using safe defaults`);
        year = startyear;
        month = 1;
      } else {
        // 년월 계산 (오버플로우 안전)
        try {
          const { Util } = require('../../utils/Util');
          const date = Util.joinYearMonth(startyear, 1) + numTurns;
          year = Math.floor(date / 12);
          month = (date % 12) + 1;
          
          // 추가 안전성 체크
          if (year > 10000 || year < 0) {
            throw new Error(`Year ${year} out of range`);
          }
        } catch (error: any) {
          console.error(`[GetReservedCommand] ⚠️ Year calculation error:`, error.message);
          year = startyear;
          month = 1;
        }
      }
    }

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
    
    // ⚠️ 빈 턴 자동 생성 로직 - 조회용으로만 사용, DB에 저장하지 않음
    // 프론트엔드에서는 turnArray를 받아서 화면에 표시하므로 DB 저장 불필요
    // 실제 턴 실행 시 ExecuteEngine에서 턴이 없으면 자동으로 "휴식"으로 실행함

    // 세션의 현재 년/월도 함께 반환 (타임라인 표시용)
    let sessionYear = startyear;
    let sessionMonth = 1;
    
    try {
      const cutTurnFunc = (time: Date, termInMinutes: number): Date => {
        const baseDate = new Date(time);
        baseDate.setDate(baseDate.getDate() - 1);
        baseDate.setHours(1, 0, 0, 0);
        
        const diffMinutes = Math.floor((time.getTime() - baseDate.getTime()) / (1000 * 60));
        const cutMinutes = Math.floor(diffMinutes / termInMinutes) * termInMinutes;
        
        return new Date(baseDate.getTime() + cutMinutes * 60 * 1000);
      };
      
      const sessionTurntime = new Date(sessionData.turntime || new Date());
      const starttimeCut = cutTurnFunc(starttime, turnTermInMinutes);
      const sessionCurturn = cutTurnFunc(sessionTurntime, turnTermInMinutes);
      const sessionTimeDiffMinutes = (sessionCurturn.getTime() - starttimeCut.getTime()) / (1000 * 60);
      const sessionNumTurns = Math.max(0, Math.floor(sessionTimeDiffMinutes / turnTermInMinutes));
      
      // ⚠️ CRITICAL FIX: 비정상적으로 큰 sessionNumTurns 체크
      const MAX_REASONABLE_TURNS = MAX_YEAR_DIFF * 365 * 24 * 60 / turnTermInMinutes;
      if (sessionNumTurns > MAX_REASONABLE_TURNS) {
        console.error(`[GetReservedCommand] ⚠️ Session calculated ${sessionNumTurns} turns (> ${MAX_REASONABLE_TURNS}), using safe defaults`);
      } else {
        const { Util } = require('../../utils/Util');
        const sessionDate = Util.joinYearMonth(startyear, 1) + sessionNumTurns;
        sessionYear = Math.floor(sessionDate / 12);
        sessionMonth = (sessionDate % 12) + 1;
        
        if (sessionYear > 10000 || sessionYear < 0) {
          throw new Error(`Session year ${sessionYear} out of range`);
        }
      }
    } catch (error: any) {
      console.error(`[GetReservedCommand] ⚠️ Session year calculation error:`, error.message);
      sessionYear = startyear;
      sessionMonth = 1;
    }
    
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
