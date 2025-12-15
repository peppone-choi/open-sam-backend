// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { ActionLogger } from '../../../utils/ActionLogger';
import { JosaUtil } from '../../../utils/JosaUtil';
import { Util } from '../../../utils/Util';
import { logger } from '../../../common/logger';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { GameConst } from '../../../const/GameConst';
import seedrandom from 'seedrandom';

/**
 * 유니크 아이템 분실 이벤트
 * PHP LostUniqueItem Action과 동일한 구조
 * 
 * 매 년도 특정 시점에 실행되며:
 * - 모든 유저 장수(npc <= 1)의 유니크 아이템에 대해
 * - lostProb 확률로 아이템 분실 처리
 */
export class LostUniqueItem extends Action {
  private lostProb: number;

  constructor(lostProb: number = 0.1) {
    super();
    this.lostProb = lostProb;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    try {
      // 유저 장수만 조회 (npc <= 1)
      const generals = await General.find({
        session_id: sessionId,
        $or: [
          { 'data.npc': { $lte: 1 } },
          { npc: { $lte: 1 } }
        ]
      });

      if (generals.length === 0) {
        return { success: true, lostCount: 0 };
      }

      // 시드 기반 랜덤 생성기 (PHP와 동일한 결과를 위해)
      const seed = `LostUniqueItem-${sessionId}-${year}-${month}`;
      const rng = seedrandom(seed);

      const lostItems: Record<string, number> = {};
      let totalLostCnt = 0;
      let maxLostByGenCnt = 0;
      const maxLostGenList: string[] = [];

      for (const general of generals) {
        const generalData = general.data || {};
        const generalNo = general.no || generalData.no;
        const generalName = general.name || generalData.name || '무명';

        // 아이템 타입들
        const itemTypes = ['horse', 'weapon', 'book', 'item'];
        let didLoseItem = false;
        let lostByGenCnt = 0;

        for (const itemType of itemTypes) {
          const itemKey = generalData[itemType] || general[itemType];
          
          // None이거나 구매 가능한 일반 아이템은 스킵
          if (!itemKey || itemKey === 'None' || this.isBuyableItem(itemKey)) {
            continue;
          }

          // 분실 확률 체크
          if (rng() < this.lostProb) {
            const itemName = this.getItemName(itemKey, itemType);
            const josaUl = JosaUtil.pick(itemKey, '을');
            
            lostItems[itemName] = (lostItems[itemName] || 0) + 1;
            totalLostCnt++;
            lostByGenCnt++;

            // 아이템 제거
            generalData[itemType] = 'None';
            didLoseItem = true;

            // 개인 로그
            const genLogger = new ActionLogger(generalNo, generalData.nation || 0, year, month);
            genLogger.pushGeneralActionLog(`<C>${itemName}</>${josaUl} 잃었습니다.`);
            await genLogger.flush();
          }
        }

        if (didLoseItem) {
          general.data = generalData;
          general.markModified('data');
          await general.save();
          
          // CQRS: 캐시에 저장
          await saveGeneral(sessionId, generalNo, general.toObject());

          if (maxLostByGenCnt < lostByGenCnt) {
            maxLostByGenCnt = lostByGenCnt;
            maxLostGenList.length = 0;
            maxLostGenList.push(generalName);
          } else if (maxLostByGenCnt === lostByGenCnt) {
            maxLostGenList.push(generalName);
          }
        }
      }

      // 글로벌 로그
      const globalLogger = new ActionLogger(0, 0, year, month);
      
      if (totalLostCnt === 0) {
        globalLogger.pushGlobalHistoryLog(`<R><b>【망실】</b></>어떤 아이템도 잃지 않았습니다!`);
      } else {
        let displayGenList = [...maxLostGenList];
        const genCnt = displayGenList.length;
        
        if (genCnt > 4) {
          displayGenList = displayGenList.slice(0, 4);
        }
        
        let maxLostGenListStr = displayGenList.join(', ');
        
        if (genCnt > 4) {
          maxLostGenListStr += ` 외 ${genCnt - 4}명`;
        }
        
        const josaYi = JosaUtil.pick(maxLostGenListStr, '이');
        globalLogger.pushGlobalHistoryLog(
          `<R><b>【망실】</b></>불운하게도 <Y>${maxLostGenListStr}</>${josaYi} 한 번에 유니크 <C>${maxLostByGenCnt}</>종을 잃었습니다! (총 <C>${totalLostCnt}</>개)`
        );
      }
      
      await globalLogger.flush();

      logger.info('[LostUniqueItem] Completed', {
        sessionId,
        year,
        month,
        totalLostCnt,
        lostItems
      });

      return { success: true, lostCount: totalLostCnt, lostItems };
    } catch (error: any) {
      logger.error('[LostUniqueItem] Error', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 구매 가능한 일반 아이템인지 확인
   */
  private isBuyableItem(itemKey: string): boolean {
    // 일반 아이템 목록 (GameConst에서 가져오거나 하드코딩)
    const buyableItems = [
      // 말
      '적토', '적려', '절영', '적로', '전차',
      // 무기
      '청룡도', '청강검', '양인검', '철봉',
      // 서적
      '손자병법', '태평요술', '맹덕신서', '육도삼략',
      // 기타 일반 아이템
      'None', ''
    ];
    
    return buyableItems.includes(itemKey);
  }

  /**
   * 아이템 이름 가져오기
   */
  private getItemName(itemKey: string, itemType: string): string {
    // 아이템 키가 곧 이름인 경우가 많음
    // 필요시 아이템 상수에서 조회
    return itemKey;
  }
}







