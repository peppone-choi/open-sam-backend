/**
 * ResetOfficerLock.ts
 * 직위 락 초기화 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/ResetOfficerLock.php
 * 
 * 천도 제한 및 관직 변경 제한을 해제
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { City } from '../../../models/city.model';

/**
 * 직위 락 초기화 액션
 */
export class ResetOfficerLock extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';

    // 천도 제한 해제, 관직 변경 제한 해제
    const nationResult = await Nation.updateMany(
      { session_id: sessionId },
      { $set: { chief_set: 0 } }
    );

    // 도시 관직 변경 제한 해제
    const cityResult = await City.updateMany(
      { session_id: sessionId },
      { $set: { officer_set: 0 } }
    );

    return [ResetOfficerLock.name, {
      nationModified: nationResult.modifiedCount,
      cityModified: cityResult.modifiedCount
    }];
  }
}








