/**
 * DeleteEvent.ts
 * 이벤트 삭제 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/DeleteEvent.php
 * 
 * 현재 이벤트를 삭제 (1회용 이벤트 처리)
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import mongoose from 'mongoose';

/**
 * 이벤트 삭제 액션
 */
export class DeleteEvent extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const currentEventId = env['currentEventID'];

    if (!currentEventId) {
      throw new Error('currentEventID가 지정되지 않았습니다.');
    }

    const eventCollection = mongoose.connection.collection('event');
    const result = await eventCollection.deleteOne({
      session_id: sessionId,
      id: currentEventId
    });

    return [DeleteEvent.name, result.deletedCount];
  }
}






