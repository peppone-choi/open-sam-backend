/**
 * AddGlobalBetray.ts
 * 전역 배신 이벤트 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/AddGlobalBetray.php
 * 
 * 모든 장수의 배신 수치를 증가
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { invalidateCache } from '../../../common/cache/model-cache.helper';

/**
 * 전역 배신 이벤트 액션
 */
export class AddGlobalBetray extends Action {
  private cnt: number;
  private ifMax: number;

  constructor(cnt: number = 1, ifMax: number = 0) {
    super();
    this.cnt = cnt;
    this.ifMax = ifMax;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';

    // 배신 수치가 ifMax 이하인 장수들의 배신 수치를 cnt만큼 증가
    const result = await General.updateMany(
      {
        session_id: sessionId,
        'data.betray': { $lte: this.ifMax }
      },
      {
        $inc: {
          'data.betray': this.cnt
        }
      }
    );

    // 캐시 무효화
    await invalidateCache('general', sessionId);

    return [AddGlobalBetray.name, { modifiedCount: result.modifiedCount }];
  }
}




