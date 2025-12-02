// @ts-nocheck - Type issues with Mongoose models need investigation
/**
 * BettingSystemService
 * 
 * 베팅 시스템 통합 서비스
 * - 베팅 유형 (승리 국가, 통일 시기, 특정 이벤트)
 * - 베팅 보상 (상속 포인트, 특수 칭호, 다음 회차 보너스)
 * - 베팅 마감/정산
 */

import { KVStorage } from '../../utils/KVStorage';
import { NgBetting } from '../../models/ng_betting.model';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { UserRecord } from '../../models/user_record.model';
import { logger } from '../../common/logger';
import { Betting } from '../../core/betting/Betting';
import { Util } from '../../utils/Util';

// 베팅 유형
export enum BettingType {
  WINNER_NATION = 'winner_nation',       // 승리 국가 예측
  UNIFICATION_TIME = 'unification_time', // 통일 시기 예측
  EVENT = 'event',                       // 특정 이벤트 예측
  CUSTOM = 'custom',                     // 커스텀 베팅
}

// 베팅 상태
export enum BettingStatus {
  PENDING = 'pending',       // 대기 중
  OPEN = 'open',            // 진행 중
  CLOSED = 'closed',        // 마감됨
  SETTLED = 'settled',      // 정산 완료
  CANCELLED = 'cancelled',  // 취소됨
}

// 베팅 정보 인터페이스
export interface BettingInfo {
  id: number;
  name: string;
  type: BettingType;
  description: string;
  candidates: Record<number, string>;
  selectCnt: number;
  openYearMonth: number;
  closeYearMonth: number;
  reqInheritancePoint: boolean;
  isExclusive: boolean;
  finished: boolean;
  winner?: number[];
  createdAt: string;
}

// 베팅 결과
export interface BettingResult {
  generalId: number;
  userId: number | null;
  amount: number;
  matchPoint: number;
  reward: number;
}

// 베팅 보상 유형
export interface BettingReward {
  inheritancePoints?: number;
  specialTitle?: string;
  nextSeasonBonus?: number;
}

export class BettingSystemService {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 게임 환경 스토리지 가져오기
   */
  private async getGameEnvStor() {
    return KVStorage.getStorage(`game_env:${this.sessionId}`);
  }

  /**
   * 베팅 스토리지 가져오기
   */
  private async getBettingStor() {
    return KVStorage.getStorage(`betting:${this.sessionId}`);
  }

  /**
   * 현재 연월 가져오기
   */
  private async getCurrentYearMonth(): Promise<number> {
    const gameStor = await this.getGameEnvStor();
    const year = await gameStor.getValue('year') || 184;
    const month = await gameStor.getValue('month') || 1;
    return Util.joinYearMonth(year, month);
  }

  /**
   * 새 베팅 ID 생성
   */
  async generateBettingId(): Promise<number> {
    return Betting.genNextBettingID(this.sessionId);
  }

  /**
   * 승리 국가 베팅 생성
   */
  async createWinnerNationBetting(options: {
    name?: string;
    openYearMonth: number;
    closeYearMonth: number;
    reqInheritancePoint?: boolean;
  }): Promise<BettingInfo> {
    const bettingId = await this.generateBettingId();
    
    // 현재 국가 목록 가져오기
    const session = await Session.findOne({ session_id: this.sessionId }).lean();
    const sessionData = session?.data as any || {};
    const nations = sessionData.nations || [];
    
    const candidates: Record<number, string> = {};
    for (const nation of nations) {
      if (nation.level > 0) { // 멸망하지 않은 국가만
        candidates[nation.nation] = nation.name;
      }
    }
    
    const bettingInfo: BettingInfo = {
      id: bettingId,
      name: options.name || '승리 국가 예측',
      type: BettingType.WINNER_NATION,
      description: '최종 승리할 국가를 예측하세요.',
      candidates,
      selectCnt: 1,
      openYearMonth: options.openYearMonth,
      closeYearMonth: options.closeYearMonth,
      reqInheritancePoint: options.reqInheritancePoint || false,
      isExclusive: true,
      finished: false,
      createdAt: new Date().toISOString()
    };
    
    await Betting.openBetting(this.sessionId, bettingInfo);
    
    logger.info('[BettingSystemService] Winner nation betting created', {
      sessionId: this.sessionId,
      bettingId,
      candidates: Object.keys(candidates).length
    });
    
    return bettingInfo;
  }

  /**
   * 통일 시기 베팅 생성
   */
  async createUnificationTimeBetting(options: {
    name?: string;
    openYearMonth: number;
    closeYearMonth: number;
    timeOptions: { year: number; quarter: number }[];
    reqInheritancePoint?: boolean;
  }): Promise<BettingInfo> {
    const bettingId = await this.generateBettingId();
    
    const candidates: Record<number, string> = {};
    options.timeOptions.forEach((option, index) => {
      const quarterName = ['1분기', '2분기', '3분기', '4분기'][option.quarter - 1];
      candidates[index] = `${option.year}년 ${quarterName}`;
    });
    
    const bettingInfo: BettingInfo = {
      id: bettingId,
      name: options.name || '통일 시기 예측',
      type: BettingType.UNIFICATION_TIME,
      description: '천하 통일 시기를 예측하세요.',
      candidates,
      selectCnt: 1,
      openYearMonth: options.openYearMonth,
      closeYearMonth: options.closeYearMonth,
      reqInheritancePoint: options.reqInheritancePoint || false,
      isExclusive: true,
      finished: false,
      createdAt: new Date().toISOString()
    };
    
    await Betting.openBetting(this.sessionId, bettingInfo);
    
    logger.info('[BettingSystemService] Unification time betting created', {
      sessionId: this.sessionId,
      bettingId,
      timeOptions: options.timeOptions
    });
    
    return bettingInfo;
  }

  /**
   * 이벤트 베팅 생성
   */
  async createEventBetting(options: {
    name: string;
    description: string;
    candidates: Record<number, string>;
    selectCnt: number;
    openYearMonth: number;
    closeYearMonth: number;
    reqInheritancePoint?: boolean;
    isExclusive?: boolean;
  }): Promise<BettingInfo> {
    const bettingId = await this.generateBettingId();
    
    const bettingInfo: BettingInfo = {
      id: bettingId,
      name: options.name,
      type: BettingType.EVENT,
      description: options.description,
      candidates: options.candidates,
      selectCnt: options.selectCnt,
      openYearMonth: options.openYearMonth,
      closeYearMonth: options.closeYearMonth,
      reqInheritancePoint: options.reqInheritancePoint || false,
      isExclusive: options.isExclusive ?? true,
      finished: false,
      createdAt: new Date().toISOString()
    };
    
    await Betting.openBetting(this.sessionId, bettingInfo);
    
    logger.info('[BettingSystemService] Event betting created', {
      sessionId: this.sessionId,
      bettingId,
      name: options.name
    });
    
    return bettingInfo;
  }

  /**
   * 베팅 목록 조회
   */
  async getBettingList(type?: BettingType): Promise<BettingInfo[]> {
    const session = await Session.findOne({ session_id: this.sessionId }).lean();
    const sessionData = session?.data as any || {};
    const bettingStor = sessionData.betting || {};
    
    const bettingList: BettingInfo[] = [];
    
    for (const key of Object.keys(bettingStor)) {
      const bettingInfo = bettingStor[key] as BettingInfo;
      if (type && bettingInfo.type !== type) {
        continue;
      }
      bettingList.push(bettingInfo);
    }
    
    return bettingList.sort((a, b) => b.id - a.id);
  }

  /**
   * 진행 중인 베팅 목록 조회
   */
  async getActiveBettingList(): Promise<BettingInfo[]> {
    const currentYearMonth = await this.getCurrentYearMonth();
    const allBettings = await this.getBettingList();
    
    return allBettings.filter(betting => 
      !betting.finished &&
      betting.openYearMonth <= currentYearMonth &&
      betting.closeYearMonth > currentYearMonth
    );
  }

  /**
   * 베팅 상세 조회
   */
  async getBettingDetail(bettingId: number): Promise<{
    info: BettingInfo | null;
    totalAmount: number;
    participantCount: number;
    bettingByCandidate: Record<string, number>;
  }> {
    const bettingStor = await this.getBettingStor();
    const info = await bettingStor.getValue(`id_${bettingId}`) as BettingInfo | null;
    
    if (!info) {
      return {
        info: null,
        totalAmount: 0,
        participantCount: 0,
        bettingByCandidate: {}
      };
    }
    
    // 베팅 집계
    const aggregateResult = await NgBetting.aggregate([
      {
        $match: {
          session_id: this.sessionId,
          'data.betting_id': bettingId
        }
      },
      {
        $group: {
          _id: '$data.betting_type',
          totalAmount: { $sum: '$data.amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    let totalAmount = 0;
    let participantCount = 0;
    const bettingByCandidate: Record<string, number> = {};
    
    for (const result of aggregateResult) {
      totalAmount += result.totalAmount;
      participantCount += result.count;
      bettingByCandidate[result._id] = result.totalAmount;
    }
    
    return {
      info,
      totalAmount,
      participantCount,
      bettingByCandidate
    };
  }

  /**
   * 베팅 참여
   */
  async placeBet(params: {
    bettingId: number;
    generalId: number;
    userId: number;
    bettingType: number[];
    amount: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const betting = new Betting(this.sessionId, params.bettingId);
      await betting.bet(params.generalId, params.userId, params.bettingType, params.amount);
      
      logger.info('[BettingSystemService] Bet placed', {
        sessionId: this.sessionId,
        ...params
      });
      
      return { success: true, message: '베팅에 성공했습니다.' };
    } catch (error: any) {
      logger.error('[BettingSystemService] placeBet error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 베팅 마감
   */
  async closeBetting(bettingId: number): Promise<{ success: boolean; message: string }> {
    try {
      const betting = new Betting(this.sessionId, bettingId);
      await betting.closeBetting();
      
      logger.info('[BettingSystemService] Betting closed', {
        sessionId: this.sessionId,
        bettingId
      });
      
      return { success: true, message: '베팅이 마감되었습니다.' };
    } catch (error: any) {
      logger.error('[BettingSystemService] closeBetting error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 베팅 정산
   */
  async settleBetting(bettingId: number, winners: number[]): Promise<{
    success: boolean;
    message: string;
    results?: BettingResult[];
  }> {
    try {
      const betting = new Betting(this.sessionId, bettingId);
      await betting.loadInfo();
      
      // 보상 계산
      const rewardList = await betting.calcReward(winners);
      
      // 보상 지급
      await betting.giveReward(winners);
      
      const results: BettingResult[] = rewardList.map(item => ({
        generalId: item.generalID,
        userId: item.userID,
        amount: item.amount,
        matchPoint: item.matchPoint,
        reward: item.amount
      }));
      
      logger.info('[BettingSystemService] Betting settled', {
        sessionId: this.sessionId,
        bettingId,
        winners,
        resultCount: results.length
      });
      
      return {
        success: true,
        message: '베팅이 정산되었습니다.',
        results
      };
    } catch (error: any) {
      logger.error('[BettingSystemService] settleBetting error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 베팅 취소 (환불)
   */
  async cancelBetting(bettingId: number): Promise<{ success: boolean; message: string }> {
    try {
      const detail = await this.getBettingDetail(bettingId);
      
      if (!detail.info) {
        return { success: false, message: '베팅을 찾을 수 없습니다.' };
      }
      
      if (detail.info.finished) {
        return { success: false, message: '이미 종료된 베팅은 취소할 수 없습니다.' };
      }
      
      // 모든 베팅 기록 조회
      const allBets = await NgBetting.find({
        session_id: this.sessionId,
        'data.betting_id': bettingId
      }).lean();
      
      // 환불 처리
      for (const bet of allBets) {
        const betData = bet.data as any;
        const generalId = betData.general_id;
        const userId = betData.user_id;
        const amount = betData.amount;
        
        if (detail.info.reqInheritancePoint) {
          // 유산포인트 환불
          const inheritStor = KVStorage.getStorage(`inheritance_${userId}:${this.sessionId}`);
          const previous = await inheritStor.getValue('previous') || [0, null];
          await inheritStor.setValue('previous', [previous[0] + amount, previous[1]]);
        } else {
          // 금 환불
          await General.updateOne(
            { session_id: this.sessionId, no: generalId },
            { $inc: { 'data.gold': amount } }
          );
        }
      }
      
      // 베팅 기록 삭제
      await NgBetting.deleteMany({
        session_id: this.sessionId,
        'data.betting_id': bettingId
      });
      
      // 베팅 정보 업데이트
      const bettingStor = await this.getBettingStor();
      const info = await bettingStor.getValue(`id_${bettingId}`);
      if (info) {
        (info as any).finished = true;
        (info as any).cancelled = true;
        await bettingStor.setValue(`id_${bettingId}`, info);
        
        // 세션에도 동기화
        await Session.updateOne(
          { session_id: this.sessionId },
          { $set: { [`data.betting.id_${bettingId}`]: info } }
        );
      }
      
      logger.info('[BettingSystemService] Betting cancelled', {
        sessionId: this.sessionId,
        bettingId,
        refundedBets: allBets.length
      });
      
      return { success: true, message: '베팅이 취소되고 환불되었습니다.' };
    } catch (error: any) {
      logger.error('[BettingSystemService] cancelBetting error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 내 베팅 기록 조회
   */
  async getMyBettingHistory(userId: number): Promise<{
    bettingId: number;
    bettingType: string;
    amount: number;
    createdAt: Date;
    info: BettingInfo | null;
  }[]> {
    const myBets = await NgBetting.find({
      session_id: this.sessionId,
      'data.user_id': userId
    }).sort({ createdAt: -1 }).lean();
    
    const bettingStor = await this.getBettingStor();
    
    const history = [];
    for (const bet of myBets) {
      const betData = bet.data as any;
      const bettingId = betData.betting_id;
      const info = await bettingStor.getValue(`id_${bettingId}`) as BettingInfo | null;
      
      history.push({
        bettingId,
        bettingType: betData.betting_type,
        amount: betData.amount,
        createdAt: bet.createdAt || new Date(),
        info
      });
    }
    
    return history;
  }

  /**
   * 베팅 통계 조회
   */
  async getBettingStats(): Promise<{
    totalBettings: number;
    activeBettings: number;
    settledBettings: number;
    totalVolume: number;
  }> {
    const allBettings = await this.getBettingList();
    const currentYearMonth = await this.getCurrentYearMonth();
    
    let activeBettings = 0;
    let settledBettings = 0;
    
    for (const betting of allBettings) {
      if (betting.finished) {
        settledBettings++;
      } else if (betting.openYearMonth <= currentYearMonth && betting.closeYearMonth > currentYearMonth) {
        activeBettings++;
      }
    }
    
    // 전체 베팅 금액 집계
    const volumeResult = await NgBetting.aggregate([
      { $match: { session_id: this.sessionId } },
      { $group: { _id: null, total: { $sum: '$data.amount' } } }
    ]);
    
    const totalVolume = volumeResult.length > 0 ? volumeResult[0].total : 0;
    
    return {
      totalBettings: allBettings.length,
      activeBettings,
      settledBettings,
      totalVolume
    };
  }
}

/**
 * 서비스 API 엔드포인트
 */
export class BettingSystemAPI {
  /**
   * 베팅 생성
   */
  static async createBetting(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const service = new BettingSystemService(sessionId);
    
    try {
      let result: BettingInfo;
      
      switch (data.betting_type) {
        case BettingType.WINNER_NATION:
          result = await service.createWinnerNationBetting({
            name: data.name,
            openYearMonth: data.open_year_month,
            closeYearMonth: data.close_year_month,
            reqInheritancePoint: data.req_inheritance_point
          });
          break;
        
        case BettingType.UNIFICATION_TIME:
          result = await service.createUnificationTimeBetting({
            name: data.name,
            openYearMonth: data.open_year_month,
            closeYearMonth: data.close_year_month,
            timeOptions: data.time_options,
            reqInheritancePoint: data.req_inheritance_point
          });
          break;
        
        case BettingType.EVENT:
        default:
          result = await service.createEventBetting({
            name: data.name,
            description: data.description,
            candidates: data.candidates,
            selectCnt: data.select_cnt || 1,
            openYearMonth: data.open_year_month,
            closeYearMonth: data.close_year_month,
            reqInheritancePoint: data.req_inheritance_point,
            isExclusive: data.is_exclusive
          });
          break;
      }
      
      return { success: true, result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 베팅 정산
   */
  static async settleBetting(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const bettingId = parseInt(data.betting_id);
    const winners = data.winners || [];
    
    const service = new BettingSystemService(sessionId);
    return service.settleBetting(bettingId, winners);
  }

  /**
   * 베팅 통계 조회
   */
  static async getBettingStats(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const service = new BettingSystemService(sessionId);
      const stats = await service.getBettingStats();
      
      return { success: true, result: stats };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

