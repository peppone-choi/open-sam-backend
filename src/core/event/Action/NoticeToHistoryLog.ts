/**
 * NoticeToHistoryLog.ts
 * 공지 → 역사 기록 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/NoticeToHistoryLog.php
 * 
 * 지정된 메시지를 역사 기록으로 추가
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { ActionLogger } from '../../../types/ActionLogger';

// 로그 타입 상수
const LOG_TYPES = {
  YEAR_MONTH: 1,
  PLAIN: 0
};

/**
 * 공지 → 역사 기록 액션
 */
export class NoticeToHistoryLog extends Action {
  private msg: string;
  private type: number;

  constructor(msg: string, type: number = LOG_TYPES.YEAR_MONTH) {
    super();
    this.msg = msg;
    this.type = type;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'];
    const month = env['month'];

    if (year === undefined || month === undefined) {
      throw new Error('year, month가 없음');
    }

    const logger = new ActionLogger(0, 0, year, month, sessionId);
    logger.pushGlobalHistoryLog(this.msg);
    await logger.flush();

    return [NoticeToHistoryLog.name, { msg: this.msg }];
  }
}








