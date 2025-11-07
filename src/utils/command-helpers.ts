/**
 * 커맨드 관련 헬퍼 함수들
 * PHP func_command.php 변환
 */

import { GeneralTurn } from '../models/general_turn.model';
import { NationTurn } from '../models/nation_turn.model';
import GameConstants from './game-constants';
import { neutralize, removeSpecialCharacter } from './string-util';

const MAX_TURN = GameConstants.MAX_TURN;
const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

/**
 * 턴 리스트 확장
 * -1: 홀수 턴 (0, 2, 4, ...)
 * -2: 짝수 턴 (1, 3, 5, ...)
 * -3: 모든 턴
 */
export function expandTurnList(rawTurnList: number[], maxTurn: number = MAX_TURN): number[] {
  const turnSet = new Set<number>();

  for (const turnIdx of rawTurnList) {
    if (turnIdx >= 0 && turnIdx < maxTurn) {
      turnSet.add(turnIdx);
    } else if (turnIdx === -1) {
      // 홀수 (0, 2, 4, ...)
      for (let i = 0; i < maxTurn; i += 2) {
        turnSet.add(i);
      }
    } else if (turnIdx === -2) {
      // 짝수 (1, 3, 5, ...)
      for (let i = 1; i < maxTurn; i += 2) {
        turnSet.add(i);
      }
    } else if (turnIdx === -3) {
      // 모두
      for (let i = 0; i < maxTurn; i++) {
        turnSet.add(i);
      }
    }
  }

  return Array.from(turnSet).sort((a, b) => a - b);
}

/**
 * 장수 커맨드 뒤로 밀기
 */
export async function pushGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  const turns = await GeneralTurn.find({
    session_id: sessionId,
    'data.general_id': generalId
  }).sort({ 'data.turn_idx': -1 });

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
    
    turn.markModified('data');
    await turn.save();
  }
}

/**
 * 장수 커맨드 앞으로 당기기
 */
export async function pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  const turns = await GeneralTurn.find({
    session_id: sessionId,
    'data.general_id': generalId
  }).sort({ 'data.turn_idx': 1 });

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
    
    turn.markModified('data');
    await turn.save();
  }
}

/**
 * 장수 커맨드 반복
 */
export async function repeatGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  let reqTurn = turnCnt;
  if (turnCnt * 2 > MAX_TURN) {
    reqTurn = MAX_TURN - turnCnt;
  }

  const turnList = await GeneralTurn.find({
    session_id: sessionId,
    'data.general_id': generalId,
    'data.turn_idx': { $lt: reqTurn }
  });

  for (const turn of turnList) {
    const turnIdx = turn.data.turn_idx;
    const action = turn.data.action;
    const arg = turn.data.arg;
    const brief = turn.data.brief;

    const targetIndices: number[] = [];
    for (let i = turnIdx + turnCnt; i < MAX_TURN; i += turnCnt) {
      targetIndices.push(i);
    }

    await GeneralTurn.updateMany(
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

/**
 * 장수 커맨드 삭제 (특정 턴의 명령을 휴식으로 변경)
 */
export async function deleteGeneralCommand(
  sessionId: string,
  generalId: number,
  turnList: number[]
): Promise<any> {
  try {
    for (const turnIdx of turnList) {
      await GeneralTurn.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': turnIdx
        },
        {
          $set: {
            'data.action': '휴식',
            'data.arg': {},
            'data.brief': '휴식'
          }
        },
        { upsert: true }
      );
    }

    return {
      success: true,
      result: true,
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
 * 장수 커맨드 설정
 */
export async function setGeneralCommand(
  sessionId: string,
  generalId: number,
  turnList: number[],
  action: string,
  arg: any
): Promise<any> {
  try {
    // 간단한 brief 생성 (나중에 command class로 개선)
    const brief = action;

    for (const turnIdx of turnList) {
      await GeneralTurn.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': turnIdx
        },
        {
          $set: {
            session_id: sessionId,
            'data.general_id': generalId,
            'data.turn_idx': turnIdx,
            'data.action': action,
            'data.arg': arg,
            'data.brief': brief
          }
        },
        { upsert: true }
      );
    }

    return {
      success: true,
      result: true,
      brief,
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
 * 국가 커맨드 밀기
 */
export async function pushNationCommand(
  sessionId: string,
  nationId: number,
  officerLevel: number,
  turnCnt: number
) {
  if (nationId === 0 || officerLevel < 5 || turnCnt <= 0 || turnCnt >= MAX_CHIEF_TURN) return;

  const turns = await NationTurn.find({
    session_id: sessionId,
    'data.nation_id': nationId,
    'data.officer_level': officerLevel
  }).sort({ 'data.turn_idx': -1 });

  for (const turn of turns) {
    const newIdx = turn.data.turn_idx + turnCnt;
    
    if (newIdx >= MAX_CHIEF_TURN) {
      turn.data.turn_idx = newIdx - MAX_CHIEF_TURN;
      turn.data.action = '휴식';
      turn.data.arg = {};
      turn.data.brief = '휴식';
    } else {
      turn.data.turn_idx = newIdx;
    }
    
    turn.markModified('data');
    await turn.save();
  }
}

/**
 * 국가 커맨드 당기기
 */
export async function pullNationCommand(
  sessionId: string,
  nationId: number,
  officerLevel: number,
  turnCnt: number
) {
  if (nationId === 0 || officerLevel < 5 || turnCnt <= 0 || turnCnt >= MAX_CHIEF_TURN) return;

  const turns = await NationTurn.find({
    session_id: sessionId,
    'data.nation_id': nationId,
    'data.officer_level': officerLevel
  }).sort({ 'data.turn_idx': 1 });

  for (const turn of turns) {
    const oldIdx = turn.data.turn_idx;
    
    if (oldIdx < turnCnt) {
      turn.data.turn_idx = oldIdx + MAX_CHIEF_TURN;
      turn.data.action = '휴식';
      turn.data.arg = {};
      turn.data.brief = '휴식';
    } else {
      turn.data.turn_idx = oldIdx - turnCnt;
    }
    
    turn.markModified('data');
    await turn.save();
  }
}

/**
 * 인자 정제 (PHP sanitizeArg 함수 변환)
 * 공용 유틸리티로 사용
 */
export function sanitizeArg(arg: any): any {
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
