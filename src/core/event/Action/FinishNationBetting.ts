/**
 * FinishNationBetting.ts
 * 국가 베팅 종료 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/FinishNationBetting.php
 * 
 * 베팅 결과를 확정하고 보상을 지급
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { ActionLogger } from '../../../types/ActionLogger';
import mongoose from 'mongoose';

/**
 * 국가 베팅 종료 액션
 */
export class FinishNationBetting extends Action {
  private bettingId: number;

  constructor(bettingId: number) {
    super();
    this.bettingId = bettingId;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    const bettingCollection = mongoose.connection.collection('betting');
    const bettingRecordCollection = mongoose.connection.collection('ng_betting');

    // 베팅 정보 조회
    const bettingInfo = await bettingCollection.findOne({
      session_id: sessionId,
      id: this.bettingId
    });

    if (!bettingInfo) {
      return [FinishNationBetting.name, false, 'betting not found'];
    }

    if (bettingInfo.type !== 'bettingNation') {
      return [FinishNationBetting.name, false, 'invalid type', bettingInfo.type];
    }

    // 승리 국가 조회 (현재 생존 국가)
    const winnerNations = await Nation.find({
      session_id: sessionId,
      level: { $gt: 0 }
    }).select('nation');

    const winnerNationIds = winnerNations.map(n => n.nation);

    if (winnerNationIds.length !== bettingInfo.selectCnt) {
      return [FinishNationBetting.name, false, 'invalid winner count', {
        expected: bettingInfo.selectCnt,
        actual: winnerNationIds.length
      }];
    }

    // nation_id → betting_type 매핑
    const nationIdMap: Record<number, number> = {};
    const candidates = bettingInfo.candidates || [];
    for (let idx = 0; idx < candidates.length; idx++) {
      const aux = candidates[idx].aux;
      if (aux && aux.nation) {
        nationIdMap[aux.nation] = idx;
      }
    }

    // 승리 타입 결정
    const winnerTypes: number[] = [];
    let notInBettingWinner = 0;

    for (const winnerNationId of winnerNationIds) {
      if (nationIdMap[winnerNationId] !== undefined) {
        winnerTypes.push(nationIdMap[winnerNationId]);
      } else {
        // 베팅 시점 이후에 생성된 국가
        winnerTypes.push(candidates.length + notInBettingWinner);
        notInBettingWinner++;
      }
    }

    // 정렬하여 키 생성
    winnerTypes.sort((a, b) => a - b);
    const winnerKey = JSON.stringify(winnerTypes);

    // 베팅 참여자 조회 및 보상 지급
    const bettingRecords = await bettingRecordCollection.find({
      session_id: sessionId,
      betting_id: this.bettingId,
      general_id: { $gt: 0 }
    }).toArray();

    // 총 베팅액 계산
    let totalPool = 0;
    let bonusPool = 0;

    // 보너스 풀 (general_id = 0)
    const bonusRecord = await bettingRecordCollection.findOne({
      session_id: sessionId,
      betting_id: this.bettingId,
      general_id: 0
    });
    if (bonusRecord) {
      bonusPool = bonusRecord.amount || 0;
    }

    const winnerRecords: any[] = [];
    for (const record of bettingRecords) {
      totalPool += record.amount || 0;
      
      if (record.betting_type === winnerKey) {
        winnerRecords.push(record);
      }
    }

    // 승자 보상 계산 및 지급
    const totalPrize = totalPool + bonusPool;
    const winnerTotalBet = winnerRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    if (winnerRecords.length > 0 && winnerTotalBet > 0) {
      for (const record of winnerRecords) {
        const ratio = record.amount / winnerTotalBet;
        const prize = Math.floor(totalPrize * ratio);
        
        // 계승 포인트 지급 (실제로는 별도 시스템 필요)
        await bettingRecordCollection.updateOne(
          { _id: record._id },
          { $set: { prize, isWinner: true } }
        );
      }
    }

    // 베팅 종료 처리
    await bettingCollection.updateOne(
      { session_id: sessionId, id: this.bettingId },
      { $set: { finished: true, winner: winnerTypes } }
    );

    // 글로벌 로그
    const [openYear, openMonth] = this.parseYearMonth(bettingInfo.openYearMonth);
    const logger = new ActionLogger(0, 0, year, month, sessionId);
    logger.pushGlobalHistoryLog(
      `<B><b>【내기】</b></> ${openYear}년 ${openMonth}월에 열렸던 ${bettingInfo.name} 내기의 결과가 나왔습니다!`
    );
    await logger.flush();

    return [FinishNationBetting.name, true, {
      bettingId: this.bettingId,
      winnerTypes,
      totalPool,
      winnerCount: winnerRecords.length
    }];
  }

  /**
   * 년월 파싱
   */
  private parseYearMonth(yearMonth: number): [number, number] {
    const year = Math.floor(yearMonth / 12);
    const month = yearMonth % 12 || 12;
    return [year, month];
  }
}







