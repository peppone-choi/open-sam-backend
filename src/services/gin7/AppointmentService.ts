/**
 * GIN7 Appointment Service
 * 
 * 직위 임명/해임 시스템
 * 임명 권한 매트릭스 및 gin7-auth-card 연동
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

import { EventEmitter } from 'events';
import { RankLadder, IRankLadderEntry } from '../../models/gin7/RankLadder';
import { Gin7Character } from '../../models/gin7/Character';
import { 
  RankCode, 
  getRankDefinition, 
  compareRanks,
  hasAuthorityLevel,
} from '../../config/gin7/ranks';
import { logger } from '../../common/logger';

// ============================================================================
// Position Definitions
// ============================================================================

export enum PositionCode {
  // 최고 직위
  SUPREME_COMMANDER = 'supreme_commander',       // 총사령관
  CHIEF_OF_STAFF = 'chief_of_staff',             // 총참모장
  
  // 함대 직위
  FLEET_COMMANDER = 'fleet_commander',           // 함대 사령관
  FLEET_VICE_COMMANDER = 'fleet_vice_commander', // 함대 부사령관
  FLEET_STAFF_CHIEF = 'fleet_staff_chief',       // 함대 참모장
  
  // 분함대/전대 직위
  SQUADRON_COMMANDER = 'squadron_commander',     // 분함대장/전대장
  
  // 행성/기지 직위
  GOVERNOR = 'governor',                         // 행성 총독
  BASE_COMMANDER = 'base_commander',             // 기지 사령관
  
  // 참모 직위
  OPERATIONS_STAFF = 'operations_staff',         // 작전 참모
  INTELLIGENCE_STAFF = 'intelligence_staff',     // 정보 참모
  LOGISTICS_STAFF = 'logistics_staff',           // 병참 참모
  COMMUNICATIONS_STAFF = 'communications_staff', // 통신 참모
}

export interface PositionDefinition {
  code: PositionCode;
  name: string;
  nameEn: string;
  minRank: RankCode;           // 최소 필요 계급
  maxSlots: number;            // 최대 인원 (-1 = 무제한)
  appointableBy: number;       // 필요 권한 레벨
  associatedCards: string[];   // 부여되는 권한 카드 ID
  scope: 'faction' | 'fleet' | 'planet' | 'base';
}

export const POSITION_TABLE: Record<PositionCode, PositionDefinition> = {
  [PositionCode.SUPREME_COMMANDER]: {
    code: PositionCode.SUPREME_COMMANDER,
    name: '총사령관',
    nameEn: 'Supreme Commander',
    minRank: RankCode.GENERAL,
    maxSlots: 1,
    appointableBy: 12, // 원수만 가능 (또는 정치적 임명)
    associatedCards: ['cmd_all', 'personnel_all', 'strategy_all'],
    scope: 'faction',
  },
  [PositionCode.CHIEF_OF_STAFF]: {
    code: PositionCode.CHIEF_OF_STAFF,
    name: '총참모장',
    nameEn: 'Chief of Staff',
    minRank: RankCode.LIEUTENANT_GENERAL,
    maxSlots: 1,
    appointableBy: 12,
    associatedCards: ['cmd_strategic', 'personnel_officer', 'strategy_all'],
    scope: 'faction',
  },
  [PositionCode.FLEET_COMMANDER]: {
    code: PositionCode.FLEET_COMMANDER,
    name: '함대 사령관',
    nameEn: 'Fleet Commander',
    minRank: RankCode.MAJOR_GENERAL,
    maxSlots: 10, // 최대 함대 수
    appointableBy: 11,
    associatedCards: ['cmd_fleet', 'personnel_fleet'],
    scope: 'fleet',
  },
  [PositionCode.FLEET_VICE_COMMANDER]: {
    code: PositionCode.FLEET_VICE_COMMANDER,
    name: '함대 부사령관',
    nameEn: 'Fleet Vice Commander',
    minRank: RankCode.BRIGADIER_GENERAL,
    maxSlots: 10,
    appointableBy: 11,
    associatedCards: ['cmd_fleet_assist'],
    scope: 'fleet',
  },
  [PositionCode.FLEET_STAFF_CHIEF]: {
    code: PositionCode.FLEET_STAFF_CHIEF,
    name: '함대 참모장',
    nameEn: 'Fleet Staff Chief',
    minRank: RankCode.COLONEL,
    maxSlots: 10,
    appointableBy: 11,
    associatedCards: ['cmd_staff', 'strategy_fleet'],
    scope: 'fleet',
  },
  [PositionCode.SQUADRON_COMMANDER]: {
    code: PositionCode.SQUADRON_COMMANDER,
    name: '분함대장',
    nameEn: 'Squadron Commander',
    minRank: RankCode.LIEUTENANT_COLONEL,
    maxSlots: -1, // 무제한
    appointableBy: 10,
    associatedCards: ['cmd_squadron'],
    scope: 'fleet',
  },
  [PositionCode.GOVERNOR]: {
    code: PositionCode.GOVERNOR,
    name: '행성 총독',
    nameEn: 'Governor',
    minRank: RankCode.COLONEL,
    maxSlots: -1,
    appointableBy: 11,
    associatedCards: ['gov_planet', 'economy_planet', 'defense_planet'],
    scope: 'planet',
  },
  [PositionCode.BASE_COMMANDER]: {
    code: PositionCode.BASE_COMMANDER,
    name: '기지 사령관',
    nameEn: 'Base Commander',
    minRank: RankCode.MAJOR,
    maxSlots: -1,
    appointableBy: 10,
    associatedCards: ['cmd_base', 'defense_base'],
    scope: 'base',
  },
  [PositionCode.OPERATIONS_STAFF]: {
    code: PositionCode.OPERATIONS_STAFF,
    name: '작전 참모',
    nameEn: 'Operations Staff',
    minRank: RankCode.CAPTAIN,
    maxSlots: -1,
    appointableBy: 9,
    associatedCards: ['staff_operations'],
    scope: 'fleet',
  },
  [PositionCode.INTELLIGENCE_STAFF]: {
    code: PositionCode.INTELLIGENCE_STAFF,
    name: '정보 참모',
    nameEn: 'Intelligence Staff',
    minRank: RankCode.CAPTAIN,
    maxSlots: -1,
    appointableBy: 9,
    associatedCards: ['staff_intelligence'],
    scope: 'fleet',
  },
  [PositionCode.LOGISTICS_STAFF]: {
    code: PositionCode.LOGISTICS_STAFF,
    name: '병참 참모',
    nameEn: 'Logistics Staff',
    minRank: RankCode.CAPTAIN,
    maxSlots: -1,
    appointableBy: 9,
    associatedCards: ['staff_logistics'],
    scope: 'fleet',
  },
  [PositionCode.COMMUNICATIONS_STAFF]: {
    code: PositionCode.COMMUNICATIONS_STAFF,
    name: '통신 참모',
    nameEn: 'Communications Staff',
    minRank: RankCode.FIRST_LIEUTENANT,
    maxSlots: -1,
    appointableBy: 8,
    associatedCards: ['staff_communications'],
    scope: 'fleet',
  },
};

// ============================================================================
// Types
// ============================================================================

export interface AppointmentResult {
  success: boolean;
  characterId: string;
  characterName: string;
  positionCode: PositionCode;
  positionName: string;
  scopeId?: string;          // fleetId, planetId 등
  error?: string;
}

export interface DismissalResult {
  success: boolean;
  characterId: string;
  characterName: string;
  positionCode: PositionCode;
  positionName: string;
  reason: string;
  error?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AppointmentService extends EventEmitter {
  private static instance: AppointmentService;
  
  private constructor() {
    super();
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
    positionCode: PositionCode,
    scopeId?: string // fleetId, planetId 등
  ): Promise<AppointmentResult> {
    const position = POSITION_TABLE[positionCode];
    
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
    
    // 임명권 레벨 체크
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    if (appointerRankDef.authorityLevel < position.appointableBy) {
      return {
        success: false,
        characterId: targetId,
        characterName: 'Unknown',
        positionCode,
        positionName: position.name,
        error: `Insufficient authority: requires level ${position.appointableBy}`,
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
    
    // 같은 세력 체크
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
    
    // 최소 계급 체크
    if (compareRanks(target.rank as RankCode, position.minRank) < 0) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
        error: `Minimum rank required: ${getRankDefinition(position.minRank).name}`,
      };
    }
    
    // 정원 체크
    if (position.maxSlots !== -1) {
      const currentCount = await this.countPositionHolders(
        sessionId, 
        target.factionId, 
        positionCode,
        scopeId
      );
      
      if (currentCount >= position.maxSlots) {
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
      
      // 권한 카드 부여 (gin7-auth-card 연동)
      await this.grantAuthorityCards(sessionId, targetId, position.associatedCards);
      
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
        positionCode: PositionCode.OPERATIONS_STAFF,
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
        positionCode: PositionCode.OPERATIONS_STAFF,
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
        positionCode: PositionCode.OPERATIONS_STAFF,
        positionName: 'None',
        reason,
        error: 'Target has no position',
      };
    }
    
    const positionCode = target.position.positionId as PositionCode;
    const position = POSITION_TABLE[positionCode];
    
    // 해임권 체크
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    if (appointerRankDef.authorityLevel < position.appointableBy) {
      return {
        success: false,
        characterId: targetId,
        characterName: target.characterName,
        positionCode,
        positionName: position.name,
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
        positionName: position.name,
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
        positionName: position.name,
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
        positionName: position.name,
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
      const position = POSITION_TABLE[entry.position.positionId as PositionCode];
      
      // 권한 카드 회수
      if (position) {
        await this.revokeAuthorityCards(sessionId, characterId, position.associatedCards);
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
      name: cardId, // 실제로는 카드 정의 테이블에서 조회
      category: 'position',
      commands: [], // 카드 정의에서 조회
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
    positionCode: PositionCode,
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
    positionCode: PositionCode,
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
    positionCode: PositionCode | null;
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
      positionCode: entry.position.positionId as PositionCode,
      positionName: entry.position.positionName,
      scopeId: entry.position.scopeId,
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
    positionCode: PositionCode;
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
    
    for (const [code, position] of Object.entries(POSITION_TABLE)) {
      const positionCode = code as PositionCode;
      const holders = await this.getPositionHolders(sessionId, factionId, positionCode);
      
      if (position.maxSlots === 1) {
        // 단일 직위
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
        // 복수 직위 (현재 보유자 있는 것만)
        for (const holder of holders) {
          result.push({
            positionCode,
            positionName: position.name,
            holder: {
              characterId: holder.characterId,
              characterName: holder.characterName,
              rank: holder.rank as RankCode,
            },
            scopeId: holder.position?.scopeId,
            maxSlots: position.maxSlots,
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
  ): Promise<PositionDefinition[]> {
    const appointer = await RankLadder.findOne({ 
      sessionId, 
      characterId: appointerId, 
      status: 'active' 
    });
    
    if (!appointer) return [];
    
    const appointerRankDef = getRankDefinition(appointer.rank as RankCode);
    
    return Object.values(POSITION_TABLE).filter(
      position => appointerRankDef.authorityLevel >= position.appointableBy
    );
  }
}

export default AppointmentService;

