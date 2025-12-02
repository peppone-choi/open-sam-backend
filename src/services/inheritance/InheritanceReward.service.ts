// @ts-nocheck - Type issues with Mongoose models need investigation
/**
 * InheritanceRewardService
 * 
 * 상속 보상 시스템
 * - 능력치 보너스
 * - 특기 선택권
 * - 유니크 아이템 확률
 * - 턴 시간 단축
 */

import { KVStorage } from '../../utils/KVStorage';
import { General } from '../../models/general.model';
import { UserRecord } from '../../models/user_record.model';
import { logger } from '../../common/logger';
import GameConstants from '../../utils/game-constants';
import { InheritancePointService, InheritanceKey } from './InheritancePoint.service';

// 버프 타입
export enum InheritBuffType {
  ATTACK = 'attack',           // 공격력 증가
  DEFENSE = 'defense',         // 방어력 증가
  CRITICAL = 'critical',       // 크리티컬 확률 증가
  DOMESTIC = 'domestic',       // 내정 효율 증가
  TACTICS = 'tactics',         // 계략 성공률 증가
  EXPERIENCE = 'experience',   // 경험치 획득량 증가
}

// 버프 레벨별 효과
const BUFF_EFFECTS: Record<InheritBuffType, number[]> = {
  [InheritBuffType.ATTACK]: [0, 5, 10, 15, 20, 25],       // %
  [InheritBuffType.DEFENSE]: [0, 5, 10, 15, 20, 25],     // %
  [InheritBuffType.CRITICAL]: [0, 2, 4, 6, 8, 10],       // %
  [InheritBuffType.DOMESTIC]: [0, 5, 10, 15, 20, 25],    // %
  [InheritBuffType.TACTICS]: [0, 3, 6, 9, 12, 15],       // %
  [InheritBuffType.EXPERIENCE]: [0, 10, 20, 30, 40, 50], // %
};

// 버프 타입 한글명
export const BUFF_TYPE_NAMES: Record<InheritBuffType, string> = {
  [InheritBuffType.ATTACK]: '공격력 증가',
  [InheritBuffType.DEFENSE]: '방어력 증가',
  [InheritBuffType.CRITICAL]: '크리티컬 확률',
  [InheritBuffType.DOMESTIC]: '내정 효율',
  [InheritBuffType.TACTICS]: '계략 성공률',
  [InheritBuffType.EXPERIENCE]: '경험치 획득량',
};

// 최대 버프 레벨
export const MAX_BUFF_LEVEL = 5;

export interface InheritBuffStatus {
  type: InheritBuffType;
  level: number;
  effect: number;
  name: string;
}

export interface ApplyRewardResult {
  success: boolean;
  message: string;
  appliedReward?: string;
  remainingPoints?: number;
}

export interface StatBonusResult {
  leadership: number;
  strength: number;
  intel: number;
  total: number;
}

export class InheritanceRewardService {
  private sessionId: string;
  private pointService: InheritancePointService;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.pointService = new InheritancePointService(sessionId);
  }

  /**
   * 유저의 상속 스토리지 가져오기
   */
  private async getInheritanceStor(userId: number) {
    return KVStorage.getStorage(`inheritance_${userId}:${this.sessionId}`);
  }

  /**
   * 게임 환경 스토리지 가져오기
   */
  private async getGameEnvStor() {
    return KVStorage.getStorage(`game_env:${this.sessionId}`);
  }

  /**
   * 유저 로그 기록
   */
  private async logUserAction(userId: number, text: string, logType: string = 'inheritPoint'): Promise<void> {
    const gameStor = await this.getGameEnvStor();
    const year = await gameStor.getValue('year') || 184;
    const month = await gameStor.getValue('month') || 1;
    
    await UserRecord.create({
      session_id: this.sessionId,
      data: {
        user_id: userId,
        log_type: logType,
        text,
        year,
        month,
        date: new Date().toISOString()
      }
    });
  }

  /**
   * 버프 구매
   */
  async buyBuff(userId: number, generalId: number, buffType: InheritBuffType, targetLevel: number): Promise<ApplyRewardResult> {
    try {
      // 유효성 검사
      if (!Object.values(InheritBuffType).includes(buffType)) {
        return { success: false, message: '유효하지 않은 버프 타입입니다.' };
      }
      
      if (targetLevel < 1 || targetLevel > MAX_BUFF_LEVEL) {
        return { success: false, message: `버프 레벨은 1~${MAX_BUFF_LEVEL} 사이여야 합니다.` };
      }
      
      // 장수 확인
      const general = await General.findOne({
        session_id: this.sessionId,
        no: generalId
      });
      
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const data = general.data as any || {};
      const owner = data.owner;
      
      if (owner !== userId) {
        return { success: false, message: '본인의 장수만 버프를 구매할 수 있습니다.' };
      }
      
      // 통일 여부 확인
      const gameStor = await this.getGameEnvStor();
      const isUnited = await gameStor.getValue('isunited');
      if (isUnited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      // 현재 버프 레벨 확인
      const aux = data.aux || {};
      const inheritBuffList = aux.inheritBuff || {};
      const currentLevel = inheritBuffList[buffType] || 0;
      
      if (currentLevel >= targetLevel) {
        return { success: false, message: '이미 해당 레벨 이상의 버프를 보유하고 있습니다.' };
      }
      
      // 필요 포인트 계산
      const buffPoints = GameConstants.INHERIT_BUFF_POINTS;
      const requiredPoints = buffPoints[targetLevel] - buffPoints[currentLevel];
      
      // 포인트 사용
      const useResult = await this.pointService.usePoints(userId, requiredPoints, `${BUFF_TYPE_NAMES[buffType]} ${targetLevel}단계 구매`);
      
      if (!useResult.success) {
        return useResult;
      }
      
      // 버프 적용
      inheritBuffList[buffType] = targetLevel;
      aux.inheritBuff = inheritBuffList;
      data.aux = aux;
      general.data = data;
      general.markModified('data');
      await general.save();
      
      // 로그 기록
      const additionalText = currentLevel > 0 ? '추가' : '';
      await this.logUserAction(userId, `${requiredPoints} 포인트로 ${BUFF_TYPE_NAMES[buffType]} ${targetLevel}단계 ${additionalText}구입`);
      
      logger.info('[InheritanceRewardService] Buff purchased', {
        sessionId: this.sessionId,
        userId,
        generalId,
        buffType,
        currentLevel,
        targetLevel,
        requiredPoints
      });
      
      return {
        success: true,
        message: `${BUFF_TYPE_NAMES[buffType]} ${targetLevel}단계를 구매했습니다.`,
        appliedReward: `${BUFF_TYPE_NAMES[buffType]} ${targetLevel}단계`,
        remainingPoints: useResult.remainingPoints
      };
    } catch (error: any) {
      logger.error('[InheritanceRewardService] buyBuff error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 현재 버프 상태 조회
   */
  async getBuffStatus(generalId: number): Promise<InheritBuffStatus[]> {
    const general = await General.findOne({
      session_id: this.sessionId,
      no: generalId
    }).lean();
    
    if (!general) {
      return [];
    }
    
    const data = general.data as any || {};
    const aux = data.aux || {};
    const inheritBuffList = aux.inheritBuff || {};
    
    const status: InheritBuffStatus[] = [];
    
    for (const buffType of Object.values(InheritBuffType)) {
      const level = inheritBuffList[buffType] || 0;
      const effect = BUFF_EFFECTS[buffType][level] || 0;
      
      status.push({
        type: buffType,
        level,
        effect,
        name: BUFF_TYPE_NAMES[buffType]
      });
    }
    
    return status;
  }

  /**
   * 스탯 보너스 계산 (랜덤 또는 지정)
   */
  async calculateStatBonus(userId: number, specifiedBonus?: [number, number, number]): Promise<StatBonusResult> {
    const inheritStor = await this.getInheritanceStor(userId);
    const previousData = await inheritStor.getValue(InheritanceKey.PREVIOUS) || [0, null];
    const points = previousData[0] || 0;
    
    // 기본 스탯 보너스 (3~5 랜덤)
    let totalBonus = Math.floor(Math.random() * 3) + 3;
    
    if (specifiedBonus) {
      // 지정된 보너스 사용 시 포인트 필요
      totalBonus = specifiedBonus.reduce((a, b) => a + b, 0);
      
      if (totalBonus < 3 || totalBonus > 5) {
        throw new Error('보너스 스탯 합계는 3~5 사이여야 합니다.');
      }
      
      return {
        leadership: specifiedBonus[0],
        strength: specifiedBonus[1],
        intel: specifiedBonus[2],
        total: totalBonus
      };
    }
    
    // 랜덤 분배
    const result: StatBonusResult = {
      leadership: 0,
      strength: 0,
      intel: 0,
      total: totalBonus
    };
    
    for (let i = 0; i < totalBonus; i++) {
      const roll = Math.floor(Math.random() * 3);
      switch (roll) {
        case 0:
          result.leadership++;
          break;
        case 1:
          result.strength++;
          break;
        case 2:
          result.intel++;
          break;
      }
    }
    
    return result;
  }

  /**
   * 랜덤 유니크 아이템 구매
   */
  async buyRandomUnique(userId: number, generalId: number): Promise<ApplyRewardResult> {
    try {
      const general = await General.findOne({
        session_id: this.sessionId,
        no: generalId
      });
      
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const data = general.data as any || {};
      const aux = data.aux || {};
      
      if (aux.inheritRandomUnique !== undefined && aux.inheritRandomUnique !== null) {
        return { success: false, message: '이미 구입 명령을 내렸습니다. 다음 턴까지 기다려주세요.' };
      }
      
      // 통일 여부 확인
      const gameStor = await this.getGameEnvStor();
      const isUnited = await gameStor.getValue('isunited');
      if (isUnited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const requiredPoints = GameConstants.INHERIT_ITEM_RANDOM_POINT;
      
      // 포인트 사용
      const useResult = await this.pointService.usePoints(userId, requiredPoints, '랜덤 유니크 아이템 구매');
      
      if (!useResult.success) {
        return useResult;
      }
      
      // 구매 요청 기록
      aux.inheritRandomUnique = new Date().toISOString();
      data.aux = aux;
      general.data = data;
      general.markModified('data');
      await general.save();
      
      await this.logUserAction(userId, `${requiredPoints} 포인트로 랜덤 유니크 구입`);
      
      logger.info('[InheritanceRewardService] Random unique purchase requested', {
        sessionId: this.sessionId,
        userId,
        generalId,
        requiredPoints
      });
      
      return {
        success: true,
        message: '랜덤 유니크 아이템 구매를 요청했습니다. 다음 턴에 지급됩니다.',
        appliedReward: '랜덤 유니크 아이템',
        remainingPoints: useResult.remainingPoints
      };
    } catch (error: any) {
      logger.error('[InheritanceRewardService] buyRandomUnique error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 특정 전투 특기 예약
   */
  async reserveSpecialWar(userId: number, generalId: number, specialType: string): Promise<ApplyRewardResult> {
    try {
      const general = await General.findOne({
        session_id: this.sessionId,
        no: generalId
      });
      
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const data = general.data as any || {};
      const aux = data.aux || {};
      
      const currentSpecialWar = data.special2;
      const inheritSpecificSpecialWar = aux.inheritSpecificSpecialWar;
      
      if (currentSpecialWar === specialType) {
        return { success: false, message: '이미 그 특기를 보유하고 있습니다.' };
      }
      
      if (inheritSpecificSpecialWar === specialType) {
        return { success: false, message: '이미 그 특기를 예약하였습니다.' };
      }
      
      if (inheritSpecificSpecialWar !== null && inheritSpecificSpecialWar !== undefined) {
        return { success: false, message: '이미 예약한 특기가 있습니다.' };
      }
      
      // 통일 여부 확인
      const gameStor = await this.getGameEnvStor();
      const isUnited = await gameStor.getValue('isunited');
      if (isUnited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const requiredPoints = GameConstants.INHERIT_SPECIFIC_SPECIAL_POINT;
      
      // 포인트 사용
      const useResult = await this.pointService.usePoints(userId, requiredPoints, `전투 특기 ${specialType} 예약`);
      
      if (!useResult.success) {
        return useResult;
      }
      
      // 특기 예약
      aux.inheritSpecificSpecialWar = specialType;
      data.aux = aux;
      general.data = data;
      general.markModified('data');
      await general.save();
      
      await this.logUserAction(userId, `${requiredPoints} 포인트로 다음 전투 특기로 ${specialType} 지정`);
      
      logger.info('[InheritanceRewardService] Special war reserved', {
        sessionId: this.sessionId,
        userId,
        generalId,
        specialType,
        requiredPoints
      });
      
      return {
        success: true,
        message: `전투 특기 ${specialType}을(를) 예약했습니다.`,
        appliedReward: `전투 특기: ${specialType}`,
        remainingPoints: useResult.remainingPoints
      };
    } catch (error: any) {
      logger.error('[InheritanceRewardService] reserveSpecialWar error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 턴 시간 재설정
   */
  async resetTurnTime(userId: number, generalId: number): Promise<ApplyRewardResult> {
    try {
      const general = await General.findOne({
        session_id: this.sessionId,
        no: generalId
      });
      
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const data = general.data as any || {};
      const aux = data.aux || {};
      
      // 통일 여부 확인
      const gameStor = await this.getGameEnvStor();
      const isUnited = await gameStor.getValue('isunited');
      if (isUnited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      // 현재 레벨 및 필요 포인트 계산
      const currentLevel = aux.inheritResetTurnTime ?? -1;
      const nextLevel = currentLevel + 1;
      const requiredPoints = GameConstants.calcResetAttrPoint(nextLevel);
      
      // 포인트 사용
      const useResult = await this.pointService.usePoints(userId, requiredPoints, '턴 시간 재설정');
      
      if (!useResult.success) {
        return useResult;
      }
      
      // 턴 시간 랜덤 설정
      const turnTerm = await gameStor.getValue('turnterm') || 60;
      const afterTurn = Math.random() * turnTerm * 60;
      const minutes = Math.floor(afterTurn / 60);
      const seconds = Math.floor(afterTurn % 60);
      
      // 턴 시간 재설정 적용
      aux.inheritResetTurnTime = nextLevel;
      aux.nextTurnTimeBase = afterTurn;
      data.aux = aux;
      general.data = data;
      general.markModified('data');
      await general.save();
      
      await this.logUserAction(userId, `${requiredPoints} 포인트로 턴 시간을 바꾸어 다다음 턴부터 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} 적용`);
      
      logger.info('[InheritanceRewardService] Turn time reset', {
        sessionId: this.sessionId,
        userId,
        generalId,
        nextLevel,
        afterTurn,
        requiredPoints
      });
      
      return {
        success: true,
        message: `턴 시간이 재설정되었습니다. 다다음 턴부터 적용됩니다.`,
        appliedReward: '턴 시간 재설정',
        remainingPoints: useResult.remainingPoints
      };
    } catch (error: any) {
      logger.error('[InheritanceRewardService] resetTurnTime error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * 보상 비용 정보 조회
   */
  async getRewardCosts(): Promise<Record<string, number | number[]>> {
    return {
      statBonus: GameConstants.INHERIT_BORN_STAT_POINT,
      randomUnique: GameConstants.INHERIT_ITEM_RANDOM_POINT,
      specificSpecial: GameConstants.INHERIT_SPECIFIC_SPECIAL_POINT,
      buffPoints: GameConstants.INHERIT_BUFF_POINTS,
      resetAttrBase: GameConstants.INHERIT_RESET_ATTR_POINT_BASE,
      checkOwner: GameConstants.INHERIT_CHECK_OWNER_POINT
    };
  }
}

/**
 * 서비스 API 엔드포인트
 */
export class InheritanceRewardAPI {
  /**
   * 버프 구매
   */
  static async buyBuff(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    const buffType = data.type as InheritBuffType;
    const targetLevel = parseInt(data.level);
    
    if (!userId || !generalId) {
      return { success: false, message: '사용자 ID와 장수 ID가 필요합니다.' };
    }
    
    const service = new InheritanceRewardService(sessionId);
    return service.buyBuff(userId, generalId, buffType, targetLevel);
  }

  /**
   * 버프 상태 조회
   */
  static async getBuffStatus(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다.' };
    }
    
    try {
      const service = new InheritanceRewardService(sessionId);
      const status = await service.getBuffStatus(generalId);
      
      return {
        success: true,
        result: status
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 보상 비용 정보 조회
   */
  static async getRewardCosts(data: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const service = new InheritanceRewardService(sessionId);
      const costs = await service.getRewardCosts();
      
      return {
        success: true,
        result: costs
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

