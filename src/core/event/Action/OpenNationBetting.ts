/**
 * OpenNationBetting.ts
 * 국가 베팅 시작 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/OpenNationBetting.php
 * 
 * 국가 베팅 이벤트를 생성하고, 모든 플레이어에게 알림
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import mongoose from 'mongoose';

// 베팅 정보 인터페이스
interface BettingInfo {
  id: number;
  type: string;
  name: string;
  finished: boolean;
  selectCnt: number;
  isExclusive: boolean | null;
  reqInheritancePoint: boolean;
  openYearMonth: number;
  closeYearMonth: number;
  candidates: SelectItem[];
  winner: number[] | null;
}

interface SelectItem {
  title: string;
  info: string;
  isHtml: boolean;
  aux: any;
}

/**
 * 국가 베팅 시작 액션
 */
export class OpenNationBetting extends Action {
  private nationCnt: number;
  private bonusPoint: number;

  constructor(nationCnt: number = 1, bonusPoint: number = 0) {
    super();
    if (nationCnt < 1) {
      throw new Error('nationCnt must be at least 1');
    }
    if (bonusPoint < 0) {
      throw new Error('bonusPoint must be non-negative');
    }
    this.nationCnt = nationCnt;
    this.bonusPoint = bonusPoint;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 베팅 이름 결정
    const name = this.nationCnt === 1 ? '천통국' : `최후 ${this.nationCnt}국`;

    // 년월 계산
    const openYearMonth = year * 12 + month;
    const closeYearMonth = openYearMonth + 24;  // 2년 후 마감

    // 도시 수 집계
    const cityCounts: Record<number, number> = {};
    const cities = await City.find({ session_id: sessionId, nation: { $gt: 0 } });
    for (const city of cities) {
      const nationId = city.nation;
      cityCounts[nationId] = (cityCounts[nationId] || 0) + 1;
    }

    // 국가 목록 (국력 순 정렬)
    const nations = await Nation.find({ 
      session_id: sessionId, 
      level: { $gt: 0 } 
    }).sort({ power: -1 });

    // 베팅 후보 생성
    const candidates: SelectItem[] = [];
    for (const nation of nations) {
      const nationId = nation.nation;
      const cityCnt = cityCounts[nationId] || 0;
      
      const info = [
        `국력: ${nation.power || 0}`,
        `장수 수: ${nation.gennum || 0}`,
        `도시 수: ${cityCnt}`
      ].join('<br>');

      candidates.push({
        title: nation.name,
        info,
        isHtml: true,
        aux: {
          nation: nationId,
          name: nation.name,
          power: nation.power,
          gennum: nation.gennum,
          city_cnt: cityCnt
        }
      });
    }

    // 베팅 ID 생성 (간단히 타임스탬프 기반)
    const bettingId = Date.now();

    // 베팅 정보 저장
    const bettingInfo: BettingInfo = {
      id: bettingId,
      type: 'bettingNation',
      name: `${name} 예상`,
      finished: false,
      selectCnt: this.nationCnt,
      isExclusive: null,
      reqInheritancePoint: true,
      openYearMonth,
      closeYearMonth,
      candidates,
      winner: null
    };

    // 베팅 컬렉션에 저장
    const bettingCollection = mongoose.connection.collection('betting');
    await bettingCollection.insertOne({
      session_id: sessionId,
      ...bettingInfo
    });

    // 종료 이벤트 등록
    const eventCollection = mongoose.connection.collection('event');
    await eventCollection.insertOne({
      session_id: sessionId,
      target: 'DESTROY_NATION',
      priority: 1000,
      condition: JSON.stringify(['RemainNation', '<=', this.nationCnt]),
      action: JSON.stringify([
        ['FinishNationBetting', bettingId],
        ['DeleteEvent']
      ])
    });

    // 보너스 포인트 추가 (있는 경우)
    if (this.bonusPoint > 0) {
      const bettingRecordCollection = mongoose.connection.collection('ng_betting');
      await bettingRecordCollection.insertOne({
        session_id: sessionId,
        betting_id: bettingId,
        general_id: 0,
        betting_type: '[-1]',
        amount: this.bonusPoint
      });
    }

    // 글로벌 로그
    const logger = new ActionLogger(0, 0, year, month, sessionId);
    if (this.nationCnt > 1) {
      logger.pushGlobalHistoryLog(`<B><b>【내기】</b></>중원의 강자를 점치는 <C>내기</>가 진행중입니다! 호사가의 참여를 기다립니다!`);
    } else {
      logger.pushGlobalHistoryLog(`<B><b>【내기】</b></>천하통일 후보를 점치는 <C>내기</>가 진행중입니다! 호사가의 참여를 기다립니다!`);
    }
    await logger.flush();

    // 모든 플레이어에게 메시지 전송
    const players = await General.find({ 
      session_id: sessionId, 
      'data.npc': { $lte: 1 } 
    });

    const messageText = `새로운 ${name} 내기가 열렸습니다. 천통국 베팅란을 확인해주세요.`;

    for (const player of players) {
      const playerLogger = new ActionLogger(player.no, player.nation || 0, year, month, sessionId);
      playerLogger.pushGeneralActionLog(`<S>【시스템】</> ${messageText}`);
      await playerLogger.flush();
    }

    return [OpenNationBetting.name, true, { bettingId, nationCnt: this.nationCnt }];
  }
}








