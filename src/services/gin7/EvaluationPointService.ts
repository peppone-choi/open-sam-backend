/**
 * EvaluationPointService - 평가 포인트 시스템
 * 매뉴얼 기반 구현
 *
 * 평가 포인트:
 * - 전투 승리, 작전 성공, 업적 달성 등으로 획득
 * - 기함 구입, 특수 아이템 교환 등에 사용
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum EvaluationSource {
  BATTLE_VICTORY = 'BATTLE_VICTORY',           // 전투 승리
  BATTLE_MVP = 'BATTLE_MVP',                   // 전투 MVP
  OPERATION_SUCCESS = 'OPERATION_SUCCESS',     // 작전 성공
  KILL_COUNT = 'KILL_COUNT',                   // 격침 수
  DAMAGE_DEALT = 'DAMAGE_DEALT',               // 피해량
  CAPTURE_PLANET = 'CAPTURE_PLANET',           // 행성 점령
  DEFEND_PLANET = 'DEFEND_PLANET',             // 행성 방어
  PROMOTION = 'PROMOTION',                     // 승진
  DECORATION = 'DECORATION',                   // 훈장 수여
  SPECIAL_ACHIEVEMENT = 'SPECIAL_ACHIEVEMENT', // 특별 업적
  MONTHLY_BONUS = 'MONTHLY_BONUS',             // 월간 보너스
}

export interface EvaluationGain {
  characterId: string;
  source: EvaluationSource;
  amount: number;
  details?: string;
  timestamp: Date;
}

export interface EvaluationSpend {
  characterId: string;
  purpose: string;
  amount: number;
  itemId?: string;
  timestamp: Date;
}

// 포인트 획득 기준
const POINT_VALUES: Record<EvaluationSource, number> = {
  [EvaluationSource.BATTLE_VICTORY]: 50,
  [EvaluationSource.BATTLE_MVP]: 100,
  [EvaluationSource.OPERATION_SUCCESS]: 200,
  [EvaluationSource.KILL_COUNT]: 10,           // per kill
  [EvaluationSource.DAMAGE_DEALT]: 1,          // per 1000 damage
  [EvaluationSource.CAPTURE_PLANET]: 300,
  [EvaluationSource.DEFEND_PLANET]: 150,
  [EvaluationSource.PROMOTION]: 100,
  [EvaluationSource.DECORATION]: 50,
  [EvaluationSource.SPECIAL_ACHIEVEMENT]: 500,
  [EvaluationSource.MONTHLY_BONUS]: 20,
};

// 구매 가능 아이템
export interface PurchasableItem {
  itemId: string;
  name: string;
  cost: number;
  category: 'FLAGSHIP' | 'EQUIPMENT' | 'SPECIAL';
  description: string;
  requirements?: {
    minRank?: string;
    faction?: string;
  };
}

const PURCHASABLE_ITEMS: PurchasableItem[] = [
  {
    itemId: 'FLAGSHIP_STANDARD',
    name: '표준 기함',
    cost: 500,
    category: 'FLAGSHIP',
    description: '기본 기함 구입.',
  },
  {
    itemId: 'FLAGSHIP_BATTLESHIP',
    name: '전함급 기함',
    cost: 1000,
    category: 'FLAGSHIP',
    description: '전함급 기함 구입.',
    requirements: { minRank: 'COMMODORE' },
  },
  {
    itemId: 'FLAGSHIP_CARRIER',
    name: '항공모함급 기함',
    cost: 1500,
    category: 'FLAGSHIP',
    description: '항모급 기함 구입.',
    requirements: { minRank: 'REAR_ADMIRAL' },
  },
  {
    itemId: 'FLAGSHIP_COMMAND',
    name: '지휘함급 기함',
    cost: 2000,
    category: 'FLAGSHIP',
    description: '최상급 지휘함.',
    requirements: { minRank: 'ADMIRAL' },
  },
  {
    itemId: 'EQUIPMENT_SENSOR',
    name: '고급 센서',
    cost: 200,
    category: 'EQUIPMENT',
    description: '센서 범위 +20%.',
  },
  {
    itemId: 'EQUIPMENT_ENGINE',
    name: '고성능 엔진',
    cost: 300,
    category: 'EQUIPMENT',
    description: '이동 속도 +15%.',
  },
  {
    itemId: 'EQUIPMENT_SHIELD',
    name: '강화 방어막',
    cost: 400,
    category: 'EQUIPMENT',
    description: '쉴드 +25%.',
  },
  {
    itemId: 'SPECIAL_NAME_CHANGE',
    name: '이름 변경권',
    cost: 100,
    category: 'SPECIAL',
    description: '캐릭터 이름 변경.',
  },
  {
    itemId: 'SPECIAL_STAT_RESET',
    name: '능력치 재분배',
    cost: 500,
    category: 'SPECIAL',
    description: '능력치 일부 재분배.',
  },
];

// ============================================================
// EvaluationPointService Class
// ============================================================

export class EvaluationPointService extends EventEmitter {
  private static instance: EvaluationPointService;
  
  // 캐릭터별 포인트 캐시
  private pointCache: Map<string, number> = new Map();
  
  // 획득/소비 로그
  private gainLogs: Map<string, EvaluationGain[]> = new Map();
  private spendLogs: Map<string, EvaluationSpend[]> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[EvaluationPointService] Initialized');
  }

  public static getInstance(): EvaluationPointService {
    if (!EvaluationPointService.instance) {
      EvaluationPointService.instance = new EvaluationPointService();
    }
    return EvaluationPointService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 월간 보너스 지급
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload) => {
        await this.processMonthlyBonus(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[EvaluationPointService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 포인트 획득
  // ============================================================

  /**
   * 평가 포인트 획득
   */
  public async grantPoints(
    sessionId: string,
    characterId: string,
    source: EvaluationSource,
    multiplier: number = 1,
    details?: string,
  ): Promise<{ success: boolean; amount: number; newTotal: number }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, amount: 0, newTotal: 0 };
      }

      const baseAmount = POINT_VALUES[source] || 0;
      const amount = Math.floor(baseAmount * multiplier);

      // 캐릭터 데이터 업데이트
      if (!character.data) character.data = {};
      const currentPoints = character.data.evaluationPoints || 0;
      const newTotal = currentPoints + amount;
      character.data.evaluationPoints = newTotal;
      await character.save();

      // 캐시 업데이트
      const cacheKey = `${sessionId}-${characterId}`;
      this.pointCache.set(cacheKey, newTotal);

      // 로그 기록
      const gain: EvaluationGain = {
        characterId,
        source,
        amount,
        details,
        timestamp: new Date(),
      };
      const logs = this.gainLogs.get(cacheKey) || [];
      logs.push(gain);
      this.gainLogs.set(cacheKey, logs);

      this.emit('points:gained', {
        sessionId,
        characterId,
        characterName: character.name,
        source,
        amount,
        newTotal,
      });

      logger.debug(`[EvaluationPointService] ${character.name} gained ${amount} points (${source})`);

      return { success: true, amount, newTotal };
    } catch (error) {
      logger.error('[EvaluationPointService] Grant points error:', error);
      return { success: false, amount: 0, newTotal: 0 };
    }
  }

  /**
   * 전투 결과 기반 포인트 지급
   */
  public async processBattleResult(
    sessionId: string,
    result: {
      participants: Array<{
        characterId: string;
        isWinner: boolean;
        killCount: number;
        damageDealt: number;
        isMvp: boolean;
      }>;
    },
  ): Promise<void> {
    for (const participant of result.participants) {
      // 승리 보너스
      if (participant.isWinner) {
        await this.grantPoints(sessionId, participant.characterId, EvaluationSource.BATTLE_VICTORY);
      }

      // MVP 보너스
      if (participant.isMvp) {
        await this.grantPoints(sessionId, participant.characterId, EvaluationSource.BATTLE_MVP);
      }

      // 격침 보너스
      if (participant.killCount > 0) {
        await this.grantPoints(
          sessionId, 
          participant.characterId, 
          EvaluationSource.KILL_COUNT, 
          participant.killCount,
          `${participant.killCount} kills`
        );
      }

      // 피해량 보너스 (1000당 1포인트)
      if (participant.damageDealt >= 1000) {
        const damageMultiplier = Math.floor(participant.damageDealt / 1000);
        await this.grantPoints(
          sessionId, 
          participant.characterId, 
          EvaluationSource.DAMAGE_DEALT, 
          damageMultiplier,
          `${participant.damageDealt} damage`
        );
      }
    }
  }

  /**
   * 월간 보너스 지급
   */
  private async processMonthlyBonus(sessionId: string): Promise<void> {
    try {
      const characters = await Gin7Character.find({ sessionId, status: 'active' });
      
      for (const character of characters) {
        await this.grantPoints(
          sessionId,
          character.characterId,
          EvaluationSource.MONTHLY_BONUS,
          1,
          'Monthly activity bonus'
        );
      }

      logger.info(`[EvaluationPointService] Monthly bonus processed for session ${sessionId}`);
    } catch (error) {
      logger.error('[EvaluationPointService] Monthly bonus error:', error);
    }
  }

  // ============================================================
  // 포인트 사용
  // ============================================================

  /**
   * 아이템 구매
   */
  public async purchaseItem(
    sessionId: string,
    characterId: string,
    itemId: string,
  ): Promise<{ 
    success: boolean; 
    item?: PurchasableItem;
    remainingPoints?: number;
    error?: string;
  }> {
    try {
      const item = PURCHASABLE_ITEMS.find(i => i.itemId === itemId);
      if (!item) {
        return { success: false, error: '존재하지 않는 아이템입니다.' };
      }

      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
      }

      // 포인트 확인
      const currentPoints = character.data?.evaluationPoints || 0;
      if (currentPoints < item.cost) {
        return { success: false, error: `포인트가 부족합니다. (필요: ${item.cost}, 보유: ${currentPoints})` };
      }

      // 요구사항 확인
      if (item.requirements) {
        // TODO: 계급/진영 요구사항 확인
      }

      // 포인트 차감
      character.data = character.data || {};
      character.data.evaluationPoints = currentPoints - item.cost;

      // 아이템 지급
      if (!character.data.purchasedItems) character.data.purchasedItems = [];
      character.data.purchasedItems.push({
        itemId,
        purchasedAt: new Date(),
      });

      // 기함 구매인 경우 기함 설정
      if (item.category === 'FLAGSHIP') {
        character.data.flagshipType = itemId;
      }

      await character.save();

      // 로그 기록
      const cacheKey = `${sessionId}-${characterId}`;
      const spend: EvaluationSpend = {
        characterId,
        purpose: `Purchase: ${item.name}`,
        amount: item.cost,
        itemId,
        timestamp: new Date(),
      };
      const logs = this.spendLogs.get(cacheKey) || [];
      logs.push(spend);
      this.spendLogs.set(cacheKey, logs);

      this.emit('points:spent', {
        sessionId,
        characterId,
        characterName: character.name,
        itemId,
        cost: item.cost,
        remainingPoints: character.data.evaluationPoints,
      });

      return { 
        success: true, 
        item, 
        remainingPoints: character.data.evaluationPoints 
      };
    } catch (error) {
      logger.error('[EvaluationPointService] Purchase error:', error);
      return { success: false, error: '구매 처리 중 오류 발생' };
    }
  }

  /**
   * 포인트 직접 차감
   */
  public async deductPoints(
    sessionId: string,
    characterId: string,
    amount: number,
    purpose: string,
  ): Promise<{ success: boolean; remainingPoints: number }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, remainingPoints: 0 };
      }

      const currentPoints = character.data?.evaluationPoints || 0;
      if (currentPoints < amount) {
        return { success: false, remainingPoints: currentPoints };
      }

      character.data = character.data || {};
      character.data.evaluationPoints = currentPoints - amount;
      await character.save();

      return { success: true, remainingPoints: character.data.evaluationPoints };
    } catch (error) {
      logger.error('[EvaluationPointService] Deduct points error:', error);
      return { success: false, remainingPoints: 0 };
    }
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 포인트 잔액 조회
   */
  public async getPoints(sessionId: string, characterId: string): Promise<number> {
    const cacheKey = `${sessionId}-${characterId}`;
    
    // 캐시 확인
    const cached = this.pointCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // DB 조회
    const character = await Gin7Character.findOne({ sessionId, characterId });
    const points = character?.data?.evaluationPoints || 0;
    
    this.pointCache.set(cacheKey, points);
    return points;
  }

  /**
   * 구매 가능 아이템 목록
   */
  public getPurchasableItems(category?: string): PurchasableItem[] {
    if (category) {
      return PURCHASABLE_ITEMS.filter(item => item.category === category);
    }
    return PURCHASABLE_ITEMS;
  }

  /**
   * 획득 로그 조회
   */
  public getGainLogs(sessionId: string, characterId: string): EvaluationGain[] {
    const cacheKey = `${sessionId}-${characterId}`;
    return this.gainLogs.get(cacheKey) || [];
  }

  /**
   * 사용 로그 조회
   */
  public getSpendLogs(sessionId: string, characterId: string): EvaluationSpend[] {
    const cacheKey = `${sessionId}-${characterId}`;
    return this.spendLogs.get(cacheKey) || [];
  }

  /**
   * 랭킹 조회
   */
  public async getPointRanking(
    sessionId: string,
    limit: number = 10,
  ): Promise<Array<{ characterId: string; name: string; points: number }>> {
    const characters = await Gin7Character.find({ sessionId })
      .sort({ 'data.evaluationPoints': -1 })
      .limit(limit)
      .lean();

    return characters.map(c => ({
      characterId: c.characterId,
      name: c.name,
      points: c.data?.evaluationPoints || 0,
    }));
  }
}

export const evaluationPointService = EvaluationPointService.getInstance();
export default EvaluationPointService;





