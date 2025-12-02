// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { Session } from '../../../models/session.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveGeneral, saveSession, invalidateCache } from '../../../common/cache/model-cache.helper';

/**
 * 새해 처리 액션
 * PHP NewYear Action과 동일한 구조
 */
export class NewYear extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 세션에서 마지막으로 NewYear가 처리된 년도 확인
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다');
    }

    const sessionData = session.data || {};
    const lastProcessedYear = sessionData.lastNewYear || null;

    // 년도가 실제로 바뀐 경우에만 나이 증가
    const yearChanged = lastProcessedYear === null || lastProcessedYear !== year;

    const logger = new ActionLogger(0, 0, year, month);
    if (yearChanged) {
      logger.pushGlobalActionLog(`<C>${year}</>년이 되었습니다.`);
      
      // 모든 장수에게 전달되는 메시지
      // PHP에서는 pushGeneralHistoryLog를 모든 장수에 대해 호출하지만
      // TypeScript에서는 글로벌 메시지로 처리하거나 각 장수별로 호출 필요
      const allGenerals = await General.find({ session_id: sessionId });
      for (const general of allGenerals) {
        const generalLogger = new ActionLogger(general.data?.no || 0, general.nation || 0, year, month);
        generalLogger.pushGeneralHistoryLog(`<S>모두들 즐거운 게임 하고 계신가요? ^^ <Y>매너 있는 플레이</> 부탁드리고, 게임보단 <L>건강이 먼저</>란점, 잊지 마세요!</>`);
        await generalLogger.flush();
      }
    }
    
    await logger.flush();

    // 년도가 실제로 바뀐 경우에만 나이 증가
    if (yearChanged) {
      const allGeneralsForAge = await General.find({ session_id: sessionId });
      for (const general of allGeneralsForAge) {
        const data = general.data || {};
        const currentAge = data.age;
        const startage = data.startage || 20;
        
        // 나이가 비정상적이면 startage 기준으로 재설정
        if (typeof currentAge !== 'number' || currentAge < 0 || currentAge > 200) {
          // startage + 경과 년수를 계산
          const calculatedYear = Math.max(0, (year - (env['startyear'] || year)) || 0);
          data.age = Math.min(startage + calculatedYear, 200);
          general.data = data;
          // CQRS 패턴: 캐시에 쓰기
          const generalId = general.data?.no || general.no;
          const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
          await saveGeneral(sessionId, generalId, generalData);
        } else {
          // 정상적인 경우만 1 증가 (200 초과하지 않도록 제한)
          const newAge = Math.min(currentAge + 1, 200);
          general.data.age = newAge;
          // CQRS 패턴: 캐시에 쓰기
          const generalId = general.data?.no || general.no;
          const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
          await saveGeneral(sessionId, generalId, generalData);
        }
      }

      // 마지막 처리된 년도 저장
      sessionData.lastNewYear = year;
      session.data = sessionData;
      // CQRS 패턴: 캐시에 쓰기
      const sessionData2 = session.toObject ? session.toObject() : { ...session.data, session_id: sessionId };
      await saveSession(sessionId, sessionData2);
    }

    // 호봉 증가 (국가 소속 장수만) - 년도가 바뀐 경우에만
    if (yearChanged) {
      // bulk 업데이트 후 캐시 무효화 (CQRS 예외: 성능상 이유)
      await General.updateMany(
        {
          session_id: sessionId,
          nation: { $ne: 0 }
        },
        {
          $inc: {
            'data.belong': 1
          }
        }
      );
      // 해당 세션의 장수 캐시 전체 무효화
      await invalidateCache('general', sessionId);
    }

    return [NewYear.name, year];
  }
}

