/**
 * InvaderEnding.ts
 * 이민족 종료 처리 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/InvaderEnding.php
 * 
 * 이민족 이벤트 종료 조건을 확인하고 엔딩 처리
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import mongoose from 'mongoose';

/**
 * 이민족 종료 처리 액션
 */
export class InvaderEnding extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;
    const currentEventId = env['currentEventID'];

    // 게임 환경 저장소 접근
    const gameEnvCollection = mongoose.connection.collection('game_env');
    const gameEnv = await gameEnvCollection.findOne({ session_id: sessionId });

    const isunited = gameEnv?.isunited || 0;

    // 이민족 이벤트가 없으면 종료
    if (isunited === 0 || isunited === 2) {
      return [InvaderEnding.name, 'No Invader'];
    }

    // 국가 수 확인
    const nationCnt = await Nation.countDocuments({
      session_id: sessionId,
      level: { $gt: 0 }
    });

    if (nationCnt >= 2) {
      return [InvaderEnding.name, 'On Event'];
    }

    const logger = new ActionLogger(0, 0, year, month, sessionId);

    // 빈 도시 수 확인
    const emptyCityCnt = await City.countDocuments({
      session_id: sessionId,
      nation: 0
    });

    // 전체 도시 수 확인
    const totalCityCnt = await City.countDocuments({
      session_id: sessionId
    });

    let needStop = false;
    let userWin = false;

    if (emptyCityCnt === 0) {
      // 모든 도시가 점령됨
      needStop = true;

      // 남은 국가가 이민족인지 확인
      const remainingNation = await Nation.findOne({
        session_id: sessionId,
        level: { $gt: 0 }
      });

      if (remainingNation && !remainingNation.name.startsWith('ⓞ')) {
        userWin = true;  // 유저 국가가 승리
      }
    } else if (emptyCityCnt === totalCityCnt) {
      // 모든 도시가 비어있음 (이민족에게 패배)
      needStop = true;
      userWin = false;
    }

    if (!needStop) {
      return [InvaderEnding.name, 'On Event'];
    }

    // 엔딩 처리
    if (userWin) {
      // 천통 엔딩
      logger.pushGlobalHistoryLog('<L><b>【이벤트】</b></>이민족을 모두 소탕했습니다!');
      logger.pushGlobalHistoryLog('<L><b>【이벤트】</b></>중원은 당분간 태평성대를 누릴 것입니다.');
    } else {
      // 이민족 엔딩
      logger.pushGlobalHistoryLog('<L><b>【이벤트】</b></>중원은 이민족에 의해 혼란에 빠졌습니다.');
      logger.pushGlobalHistoryLog('<L><b>【이벤트】</b></>백성은 언젠가 영웅이 나타나길 기다립니다.');
    }

    // 게임 상태 업데이트
    await gameEnvCollection.updateOne(
      { session_id: sessionId },
      { 
        $set: { 
          isunited: 3,
          refreshLimit: (gameEnv?.refreshLimit || 1) * 100
        } 
      }
    );

    await logger.flush();

    // 이벤트 삭제
    if (currentEventId) {
      const eventCollection = mongoose.connection.collection('event');
      await eventCollection.deleteOne({
        session_id: sessionId,
        id: currentEventId
      });
    }

    return [InvaderEnding.name, 'Deleted'];
  }
}




