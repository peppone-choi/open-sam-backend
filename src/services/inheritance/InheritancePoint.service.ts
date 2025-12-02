// @ts-nocheck - Type issues with Mongoose models need investigation
/**
 * InheritancePointService
 * 
 * 상속 포인트 계산 및 사용 서비스
 * - 공적 기반 포인트 계산
 * - 관직 기반 포인트 계산
 * - 업적 기반 포인트 계산
 * - 포인트 사용 관리
 */

import { KVStorage } from '../../utils/KVStorage';
import { General } from '../../models/general.model';
import { RankData } from '../../models/rank_data.model';
import { logger } from '../../common/logger';
import GameConstants from '../../utils/game-constants';

// 상속 포인트 키
export enum InheritanceKey {
  PREVIOUS = 'previous',           // 이전 회차에서 획득한 포인트
  LIVED_MONTH = 'lived_month',     // 생존 개월 수
  MAX_BELONG = 'max_belong',       // 최대 소속 규모
  MAX_DOMESTIC_CRITICAL = 'max_domestic_critical', // 최대 내정 크리티컬
  ACTIVE_ACTION = 'active_action', // 활동 횟수
  COMBAT = 'combat',               // 전투 횟수
  SABOTAGE = 'sabotage',          // 계략 횟수
  UNIFIER = 'unifier',            // 통일 기여
  DEX = 'dex',                    // 숙련도
  TOURNAMENT = 'tournament',      // 토너먼트 성적
  BETTING = 'betting',            // 베팅 성적
}

// 포인트 계산 가중치
const POINT_WEIGHTS = {
  LIVED_MONTH: 10,           // 생존 개월당 10포인트
  MAX_BELONG: 50,            // 최대 소속 규모당 50포인트
  ACTIVE_ACTION: 5,          // 활동 횟수당 5포인트
  COMBAT: 20,                // 전투 횟수당 20포인트
  SABOTAGE: 15,              // 계략 횟수당 15포인트
  DOMESTIC_CRITICAL: 2,      // 내정 크리티컬당 2포인트
  UNIFIER_BONUS: 5000,       // 통일 기여 보너스
  TOURNAMENT_WIN: 500,       // 토너먼트 우승
  TOURNAMENT_SECOND: 300,    // 토너먼트 준우승
  TOURNAMENT_THIRD: 200,     // 토너먼트 3위
  BETTING_WIN_RATE: 100,     // 베팅 승률 보너스
};

// 관직별 포인트 보너스
const OFFICE_POINT_BONUS: Record<string, number> = {
  '군주': 3000,
  '승상': 2000,
  '대장군': 2000,
  '태위': 1500,
  '사공': 1500,
  '사도': 1500,
  '대사마': 1200,
  '대사농': 1000,
  '위위': 1000,
  '정위': 800,
  '대홍로': 800,
  '태복': 600,
  '종정': 600,
  '광록훈': 500,
  '집금오': 500,
};

export interface InheritancePointDetail {
  base: number;
  livedMonth: number;
  maxBelong: number;
  activeAction: number;
  combat: number;
  sabotage: number;
  domesticCritical: number;
  officeBonus: number;
  unifierBonus: number;
  tournamentBonus: number;
  bettingBonus: number;
  total: number;
}

export interface UsePointResult {
  success: boolean;
  message: string;
  remainingPoints?: number;
  spentPoints?: number;
}

export class InheritancePointService {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 유저의 상속 포인트 스토리지 가져오기
   */
  private async getInheritanceStor(userId: number) {
    return KVStorage.getStorage(`inheritance_${userId}:${this.sessionId}`);
  }

  /**
   * 현재 보유 포인트 조회
   */
  async getCurrentPoints(userId: number): Promise<number> {
    const inheritStor = await this.getInheritanceStor(userId);
    const previous = await inheritStor.getValue(InheritanceKey.PREVIOUS) || [0, null];
    return previous[0] || 0;
  }

  /**
   * 포인트 증가
   */
  async increasePoints(userId: number, amount: number, reason: string): Promise<number> {
    const inheritStor = await this.getInheritanceStor(userId);
    const previous = await inheritStor.getValue(InheritanceKey.PREVIOUS) || [0, null];
    const currentPoints = previous[0] || 0;
    const newPoints = currentPoints + amount;
    
    await inheritStor.setValue(InheritanceKey.PREVIOUS, [newPoints, previous[1]]);
    
    logger.info('[InheritancePointService] Points increased', {
      sessionId: this.sessionId,
      userId,
      amount,
      reason,
      previousPoints: currentPoints,
      newPoints
    });
    
    return newPoints;
  }

  /**
   * 포인트 사용
   */
  async usePoints(userId: number, amount: number, reason: string): Promise<UsePointResult> {
    const inheritStor = await this.getInheritanceStor(userId);
    const previous = await inheritStor.getValue(InheritanceKey.PREVIOUS) || [0, null];
    const currentPoints = previous[0] || 0;
    
    if (currentPoints < amount) {
      return {
        success: false,
        message: `충분한 유산 포인트가 없습니다. 필요: ${amount}, 보유: ${currentPoints}`
      };
    }
    
    const newPoints = currentPoints - amount;
    await inheritStor.setValue(InheritanceKey.PREVIOUS, [newPoints, previous[1]]);
    
    logger.info('[InheritancePointService] Points used', {
      sessionId: this.sessionId,
      userId,
      amount,
      reason,
      previousPoints: currentPoints,
      newPoints
    });
    
    return {
      success: true,
      message: `${amount} 포인트를 사용했습니다.`,
      remainingPoints: newPoints,
      spentPoints: amount
    };
  }

  /**
   * 공적 기반 포인트 계산
   */
  async calcMeritBasedPoints(generalId: number): Promise<number> {
    const general = await General.findOne({
      session_id: this.sessionId,
      no: generalId
    }).lean();
    
    if (!general) {
      return 0;
    }
    
    const data = general.data as any || {};
    const dedLevel = data.dedLevel || 0;
    const experience = data.experience || 0;
    
    // 공적 레벨 * 100 + 경험치 / 100
    return Math.floor(dedLevel * 100 + experience / 100);
  }

  /**
   * 관직 기반 포인트 계산
   */
  async calcOfficeBasedPoints(generalId: number): Promise<number> {
    const general = await General.findOne({
      session_id: this.sessionId,
      no: generalId
    }).lean();
    
    if (!general) {
      return 0;
    }
    
    const data = general.data as any || {};
    const officeName = data.officeName || data.officer_level_name || '';
    
    return OFFICE_POINT_BONUS[officeName] || 0;
  }

  /**
   * 업적 기반 포인트 계산
   */
  async calcAchievementBasedPoints(userId: number): Promise<number> {
    const inheritStor = await this.getInheritanceStor(userId);
    let total = 0;
    
    // 생존 개월수
    const livedMonth = await inheritStor.getValue(InheritanceKey.LIVED_MONTH) || 0;
    total += livedMonth * POINT_WEIGHTS.LIVED_MONTH;
    
    // 최대 소속 규모
    const maxBelong = await inheritStor.getValue(InheritanceKey.MAX_BELONG) || 0;
    total += maxBelong * POINT_WEIGHTS.MAX_BELONG;
    
    // 활동 횟수
    const activeAction = await inheritStor.getValue(InheritanceKey.ACTIVE_ACTION) || 0;
    total += activeAction * POINT_WEIGHTS.ACTIVE_ACTION;
    
    // 전투 횟수
    const combat = await inheritStor.getValue(InheritanceKey.COMBAT) || 0;
    total += combat * POINT_WEIGHTS.COMBAT;
    
    // 계략 횟수
    const sabotage = await inheritStor.getValue(InheritanceKey.SABOTAGE) || 0;
    total += sabotage * POINT_WEIGHTS.SABOTAGE;
    
    // 내정 크리티컬
    const domesticCritical = await inheritStor.getValue(InheritanceKey.MAX_DOMESTIC_CRITICAL) || 0;
    total += domesticCritical * POINT_WEIGHTS.DOMESTIC_CRITICAL;
    
    return total;
  }

  /**
   * 통일 기여 포인트 계산
   */
  async calcUnifierPoints(generalId: number, isUnifier: boolean): Promise<number> {
    if (!isUnifier) {
      return 0;
    }
    
    // 통일 국가의 장수인 경우 보너스
    const general = await General.findOne({
      session_id: this.sessionId,
      no: generalId
    }).lean();
    
    if (!general) {
      return 0;
    }
    
    // 기본 통일 보너스
    let bonus = POINT_WEIGHTS.UNIFIER_BONUS;
    
    // 군주였으면 2배
    const data = general.data as any || {};
    if (data.officer_level === 12) { // 군주
      bonus *= 2;
    }
    
    return bonus;
  }

  /**
   * 토너먼트 성적 포인트 계산
   */
  async calcTournamentPoints(userId: number): Promise<number> {
    const inheritStor = await this.getInheritanceStor(userId);
    const tournamentData = await inheritStor.getValue(InheritanceKey.TOURNAMENT);
    
    if (!tournamentData) {
      return 0;
    }
    
    let total = 0;
    
    // 우승 횟수
    const wins = tournamentData.wins || 0;
    total += wins * POINT_WEIGHTS.TOURNAMENT_WIN;
    
    // 준우승 횟수
    const seconds = tournamentData.seconds || 0;
    total += seconds * POINT_WEIGHTS.TOURNAMENT_SECOND;
    
    // 3위 횟수
    const thirds = tournamentData.thirds || 0;
    total += thirds * POINT_WEIGHTS.TOURNAMENT_THIRD;
    
    return total;
  }

  /**
   * 베팅 성적 포인트 계산
   */
  async calcBettingPoints(userId: number): Promise<number> {
    const inheritStor = await this.getInheritanceStor(userId);
    const bettingData = await inheritStor.getValue(InheritanceKey.BETTING);
    
    if (!bettingData) {
      return 0;
    }
    
    const totalBets = bettingData.totalBets || 0;
    const wins = bettingData.wins || 0;
    
    if (totalBets === 0) {
      return 0;
    }
    
    const winRate = wins / totalBets;
    return Math.floor(winRate * POINT_WEIGHTS.BETTING_WIN_RATE * wins);
  }

  /**
   * 전체 상속 포인트 계산 (상세)
   */
  async calculateTotalPoints(userId: number, generalId: number, isUnifier: boolean = false): Promise<InheritancePointDetail> {
    const base = await this.getCurrentPoints(userId);
    
    const inheritStor = await this.getInheritanceStor(userId);
    
    // 각 항목별 포인트 계산
    const livedMonth = ((await inheritStor.getValue(InheritanceKey.LIVED_MONTH)) || 0) * POINT_WEIGHTS.LIVED_MONTH;
    const maxBelong = ((await inheritStor.getValue(InheritanceKey.MAX_BELONG)) || 0) * POINT_WEIGHTS.MAX_BELONG;
    const activeAction = ((await inheritStor.getValue(InheritanceKey.ACTIVE_ACTION)) || 0) * POINT_WEIGHTS.ACTIVE_ACTION;
    const combat = ((await inheritStor.getValue(InheritanceKey.COMBAT)) || 0) * POINT_WEIGHTS.COMBAT;
    const sabotage = ((await inheritStor.getValue(InheritanceKey.SABOTAGE)) || 0) * POINT_WEIGHTS.SABOTAGE;
    const domesticCritical = ((await inheritStor.getValue(InheritanceKey.MAX_DOMESTIC_CRITICAL)) || 0) * POINT_WEIGHTS.DOMESTIC_CRITICAL;
    
    const officeBonus = await this.calcOfficeBasedPoints(generalId);
    const unifierBonus = await this.calcUnifierPoints(generalId, isUnifier);
    const tournamentBonus = await this.calcTournamentPoints(userId);
    const bettingBonus = await this.calcBettingPoints(userId);
    
    const total = base + livedMonth + maxBelong + activeAction + combat + 
                  sabotage + domesticCritical + officeBonus + unifierBonus + 
                  tournamentBonus + bettingBonus;
    
    return {
      base,
      livedMonth,
      maxBelong,
      activeAction,
      combat,
      sabotage,
      domesticCritical,
      officeBonus,
      unifierBonus,
      tournamentBonus,
      bettingBonus,
      total
    };
  }

  /**
   * 회차 종료 시 포인트 정산
   */
  async settlePointsOnGameEnd(userId: number, generalId: number, isUnifier: boolean): Promise<void> {
    const pointDetail = await this.calculateTotalPoints(userId, generalId, isUnifier);
    const earnedPoints = pointDetail.total - pointDetail.base;
    
    // 새로운 포인트 저장
    const inheritStor = await this.getInheritanceStor(userId);
    await inheritStor.setValue(InheritanceKey.PREVIOUS, [pointDetail.total, null]);
    
    // 누적 통계 초기화 (다음 회차 대비)
    await inheritStor.setValue(InheritanceKey.LIVED_MONTH, 0);
    await inheritStor.setValue(InheritanceKey.ACTIVE_ACTION, 0);
    await inheritStor.setValue(InheritanceKey.COMBAT, 0);
    await inheritStor.setValue(InheritanceKey.SABOTAGE, 0);
    await inheritStor.setValue(InheritanceKey.MAX_DOMESTIC_CRITICAL, 0);
    await inheritStor.setValue(InheritanceKey.MAX_BELONG, 0);
    
    logger.info('[InheritancePointService] Points settled on game end', {
      sessionId: this.sessionId,
      userId,
      generalId,
      isUnifier,
      earnedPoints,
      totalPoints: pointDetail.total
    });
  }

  /**
   * 활동 기록 증가
   */
  async recordActivity(userId: number, key: InheritanceKey, amount: number = 1): Promise<void> {
    const inheritStor = await this.getInheritanceStor(userId);
    const current = await inheritStor.getValue(key) || 0;
    await inheritStor.setValue(key, current + amount);
  }

  /**
   * 최대값 업데이트 (소속 규모 등)
   */
  async updateMaxValue(userId: number, key: InheritanceKey, value: number): Promise<void> {
    const inheritStor = await this.getInheritanceStor(userId);
    const current = await inheritStor.getValue(key) || 0;
    if (value > current) {
      await inheritStor.setValue(key, value);
    }
  }
}

/**
 * 서비스 API 엔드포인트
 */
export class InheritancePointAPI {
  /**
   * 현재 포인트 조회
   */
  static async getCurrentPoints(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      if (!userId) {
        return { success: false, message: '사용자 ID가 필요합니다.' };
      }
      
      const service = new InheritancePointService(sessionId);
      const points = await service.getCurrentPoints(userId);
      
      return {
        success: true,
        result: { points }
      };
    } catch (error: any) {
      logger.error('[InheritancePointAPI] getCurrentPoints error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 포인트 상세 조회
   */
  static async getPointDetail(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!userId || !generalId) {
        return { success: false, message: '사용자 ID와 장수 ID가 필요합니다.' };
      }
      
      const service = new InheritancePointService(sessionId);
      const detail = await service.calculateTotalPoints(userId, generalId, false);
      
      return {
        success: true,
        result: detail
      };
    } catch (error: any) {
      logger.error('[InheritancePointAPI] getPointDetail error', { error: error.message });
      return { success: false, message: error.message };
    }
  }
}

