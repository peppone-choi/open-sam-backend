/**
 * GIN7 Life Cycle Service
 * 
 * 캐릭터 생애주기 관리
 * - 퇴역 신청/처리
 * - 사망 처리
 * - 후계자 생성
 * - 상속 로직
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { RankLadder, IRankLadderEntry } from '../../models/gin7/RankLadder';
import { RankLadderService } from './RankLadderService';
import { AppointmentService } from './AppointmentService';
import { TimeEngine, GIN7_EVENTS, DayStartPayload } from '../../core/gin7/TimeEngine';
import { RankCode, getRankDefinition } from '../../config/gin7/ranks';
import { logger } from '../../common/logger';

// ============================================================================
// Types & Constants
// ============================================================================

/** 퇴역 유형 */
export enum RetirementType {
  VOLUNTARY = 'voluntary',       // 자진 퇴역
  MANDATORY = 'mandatory',       // 정년 퇴역
  MEDICAL = 'medical',           // 부상/질병 퇴역
  DISHONORABLE = 'dishonorable', // 불명예 퇴역
}

/** 사망 유형 */
export enum DeathType {
  BATTLE = 'battle',             // 전사
  EXECUTION = 'execution',       // 처형
  ILLNESS = 'illness',           // 병사
  OLD_AGE = 'old_age',           // 노환
  ACCIDENT = 'accident',         // 사고
  ASSASSINATION = 'assassination', // 암살
}

/** 상속 가능 항목 */
export interface InheritableAssets {
  gold: number;
  items: Array<{ itemId: string; slotId: string }>;
  traits: string[];              // 일부 특성은 상속 가능
  meritBonus: number;            // 부모 공적의 일부가 보너스로
  reputationBonus: number;       // 명성 보너스
}

/** 퇴역 결과 */
export interface RetirementResult {
  success: boolean;
  characterId: string;
  characterName: string;
  retirementType: RetirementType;
  finalRank: RankCode;
  serviceMonths: number;
  pension: number;               // 연금 (있다면)
  error?: string;
}

/** 사망 결과 */
export interface DeathResult {
  success: boolean;
  characterId: string;
  characterName: string;
  deathType: DeathType;
  inheritanceCreated: boolean;
  successorId?: string;
  error?: string;
}

/** 후계자 생성 파라미터 */
export interface SuccessorParams {
  sessionId: string;
  parentCharacterId: string;
  parentEntry: IRankLadderEntry;
  parentCharacter: IGin7Character;
  successorName: string;
  inheritRatio: number;          // 상속 비율 (0.0 ~ 1.0)
}

// ============================================================================
// Constants
// ============================================================================

const MANDATORY_RETIREMENT_AGE = 70;
const MIN_SERVICE_FOR_PENSION = 120; // 10년
const PENSION_BASE_MULTIPLIER = 0.1;
const TRAIT_INHERITANCE_CHANCE = 0.3;
const MERIT_INHERITANCE_RATIO = 0.1;
const STAT_INHERITANCE_RATIO = 0.2;

// ============================================================================
// Service Implementation
// ============================================================================

export class LifeCycleService extends EventEmitter {
  private static instance: LifeCycleService;
  private isSubscribed: boolean = false;
  private ladderService: RankLadderService;
  private appointmentService: AppointmentService;
  
  private constructor() {
    super();
    this.ladderService = RankLadderService.getInstance();
    this.appointmentService = AppointmentService.getInstance();
  }
  
  public static getInstance(): LifeCycleService {
    if (!LifeCycleService.instance) {
      LifeCycleService.instance = new LifeCycleService();
    }
    return LifeCycleService.instance;
  }
  
  // ==========================================================================
  // TimeEngine Integration
  // ==========================================================================
  
  public subscribe(): void {
    if (this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.on(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    this.isSubscribed = true;
    
    logger.info('[LifeCycleService] Subscribed to TimeEngine');
  }
  
  public unsubscribe(): void {
    if (!this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    timeEngine.off(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    this.isSubscribed = false;
  }
  
  /**
   * 일일 체크 - 정년 퇴역 및 자연사 처리
   */
  private async handleDayStart(payload: DayStartPayload): Promise<void> {
    const { sessionId, month, year } = payload;
    
    // 매년 1월에만 체크
    if (month !== 1) return;
    
    try {
      await this.checkMandatoryRetirements(sessionId, year);
      await this.checkNaturalDeaths(sessionId, year);
    } catch (error) {
      logger.error('[LifeCycleService] Daily check failed', { sessionId, error });
    }
  }
  
  /**
   * 정년 퇴역 체크
   */
  private async checkMandatoryRetirements(sessionId: string, currentYear: number): Promise<void> {
    // 정년에 도달한 캐릭터 조회
    const characters = await Gin7Character.find({
      sessionId,
      state: { $nin: ['dead', 'retired'] },
    });
    
    for (const character of characters) {
      const birthYear = (character.data?.birthDate as Date)?.getFullYear();
      if (!birthYear) continue;
      
      const age = currentYear - birthYear;
      
      if (age >= MANDATORY_RETIREMENT_AGE) {
        await this.processRetirement(
          sessionId,
          character.characterId,
          RetirementType.MANDATORY,
          `Mandatory retirement at age ${age}`
        );
      }
    }
  }
  
  /**
   * 자연사 체크 (노환)
   */
  private async checkNaturalDeaths(sessionId: string, currentYear: number): Promise<void> {
    const characters = await Gin7Character.find({
      sessionId,
      state: { $nin: ['dead'] },
    });
    
    for (const character of characters) {
      const birthYear = (character.data?.birthDate as Date)?.getFullYear();
      if (!birthYear) continue;
      
      const age = currentYear - birthYear;
      
      // 80세 이상부터 사망 확률 증가
      if (age >= 80) {
        const deathChance = (age - 80) * 0.05; // 80세: 0%, 100세: 100%
        
        if (Math.random() < deathChance) {
          await this.processDeath(
            sessionId,
            character.characterId,
            DeathType.OLD_AGE,
            `Natural death at age ${age}`
          );
        }
      }
    }
  }
  
  // ==========================================================================
  // Retirement Logic
  // ==========================================================================
  
  /**
   * 퇴역 신청 처리
   */
  async requestRetirement(
    sessionId: string,
    characterId: string,
    reason?: string
  ): Promise<RetirementResult> {
    return this.processRetirement(
      sessionId,
      characterId,
      RetirementType.VOLUNTARY,
      reason || 'Voluntary retirement'
    );
  }
  
  /**
   * 퇴역 처리
   */
  async processRetirement(
    sessionId: string,
    characterId: string,
    retirementType: RetirementType,
    reason: string
  ): Promise<RetirementResult> {
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    
    if (!entry) {
      return {
        success: false,
        characterId,
        characterName: 'Unknown',
        retirementType,
        finalRank: RankCode.PRIVATE_2ND,
        serviceMonths: 0,
        pension: 0,
        error: 'Character not found',
      };
    }
    
    const character = await Gin7Character.findOne({ sessionId, characterId });
    
    try {
      // 직위 해임
      if (entry.position?.positionId) {
        await this.appointmentService.dismiss(
          sessionId,
          characterId, // 자기 자신이 해임자
          characterId,
          'Retirement'
        );
      }
      
      // 라더에서 제거
      await this.ladderService.removeFromLadder(sessionId, characterId, 'retired');
      
      // Character 상태 변경
      await Gin7Character.updateOne(
        { sessionId, characterId },
        { 
          $set: { 
            state: 'retired' as const,
            'data.retirementInfo': {
              type: retirementType,
              reason,
              date: new Date(),
              finalRank: entry.rank,
              serviceMonths: entry.serviceMonths,
            }
          } 
        }
      );
      
      // 연금 계산
      const pension = this.calculatePension(
        entry.rank as RankCode,
        entry.serviceMonths,
        retirementType
      );
      
      this.emit('retirement:processed', {
        sessionId,
        characterId,
        characterName: entry.characterName,
        retirementType,
        finalRank: entry.rank,
        serviceMonths: entry.serviceMonths,
        pension,
        reason,
      });
      
      logger.info('[LifeCycleService] Retirement processed', {
        sessionId,
        characterId,
        retirementType,
        finalRank: entry.rank,
      });
      
      return {
        success: true,
        characterId,
        characterName: entry.characterName,
        retirementType,
        finalRank: entry.rank as RankCode,
        serviceMonths: entry.serviceMonths,
        pension,
      };
    } catch (error) {
      logger.error('[LifeCycleService] Retirement failed', { sessionId, characterId, error });
      
      return {
        success: false,
        characterId,
        characterName: entry.characterName,
        retirementType,
        finalRank: entry.rank as RankCode,
        serviceMonths: entry.serviceMonths,
        pension: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 연금 계산
   */
  private calculatePension(
    rank: RankCode,
    serviceMonths: number,
    retirementType: RetirementType
  ): number {
    if (serviceMonths < MIN_SERVICE_FOR_PENSION) return 0;
    if (retirementType === RetirementType.DISHONORABLE) return 0;
    
    const rankDef = getRankDefinition(rank);
    const basePension = rankDef.salaryMultiplier * 1000;
    const serviceYears = Math.floor(serviceMonths / 12);
    
    return Math.floor(basePension * PENSION_BASE_MULTIPLIER * serviceYears);
  }
  
  // ==========================================================================
  // Death Logic
  // ==========================================================================
  
  /**
   * 사망 처리
   */
  async processDeath(
    sessionId: string,
    characterId: string,
    deathType: DeathType,
    description?: string
  ): Promise<DeathResult> {
    const entry = await RankLadder.findOne({ sessionId, characterId, status: 'active' });
    const character = await Gin7Character.findOne({ sessionId, characterId });
    
    if (!entry || !character) {
      return {
        success: false,
        characterId,
        characterName: 'Unknown',
        deathType,
        inheritanceCreated: false,
        error: 'Character not found',
      };
    }
    
    try {
      // 직위 해임
      if (entry.position?.positionId) {
        // 사망 시에는 시스템이 해임 처리
        await RankLadder.updateOne(
          { sessionId, characterId },
          { $unset: { position: 1 } }
        );
      }
      
      // 라더에서 제거
      await this.ladderService.removeFromLadder(sessionId, characterId, 'deceased');
      
      // Character 상태 변경
      await Gin7Character.updateOne(
        { sessionId, characterId },
        { 
          $set: { 
            state: 'dead',
            'data.deathInfo': {
              type: deathType,
              description,
              date: new Date(),
              finalRank: entry.rank,
            }
          } 
        }
      );
      
      // 상속 가능 자산 계산
      const inheritableAssets = this.calculateInheritableAssets(character, entry);
      
      // 후계자 생성 (플레이어 캐릭터인 경우)
      let successorId: string | undefined;
      let inheritanceCreated = false;
      
      if (character.ownerId && inheritableAssets) {
        // 후계자 생성은 별도 API로 플레이어가 선택
        // 여기서는 상속 가능 자산만 저장
        await Gin7Character.updateOne(
          { sessionId, characterId },
          { 
            $set: { 
              'data.inheritableAssets': inheritableAssets,
              'data.inheritancePending': true,
            } 
          }
        );
        inheritanceCreated = true;
      }
      
      this.emit('death:processed', {
        sessionId,
        characterId,
        characterName: entry.characterName,
        deathType,
        description,
        inheritableAssets,
      });
      
      logger.info('[LifeCycleService] Death processed', {
        sessionId,
        characterId,
        deathType,
      });
      
      return {
        success: true,
        characterId,
        characterName: entry.characterName,
        deathType,
        inheritanceCreated,
        successorId,
      };
    } catch (error) {
      logger.error('[LifeCycleService] Death processing failed', { sessionId, characterId, error });
      
      return {
        success: false,
        characterId,
        characterName: entry.characterName,
        deathType,
        inheritanceCreated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 상속 가능 자산 계산
   */
  private calculateInheritableAssets(
    character: IGin7Character,
    entry: IRankLadderEntry
  ): InheritableAssets {
    // 재화 상속 (70%)
    const gold = Math.floor((character.resources?.gold || 0) * 0.7);
    
    // 아이템 상속 (장착 중인 것만)
    const items = (character.inventory || [])
      .filter(item => item.slotId !== 'storage')
      .map(item => ({ itemId: item.itemId, slotId: item.slotId }));
    
    // 특성 상속 (확률적)
    const inheritableTraits = ['noble_blood', 'military_family', 'genius'];
    const traits = (character.traits || [])
      .filter(trait => inheritableTraits.includes(trait))
      .filter(() => Math.random() < TRAIT_INHERITANCE_CHANCE);
    
    // 공적 보너스 (총 공적의 10%)
    const meritBonus = Math.floor(entry.totalMerit * MERIT_INHERITANCE_RATIO);
    
    // 명성 보너스 (계급에 따라)
    const rankDef = getRankDefinition(entry.rank as RankCode);
    const reputationBonus = rankDef.tier * 100;
    
    return {
      gold,
      items,
      traits,
      meritBonus,
      reputationBonus,
    };
  }
  
  // ==========================================================================
  // Successor Logic
  // ==========================================================================
  
  /**
   * 후계자 생성
   */
  async createSuccessor(params: {
    sessionId: string;
    deceasedCharacterId: string;
    successorName: string;
    ownerId: string;
  }): Promise<{
    success: boolean;
    successorId?: string;
    error?: string;
  }> {
    const { sessionId, deceasedCharacterId, successorName, ownerId } = params;
    
    // 사망한 캐릭터 조회
    const deceased = await Gin7Character.findOne({ 
      sessionId, 
      characterId: deceasedCharacterId,
      state: 'dead',
      'data.inheritancePending': true,
    });
    
    if (!deceased) {
      return { success: false, error: 'No inheritance pending for this character' };
    }
    
    const inheritableAssets = deceased.data?.inheritableAssets as InheritableAssets;
    if (!inheritableAssets) {
      return { success: false, error: 'No inheritable assets found' };
    }
    
    const entry = await RankLadder.findOne({ 
      sessionId, 
      characterId: deceasedCharacterId 
    });
    
    if (!entry) {
      return { success: false, error: 'Deceased entry not found' };
    }
    
    try {
      // 후계자 ID 생성
      const successorId = `${ownerId}_${Date.now()}`;
      
      // 부모 스탯 기반 초기 스탯 계산
      const parentStats = deceased.stats || {
        command: 50,
        might: 50,
        intellect: 50,
        politics: 50,
        charm: 50,
      };
      
      const successorStats = {
        command: this.inheritStat(parentStats.command),
        might: this.inheritStat(parentStats.might),
        intellect: this.inheritStat(parentStats.intellect),
        politics: this.inheritStat(parentStats.politics),
        charm: this.inheritStat(parentStats.charm),
      };
      
      // 현재 게임 시간 조회
      const timeEngine = TimeEngine.getInstance();
      const sessionInfo = timeEngine.getSessionInfo(sessionId);
      const currentYear = sessionInfo?.gameDate.year || 800;
      
      // 후계자 캐릭터 생성
      const successorCharacter = await Gin7Character.create({
        characterId: successorId,
        sessionId,
        ownerId,
        name: successorName,
        stats: successorStats,
        extendedStats: new Map(),
        location: deceased.location,
        state: 'idle',
        stateData: {},
        resources: {
          gold: inheritableAssets.gold,
          rice: 0,
        },
        inventory: inheritableAssets.items.map(item => ({
          itemId: item.itemId,
          slotId: item.slotId,
        })),
        traits: inheritableAssets.traits,
        skills: [],
        commandPoints: {
          pcp: 12,
          mcp: 12,
          maxPcp: 24,
          maxMcp: 24,
          lastRecoveredAt: new Date(),
        },
        commandCards: [],
        data: {
          birthDate: new Date(currentYear - 18, 0, 1), // 18세로 시작
          parentCharacterId: deceasedCharacterId,
          inheritedMeritBonus: inheritableAssets.meritBonus,
          inheritedReputationBonus: inheritableAssets.reputationBonus,
        },
      });
      
      // 라더에 등록 (초기 공적 = 상속 보너스)
      await this.ladderService.registerNewRecruit({
        sessionId,
        characterId: successorId,
        factionId: entry.factionId,
        characterName: successorName,
        enlistmentDate: new Date(),
        birthDate: new Date(currentYear - 18, 0, 1),
        initialRank: RankCode.PRIVATE_2ND,
      });
      
      // 상속 보너스 적용
      if (inheritableAssets.meritBonus > 0) {
        await this.ladderService.addMerit(sessionId, successorId, inheritableAssets.meritBonus);
      }
      
      // 상속 완료 표시
      await Gin7Character.updateOne(
        { sessionId, characterId: deceasedCharacterId },
        { 
          $set: { 
            'data.inheritancePending': false,
            'data.successorId': successorId,
          } 
        }
      );
      
      this.emit('successor:created', {
        sessionId,
        deceasedCharacterId,
        successorId,
        successorName,
        inheritedAssets: inheritableAssets,
      });
      
      logger.info('[LifeCycleService] Successor created', {
        sessionId,
        deceasedCharacterId,
        successorId,
        successorName,
      });
      
      return { success: true, successorId };
    } catch (error) {
      logger.error('[LifeCycleService] Successor creation failed', { 
        sessionId, deceasedCharacterId, error 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 스탯 상속 계산
   * 부모 스탯의 영향을 받되, 랜덤 요소 추가
   */
  private inheritStat(parentStat: number): number {
    // 기본값 50에서 시작
    const base = 50;
    
    // 부모 스탯 영향 (20%)
    const parentInfluence = (parentStat - 50) * STAT_INHERITANCE_RATIO;
    
    // 랜덤 변동 (-10 ~ +10)
    const randomVariation = (Math.random() - 0.5) * 20;
    
    // 최종 스탯 (1 ~ 100)
    return Math.max(1, Math.min(100, Math.round(base + parentInfluence + randomVariation)));
  }
  
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  
  /**
   * 상속 대기 중인 캐릭터 조회
   */
  async getPendingInheritances(
    sessionId: string,
    ownerId: string
  ): Promise<Array<{
    characterId: string;
    characterName: string;
    deathType: DeathType;
    inheritableAssets: InheritableAssets;
  }>> {
    const deceased = await Gin7Character.find({
      sessionId,
      ownerId,
      state: 'dead',
      'data.inheritancePending': true,
    });
    
    return deceased.map(char => ({
      characterId: char.characterId,
      characterName: char.name,
      deathType: char.data?.deathInfo?.type as DeathType,
      inheritableAssets: char.data?.inheritableAssets as InheritableAssets,
    }));
  }
  
  /**
   * 캐릭터 생애 정보 조회
   */
  async getLifeInfo(
    sessionId: string,
    characterId: string
  ): Promise<{
    age: number;
    state: string;
    serviceMonths: number;
    rank: RankCode;
    retirementInfo?: any;
    deathInfo?: any;
    parentInfo?: any;
  } | null> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    const entry = await RankLadder.findOne({ sessionId, characterId });
    
    if (!character) return null;
    
    const timeEngine = TimeEngine.getInstance();
    const sessionInfo = timeEngine.getSessionInfo(sessionId);
    const currentYear = sessionInfo?.gameDate.year || 800;
    const birthYear = (character.data?.birthDate as Date)?.getFullYear() || currentYear - 30;
    
    return {
      age: currentYear - birthYear,
      state: character.state,
      serviceMonths: entry?.serviceMonths || 0,
      rank: (entry?.rank as RankCode) || RankCode.PRIVATE_2ND,
      retirementInfo: character.data?.retirementInfo,
      deathInfo: character.data?.deathInfo,
      parentInfo: character.data?.parentCharacterId ? {
        parentId: character.data.parentCharacterId,
        inheritedMeritBonus: character.data.inheritedMeritBonus,
        inheritedReputationBonus: character.data.inheritedReputationBonus,
      } : undefined,
    };
  }
}

export default LifeCycleService;

