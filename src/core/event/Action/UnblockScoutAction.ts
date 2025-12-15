/**
 * UnblockScoutAction.ts
 * 정탐 차단 해제 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/UnblockScoutAction.php
 * 
 * 모든 국가의 정탐 차단을 해제
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import mongoose from 'mongoose';

/**
 * 정탐 차단 해제 액션
 */
export class UnblockScoutAction extends Action {
  private blockChangeScout: boolean | null;

  constructor(blockChangeScout: boolean | null = null) {
    super();
    this.blockChangeScout = blockChangeScout;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';

    // 모든 국가의 정탐 차단 해제 (scout = 0)
    const result = await Nation.updateMany(
      { session_id: sessionId },
      { $set: { scout: 0 } }
    );

    // 정탐 변경 차단 설정
    if (this.blockChangeScout !== null) {
      const gameEnvCollection = mongoose.connection.collection('game_env');
      await gameEnvCollection.updateOne(
        { session_id: sessionId },
        { $set: { block_change_scout: this.blockChangeScout } },
        { upsert: true }
      );
    }

    return [UnblockScoutAction.name, { modifiedCount: result.modifiedCount }];
  }
}






