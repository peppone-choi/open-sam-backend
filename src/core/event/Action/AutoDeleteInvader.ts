/**
 * AutoDeleteInvader.ts
 * 이민족 자동 삭제 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/AutoDeleteInvader.php
 * 
 * 전쟁 중이 아닌 이민족을 방랑시키고 이벤트 삭제
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import mongoose from 'mongoose';

/**
 * 이민족 자동 삭제 액션
 */
export class AutoDeleteInvader extends Action {
  private nationId: number;

  constructor(nationId: number) {
    super();
    this.nationId = nationId;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const currentEventId = env['currentEventID'];

    // 해당 국가가 존재하는지 확인
    const nation = await Nation.findOne({
      session_id: sessionId,
      nation: this.nationId,
      level: { $gt: 0 }
    });

    if (!nation) {
      // 국가가 없으면 이벤트 삭제
      if (currentEventId) {
        const eventCollection = mongoose.connection.collection('event');
        await eventCollection.deleteOne({
          session_id: sessionId,
          id: currentEventId
        });
      }
      return [AutoDeleteInvader.name, 'Not Exists'];
    }

    // 외교 상태 확인 (전쟁 중인지)
    const diplomacyCollection = mongoose.connection.collection('diplomacy');
    const onWar = await diplomacyCollection.countDocuments({
      session_id: sessionId,
      me: this.nationId,
      state: { $in: [0, 1] }  // 0: 적대, 1: 전쟁
    });

    if (onWar > 0) {
      return [AutoDeleteInvader.name, 'On War'];
    }

    // 이민족 군주 찾기
    const ruler = await General.findOne({
      session_id: sessionId,
      nation: this.nationId,
      'data.officer_level': 12
    });

    if (ruler) {
      // 군주에게 방랑 명령 설정
      const turnCollection = mongoose.connection.collection('general_turn');
      await turnCollection.updateOne(
        {
          session_id: sessionId,
          general_id: ruler.no
        },
        {
          $set: {
            action: 'che_방랑',
            arg: '[]',
            brief: '이민족 방랑'
          }
        }
      );
    }

    // 이벤트 삭제
    if (currentEventId) {
      const eventCollection = mongoose.connection.collection('event');
      await eventCollection.deleteOne({
        session_id: sessionId,
        id: currentEventId
      });
    }

    return [AutoDeleteInvader.name, 'Deleted'];
  }
}








