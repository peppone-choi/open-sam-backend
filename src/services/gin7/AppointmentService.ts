/**
 * GIN7 Appointment Service
 *
 * - POSITION_DEFINITIONS 기반 임명/해임 검증
 * - 직무 권한 카드 자동 부여/회수
 * - 계급/정원/세력/임명권자 매트릭스 적용
 */

import { EventEmitter } from 'events';
import { RankLadder, IRankLadderEntry } from '../../models/gin7/RankLadder';
import { Gin7Character } from '../../models/gin7/Character';
import { 
  RankCode, 
  getRankDefinition,
} from '../../config/gin7/ranks';
import { logger } from '../../common/logger';
import {
  POSITION_DEFINITIONS,
  IPositionDefinition,
} from '../../constants/gin7/position_definitions';

// ============================================================================
// Types
// ============================================================================

export interface AppointmentResult {
  success: boolean;
  characterId: string;
  characterName: string;
  positionCode: string;
  positionName: string;
  scopeId?: string;
  error?: string;
}

export interface DismissalResult {
  success: boolean;
  characterId: string;
  characterName: string;
  positionCode: string;
  positionName: string;
  reason: string;
  error?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AppointmentService extends EventEmitter {
  private static instance: AppointmentService;
  private positionMap: Map<string, IPositionDefinition>;
  
  private constructor() {
    super();
    this.positionMap = new Map(POSITION_DEFINITIONS.map((p) => [p.id, p]));
  }
  
  public static getInstance(): AppointmentService {
    if (!AppointmentService.instance) {
      AppointmentService.instance = new AppointmentService();
    }
    return AppointmentService.instance;
  }
  
  // ==========================================================================
  // Appointment Logic
  // ==========================================================================
  
  /**
   * 직위 임명
   */
  async appoint(
    sessionId: string,
    appointerId: string,
    targetId: string,
    positionCode: string,
    scopeId?: string // fleetId, planetId 등
  ): Promise<AppointmentResult> {
    const position = this.positionMap.get(positionCode);
    
    if (!position) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode,
        positionName: 'Unknown',
        error: 'Invalid position code',
      };
    }
    
    // 임명권자 검증
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode,
        positionName: position.name,
        error: 'Appointer not found',
      };
    }
    
    // 대상자 검증
    const target = await RankLadder.findOne({ 
      sessionId, 
      characterId: targetId, 
      status: 'active' 
    });
    
    if (!target) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode,
        positionName: position.name,
        error: 'Target not found',
      };
    }
    
    // 세력 일치
    if (target.factionId !== appointer.factionId) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: 'Different faction',
      };
    }
    
    // 임명권 검증: appointableBy(직위 매트릭스) 또는 원수급 이상 예외
    const appointerPositionId = appointer.position?.positionId;
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    const hasDirectAuthority = position.appointableBy?.includes(appointerPositionId || '');
    const hasOverrideAuthority = appointerRankDef.authorityLevel >= 12; // 원수급
    if (!hasDirectAuthority && !hasOverrideAuthority) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: 'Insufficient appointment authority',
      };
    }
    
    // 계급 범위 체크 (position.minRank/maxRank 는 tier 숫자 기반)
    const targetRankDef = getRankDefinition(target.rank as RankCode);
    if (targetRankDef.tier < position.minRank) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: `Minimum rank required: tier ${position.minRank}`,
      };
    }
    if (position.maxRank !== undefined && targetRankDef.tier > position.maxRank) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: `Maximum rank exceeded: tier ${position.maxRank}`,
      };
    }
    
    // 정원 체크
    if (position.capacity !== -1) {
      const currentCount = await this.countPositionHolders(
        sessionId, 
        target.factionId, 
        positionCode,
        scopeId
      );
      
      if (currentCount >= position.capacity) {
        return {
          success: false,
          characterId: targetId,
          characterName: target.characterName,
          positionCode,
          positionName: position.name,
          error: 'Position slots full',
        };
      }
    }
    
    // 기존 직위가 있으면 해임 처리
    if (target.position?.positionId) {
      await this.removePosition(sessionId, targetId);
    }
    
    try {
      // 직위 부여
      await RankLadder.updateOne(
        { sessionId, characterId: targetId },
        {
          $set: {
            position: {
              positionId: positionCode,
              positionName: position.name,
              appointedDate: new Date(),
              appointedBy: appointerId,
              scopeId,
            },
            lastUpdated: new Date(),
          }
        }
      );
      
      // 권한 카드 부여
      const cardIds = this.getAuthorityCardIds(position);
      await this.grantAuthorityCards(sessionId, targetId, cardIds);
      
      // 이벤트 발행
      this.emit('appointment:executed', {
        sessionId,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        scopeId,
        appointerId,
        timestamp: new Date(),
      });
      
      logger.info('[AppointmentService] Appointment executed', {
        sessionId,
        characterId: targetId,
        positionCode,
        scopeId,
      });
      
      return {
        success: true,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        scopeId,
      };
    } catch (error) {
      logger.error('[AppointmentService] Appointment failed', { 
        sessionId, targetId, positionCode, error 
      });
      
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 직위 해임
   */
  async dismiss(
    sessionId: string,
    appointerId: string,
    targetId: string,
    reason: string
  ): Promise<DismissalResult> {
    // 임명권자 검증
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode: 'unknown',
        positionName: 'Unknown',
        reason,
        error: 'Appointer not found',
      };
    }
    
    // 대상자 검증
    const target = await RankLadder.findOne({ 
      sessionId, 
      characterId: targetId, 
      status: 'active' 
    });
    
    if (!target) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode: 'unknown',
        positionName: 'Unknown',
        reason,
        error: 'Target not found',
      };
    }
    
    if (!target.position?.positionId) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode: 'unknown',
        positionName: 'None',
        reason,
        error: 'Target has no position',
      };
    }
    
    const positionCode = target.position.positionId as string;
    const position = this.positionMap.get(positionCode);
    
    // 해임권 체크
    const appointerPositionId = appointer.position?.positionId;
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    const hasDirectAuthority = position?.appointableBy?.includes(appointerPositionId || '');
    const hasOverrideAuthority = appointerRankDef.authorityLevel >= 12;
    if (!hasDirectAuthority && !hasOverrideAuthority) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
        error: 'Insufficient authority for dismissal',
      };
    }
    
    try {
      // 직위 해임
      await this.removePosition(sessionId, targetId);
      
      // 이벤트 발행
      this.emit('dismissal:executed', {
        sessionId,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
        appointerId,
        timestamp: new Date(),
      });
      
      logger.info('[AppointmentService] Dismissal executed', {
        sessionId,
        characterId: targetId,
        positionCode,
        reason,
      });
      
      return {
        success: true,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
      };
    } catch (error) {
      logger.error('[AppointmentService] Dismissal failed', { 
        sessionId, targetId, error 
      });
      
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 직위 사임 (본인 요청)
   */
  async resign(
    sessionId: string,
    characterId: string,
    reason: string = '자발적 사임'
  ): Promise<DismissalResult> {
    const target = await RankLadder.findOne({ 
      sessionId, 
      characterId, 
      status: 'active',
      'position.positionId': { $exists: true }
    });
    
    if (!target) {
      return {
        success: false,
        characterId,
        characterName: '',
        positionCode: '',
        positionName: '',
        reason,
        error: '캐릭터를 찾을 수 없거나 직위가 없습니다.',
      };
    }
    
    const positionCode = target.position.positionId as string;
    const position = this.positionMap.get(positionCode);
    
    try {
      await this.removePosition(sessionId, characterId);
      
      this.emit('resignation:executed', {
        sessionId,
        characterId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
        timestamp: new Date(),
      });
      
      logger.info('[AppointmentService] Resignation executed', {
        sessionId,
        characterId,
        positionCode,
        reason,
      });
      
      return {
        success: true,
        characterId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
      };
    } catch (error) {
      logger.error('[AppointmentService] Resignation failed', { 
        sessionId, characterId, error 
      });
      
      return {
        success: false,
        characterId,
        characterName: target.characterName,
        positionCode,
        positionName: position?.name || target.position.positionName,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 직위 제거 (내부 함수)
   */
  private async removePosition(
    sessionId: string,
    characterId: string
  ): Promise<void> {
    const entry = await RankLadder.findOne({ sessionId, characterId });
    
    if (entry?.position?.positionId) {
      const position = this.positionMap.get(entry.position.positionId as string);
      
      // 권한 카드 회수
      if (position) {
        const cardIds = this.getAuthorityCardIds(position);
        await this.revokeAuthorityCards(sessionId, characterId, cardIds);
      }
    }
    
    // 직위 정보 제거
    await RankLadder.updateOne(
      { sessionId, characterId },
      { 
        $unset: { position: 1 },
        $set: { lastUpdated: new Date() }
      }
    );
  }
  
  // ==========================================================================
  // Authority Card Integration
  // ==========================================================================
  
  /**
   * 권한 카드 부여 (gin7-auth-card 연동)
   */
  private async grantAuthorityCards(
    sessionId: string,
    characterId: string,
    cardIds: string[]
  ): Promise<void> {
    if (cardIds.length === 0) return;
    
    // Character 모델의 commandCards에 추가
    const newCards = cardIds.map(cardId => ({
      cardId,
      name: cardId, // 실제로는 카드 정의 테이블에서 조회 예정
      category: 'position',
      commands: [],
    }));
    
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { 
        $push: { 
          commandCards: { $each: newCards } 
        } 
      }
    );
    
    logger.debug('[AppointmentService] Authority cards granted', {
      sessionId,
      characterId,
      cardIds,
    });
  }
  
  /**
   * 권한 카드 회수
   */
  private async revokeAuthorityCards(
    sessionId: string,
    characterId: string,
    cardIds: string[]
  ): Promise<void> {
    if (cardIds.length === 0) return;
    
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { 
        $pull: { 
          commandCards: { cardId: { $in: cardIds } } 
        } 
      }
    );
    
    logger.debug('[AppointmentService] Authority cards revoked', {
      sessionId,
      characterId,
      cardIds,
    });
  }
  
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  
  /**
   * 직위 보유자 수 조회
   */
  private async countPositionHolders(
    sessionId: string,
    factionId: string,
    positionCode: string,
    scopeId?: string
  ): Promise<number> {
    const query: any = {
      sessionId,
      factionId,
      status: 'active',
      'position.positionId': positionCode,
    };
    
    if (scopeId) {
      query['position.scopeId'] = scopeId;
    }
    
    return RankLadder.countDocuments(query);
  }
  
  /**
   * 특정 직위 보유자 조회
   */
  async getPositionHolders(
    sessionId: string,
    factionId: string,
    positionCode: string,
    scopeId?: string
  ): Promise<IRankLadderEntry[]> {
    const query: any = {
      sessionId,
      factionId,
      status: 'active',
      'position.positionId': positionCode,
    };
    
    if (scopeId) {
      query['position.scopeId'] = scopeId;
    }
    
    return RankLadder.find(query);
  }
  
  /**
   * 캐릭터의 현재 직위 조회
   */
  async getCharacterPosition(
    sessionId: string,
    characterId: string
  ): Promise<{
    positionCode: string | null;
    positionName: string | null;
    scopeId?: string;
    appointedDate?: Date;
    appointedBy?: string;
  }> {
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    
    if (!entry?.position?.positionId) {
      return { positionCode: null, positionName: null };
    }
    
    return {
      positionCode: entry.position.positionId as string,
      positionName: entry.position.positionName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scopeId: (entry.position as any).scopeId,
      appointedDate: entry.position.appointedDate,
      appointedBy: entry.position.appointedBy,
    };
  }
  
  /**
   * 세력의 모든 직위 현황 조회
   */
  async getFactionPositions(
    sessionId: string,
    factionId: string
  ): Promise<Array<{
    positionCode: string;
    positionName: string;
    holder?: {
      characterId: string;
      characterName: string;
      rank: RankCode;
    };
    scopeId?: string;
    maxSlots: number;
    currentCount: number;
  }>> {
    const result = [];
    
    for (const position of POSITION_DEFINITIONS) {
      const positionCode = position.id;
      const holders = await this.getPositionHolders(sessionId, factionId, positionCode);
      
      if (position.capacity === 1) {
        result.push({
          positionCode,
          positionName: position.name,
          holder: holders[0] ? {
            characterId: holders[0].characterId,
            characterName: holders[0].characterName,
            rank: holders[0].rank as RankCode,
          } : undefined,
          maxSlots: 1,
          currentCount: holders.length,
        });
      } else {
        for (const holder of holders) {
          result.push({
            positionCode,
            positionName: position.name,
            holder: {
              characterId: holder.characterId,
              characterName: holder.characterName,
              rank: holder.rank as RankCode,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scopeId: (holder.position as any)?.scopeId,
            maxSlots: position.capacity,
            currentCount: holders.length,
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * 임명 가능한 직위 목록 조회
   */
  async getAppointablePositions(
    sessionId: string,
    appointerId: string
  ): Promise<IPositionDefinition[]> {
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) return [];
    
    const appointerPositionId = appointer.position?.positionId;
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    
    return POSITION_DEFINITIONS.filter((position) => {
      const hasDirectAuthority = position.appointableBy?.includes(appointerPositionId || '');
      const hasOverrideAuthority = appointerRankDef.authorityLevel >= 12;
      return hasDirectAuthority || hasOverrideAuthority;
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * 직위 권한 플래그를 카드 ID로 변환
   * 실제 커맨드 매핑은 추후 card definition과 연동 예정
   */
  private getAuthorityCardIds(position: IPositionDefinition): string[] {
    const cardIds: string[] = [];
    const { authorities } = position;
    if (!authorities) return cardIds;
    const prefix = `position:${position.id}`;
    if (authorities.personnel_high) cardIds.push(`${prefix}:personnel_high`);
    if (authorities.personnel) cardIds.push(`${prefix}:personnel`);
    if (authorities.military) cardIds.push(`${prefix}:military`);
    if (authorities.fleet) cardIds.push(`${prefix}:fleet`);
    if (authorities.finance) cardIds.push(`${prefix}:finance`);
    if (authorities.intelligence) cardIds.push(`${prefix}:intelligence`);
    if (authorities.admin) cardIds.push(`${prefix}:admin`);
    if (authorities.diplomacy) cardIds.push(`${prefix}:diplomacy`);
    return cardIds;
  }
}

export default AppointmentService;

