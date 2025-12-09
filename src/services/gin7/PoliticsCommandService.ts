/**
 * PoliticsCommandService - 정치 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 정치 커맨드:
 * - NIGHT_PARTY (야회): 영향력 변화
 * - HUNTING (수렵): 봉토에서 사냥, 영향력/우호도 변화
 * - CONFERENCE (회담): 호텔에서 회담, 영향력 변화
 * - TALK (담화): 호텔에서 담화, 우호도/영향력 변화
 * - SPEECH (연설): 광장에서 연설, 영향력/지지율 변화
 * - SET_NATIONAL_GOAL (국가목표): 국가 전략 목표 설정
 * - CHANGE_TAX_RATE (납입율변경): 세율 변경
 * - CHANGE_TARIFF (관세율변경): 관세율 변경
 * - BUDGET_ALLOCATION (분배): 예산 분배
 * - JUDGMENT (처단): 구금자 처단
 * - DIPLOMACY (외교): 페잔 외교
 * - SET_LOCAL_GOAL (통치목표): 행성별 목표 설정
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Faction } from '../../models/gin7/Faction';
import { GovernmentStructure, IGovernmentStructure, AuthorityType } from '../../models/gin7/GovernmentStructure';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';
import { BudgetService } from './BudgetService';
import { BudgetCategory } from '../../models/gin7/NationalTreasury';
import {
  NationalGoalType,
  INationalGoal,
  NATIONAL_GOAL_DEFINITIONS,
  IBudgetAllocationRatio,
  DEFAULT_BUDGET_ALLOCATION,
  ITaxPolicyData,
  ITariffPolicyData,
  TAX_RATE_LIMITS,
  PoliticsAuthorityType,
  POLITICS_AUTHORITY_MAP,
  IAuthorityCheckResult
} from '../../types/gin7/politics.types';

// ============================================================
// Types
// ============================================================

export interface PoliticsRequest {
  sessionId: string;
  characterId: string;     // 실행자
  commandId: string;       // 커맨드 ID
  targetId?: string;       // 대상 캐릭터 (회담/담화 등)
  planetId?: string;       // 대상 행성
  params?: Record<string, any>; // 추가 파라미터
}

export interface PoliticsResult {
  success: boolean;
  commandId: string;
  effects: {
    influenceChange?: number;
    friendshipChange?: number;
    supportChange?: number;
    taxRateChange?: number;
  };
  cpCost: number;
  error?: string;
}

// ============================================================
// PoliticsCommandService Class
// ============================================================

export class PoliticsCommandService extends EventEmitter {
  private static instance: PoliticsCommandService;

  private constructor() {
    super();
    logger.info('[PoliticsCommandService] Initialized');
  }

  public static getInstance(): PoliticsCommandService {
    if (!PoliticsCommandService.instance) {
      PoliticsCommandService.instance = new PoliticsCommandService();
    }
    return PoliticsCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 정치 커맨드 라우터
   */
  public async executePoliticsCommand(request: PoliticsRequest): Promise<PoliticsResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'NIGHT_PARTY':
        return this.executeNightParty(request);
      case 'HUNTING':
        return this.executeHunting(request);
      case 'CONFERENCE':
        return this.executeConference(request);
      case 'TALK':
        return this.executeTalk(request);
      case 'SPEECH':
        return this.executeSpeech(request);
      case 'SET_NATIONAL_GOAL':
        return this.executeSetNationalGoal(request);
      case 'CHANGE_TAX_RATE':
        return this.executeChangeTaxRate(request);
      case 'CHANGE_TARIFF':
        return this.executeChangeTariff(request);
      case 'BUDGET_ALLOCATION':
        return this.executeBudgetAllocation(request);
      case 'JUDGMENT':
        return this.executeJudgment(request);
      case 'DIPLOMACY':
        return this.executeDiplomacy(request);
      case 'SET_LOCAL_GOAL':
        return this.executeSetLocalGoal(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 정치 커맨드입니다.');
    }
  }

  // ============================================================
  // 사교 커맨드
  // ============================================================

  /**
   * 야회 (수도에서)
   */
  private async executeNightParty(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId } = request;
    const cpCost = this.getCommandCost('NIGHT_PARTY');

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('NIGHT_PARTY', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 매력 기반 영향력 증가
      const charmBonus = (character.stats?.charm || 50) / 100;
      const influenceGain = Math.floor(5 * (1 + charmBonus));

      // 영향력 업데이트 (캐릭터 데이터에 저장)
      const currentInfluence = character.data?.influence || 0;
      if (!character.data) character.data = {};
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('politics:nightParty', {
        sessionId,
        characterId,
        characterName: character.name,
        influenceGain,
      });

      return {
        success: true,
        commandId: 'NIGHT_PARTY',
        effects: { influenceChange: influenceGain },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Night party error:', error);
      return this.errorResult('NIGHT_PARTY', cpCost, '야회 처리 중 오류 발생');
    }
  }

  /**
   * 수렵 (봉토에서)
   */
  private async executeHunting(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('HUNTING');

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('HUNTING', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 영향력 및 우호도 증가
      const influenceGain = 3;
      let friendshipGain = 0;

      // 대상이 있으면 우호도도 증가
      if (targetId) {
        const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
        if (target) {
          friendshipGain = 5;
          // TODO: 우호도 시스템 구현 시 반영
        }
      }

      const currentInfluence = character.data?.influence || 0;
      if (!character.data) character.data = {};
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('politics:hunting', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        influenceGain,
        friendshipGain,
      });

      return {
        success: true,
        commandId: 'HUNTING',
        effects: { influenceChange: influenceGain, friendshipChange: friendshipGain },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Hunting error:', error);
      return this.errorResult('HUNTING', cpCost, '수렵 처리 중 오류 발생');
    }
  }

  /**
   * 회담 (호텔에서)
   */
  private async executeConference(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('CONFERENCE');

    if (!targetId) {
      return this.errorResult('CONFERENCE', cpCost, '회담 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      
      if (!character || !target) {
        return this.errorResult('CONFERENCE', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 정치력 기반 영향력 변화
      const politicsBonus = (character.stats?.politics || 50) / 100;
      const influenceGain = Math.floor(5 * politicsBonus);

      const currentInfluence = character.data?.influence || 0;
      if (!character.data) character.data = {};
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('politics:conference', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        targetName: target.name,
        influenceGain,
      });

      return {
        success: true,
        commandId: 'CONFERENCE',
        effects: { influenceChange: influenceGain },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Conference error:', error);
      return this.errorResult('CONFERENCE', cpCost, '회담 처리 중 오류 발생');
    }
  }

  /**
   * 담화 (호텔에서)
   */
  private async executeTalk(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('TALK');

    if (!targetId) {
      return this.errorResult('TALK', cpCost, '담화 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      
      if (!character || !target) {
        return this.errorResult('TALK', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 매력 기반 우호도/영향력 변화
      const charmBonus = (character.stats?.charm || 50) / 100;
      const friendshipGain = Math.floor(8 * charmBonus);
      const influenceGain = Math.floor(3 * charmBonus);

      const currentInfluence = character.data?.influence || 0;
      if (!character.data) character.data = {};
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('politics:talk', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        targetName: target.name,
        friendshipGain,
        influenceGain,
      });

      return {
        success: true,
        commandId: 'TALK',
        effects: { friendshipChange: friendshipGain, influenceChange: influenceGain },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Talk error:', error);
      return this.errorResult('TALK', cpCost, '담화 처리 중 오류 발생');
    }
  }

  /**
   * 연설 (광장에서)
   */
  private async executeSpeech(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, planetId } = request;
    const cpCost = this.getCommandCost('SPEECH');

    if (!planetId) {
      return this.errorResult('SPEECH', cpCost, '연설할 행성이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const planet = await Planet.findOne({ sessionId, planetId });
      
      if (!character) {
        return this.errorResult('SPEECH', cpCost, '캐릭터를 찾을 수 없습니다.');
      }
      if (!planet) {
        return this.errorResult('SPEECH', cpCost, '행성을 찾을 수 없습니다.');
      }

      // 매력 기반 지지율/영향력 변화
      const charmBonus = (character.stats?.charm || 50) / 100;
      const supportGain = Math.floor(10 * charmBonus);
      const influenceGain = Math.floor(5 * charmBonus);

      // 행성 지지율 업데이트
      planet.loyalty = Math.min(100, (planet.loyalty || 50) + supportGain);
      await planet.save();

      // 영향력 업데이트
      const currentInfluence = character.data?.influence || 0;
      if (!character.data) character.data = {};
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('politics:speech', {
        sessionId,
        characterId,
        characterName: character.name,
        planetId,
        planetName: planet.name,
        supportGain,
        influenceGain,
      });

      return {
        success: true,
        commandId: 'SPEECH',
        effects: { supportChange: supportGain, influenceChange: influenceGain },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Speech error:', error);
      return this.errorResult('SPEECH', cpCost, '연설 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 국정 커맨드
  // ============================================================

  /**
   * 국가 목표 설정
   * Faction 모델의 data.nationalGoal에 INationalGoal 구조로 저장
   * 권한: 황제/의장 또는 입법권자 (NATIONAL_GOAL 권한)
   */
  private async executeSetNationalGoal(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('SET_NATIONAL_GOAL');

    const goalType = params?.goal as NationalGoalType;
    if (!goalType) {
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, '목표가 필요합니다.');
    }

    // 유효한 목표 타입인지 확인
    if (!NATIONAL_GOAL_DEFINITIONS[goalType]) {
      const validGoals = Object.keys(NATIONAL_GOAL_DEFINITIONS).join(', ');
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, `유효하지 않은 국가 목표입니다. 유효한 목표: ${validGoals}`);
    }

    try {
      // 캐릭터의 소속 세력 조회
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const factionId = character.factionId || character.faction;
      if (!factionId) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, '소속 세력이 없습니다.');
      }

      // 권한 검증 (황제/의장 또는 입법권자)
      const authorityCheck = await this.checkPoliticsAuthority(
        sessionId, 
        factionId, 
        characterId, 
        'NATIONAL_GOAL'
      );
      if (!authorityCheck.hasAuthority) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, authorityCheck.reason || '국가 목표 설정 권한이 없습니다.');
      }

      // Faction 모델에 국가 목표 저장
      const faction = await Faction.findOne({ sessionId, factionId });
      if (!faction) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, '세력을 찾을 수 없습니다.');
      }

      // 기존 목표 백업
      if (!faction.data) faction.data = {};
      const oldGoal = faction.data.nationalGoal as INationalGoal | undefined;

      // INationalGoal 구조로 저장
      const goalDefinition = NATIONAL_GOAL_DEFINITIONS[goalType];
      const newGoal: INationalGoal = {
        type: goalType,
        priority: params?.priority || 1,
        description: goalDefinition.description,
        bonuses: { ...goalDefinition.bonuses },
        setBy: characterId,
        setAt: new Date(),
        isActive: true,
        expiresAt: params?.durationDays 
          ? new Date(Date.now() + params.durationDays * 24 * 60 * 60 * 1000)
          : undefined
      };

      faction.data.nationalGoal = newGoal;
      faction.markModified('data');
      await faction.save();

      this.emit('politics:nationalGoalSet', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        factionName: faction.name,
        oldGoal: oldGoal?.type,
        newGoal: goalType,
        bonuses: newGoal.bonuses,
        authorizedBy: authorityCheck.position,
      });

      logger.info(`[PoliticsCommandService] National goal set for ${factionId}: ${goalType} (by ${authorityCheck.position})`);

      return {
        success: true,
        commandId: 'SET_NATIONAL_GOAL',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Set national goal error:', error);
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, '국가 목표 설정 중 오류 발생');
    }
  }

  /**
   * 세율 변경
   * 권한: 황제/의장 또는 재정권자 (TAX_CHANGE 권한)
   * 
   * 행성별 세율 변경 또는 국가 전체 세율 정책 변경
   * - planetId가 있으면: 해당 행성의 세율만 변경
   * - planetId가 없으면: 국가 전체 세율 정책 변경 (Faction.data.taxPolicy에 저장)
   */
  private async executeChangeTaxRate(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, planetId, params } = request;
    const cpCost = this.getCommandCost('CHANGE_TAX_RATE');

    const newRate = params?.taxRate;
    if (newRate === undefined || newRate < TAX_RATE_LIMITS.MIN_TAX_RATE || newRate > TAX_RATE_LIMITS.MAX_TAX_RATE) {
      return this.errorResult('CHANGE_TAX_RATE', cpCost, `유효한 세율(${TAX_RATE_LIMITS.MIN_TAX_RATE}-${TAX_RATE_LIMITS.MAX_TAX_RATE})이 필요합니다.`);
    }

    try {
      // 캐릭터의 소속 세력 조회
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('CHANGE_TAX_RATE', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const factionId = character.factionId || character.faction;
      if (!factionId) {
        return this.errorResult('CHANGE_TAX_RATE', cpCost, '소속 세력이 없습니다.');
      }

      // 권한 검증 (황제/의장 또는 재정권자)
      const authorityCheck = await this.checkPoliticsAuthority(
        sessionId,
        factionId,
        characterId,
        'TAX_CHANGE'
      );
      if (!authorityCheck.hasAuthority) {
        return this.errorResult('CHANGE_TAX_RATE', cpCost, authorityCheck.reason || '세율 변경 권한이 없습니다.');
      }

      let oldRate: number = 10;
      let loyaltyImpact = 0;

      if (planetId) {
        // 행성별 세율 변경
        const planet = await Planet.findOne({ sessionId, planetId });
        if (!planet) {
          return this.errorResult('CHANGE_TAX_RATE', cpCost, '행성을 찾을 수 없습니다.');
        }
        
        if (!planet.data) planet.data = {};
        oldRate = planet.data.taxRate || 10;
        planet.data.taxRate = newRate;
        
        // 세율 변경에 따른 지지율 영향 계산
        loyaltyImpact = this.calculateTaxLoyaltyImpact(oldRate, newRate);
        if (loyaltyImpact !== 0) {
          planet.loyalty = Math.max(0, Math.min(100, (planet.loyalty || 50) + loyaltyImpact));
        }
        
        planet.markModified('data');
        await planet.save();

        this.emit('politics:taxRateChanged', {
          sessionId,
          characterId,
          characterName: character.name,
          planetId,
          planetName: planet.name,
          oldRate,
          newRate,
          loyaltyImpact,
          authorizedBy: authorityCheck.position,
        });
      } else {
        // 국가 전체 세율 정책 변경
        const faction = await Faction.findOne({ sessionId, factionId });
        if (!faction) {
          return this.errorResult('CHANGE_TAX_RATE', cpCost, '세력을 찾을 수 없습니다.');
        }

        if (!faction.data) faction.data = {};
        const existingPolicy = faction.data.taxPolicy as ITaxPolicyData | undefined;
        oldRate = existingPolicy?.baseTaxRate || 10;

        // ITaxPolicyData 구조로 저장
        const newTaxPolicy: ITaxPolicyData = {
          baseTaxRate: newRate,
          warTaxRate: params?.warTaxRate ?? existingPolicy?.warTaxRate ?? 0,
          luxuryTaxRate: params?.luxuryTaxRate ?? existingPolicy?.luxuryTaxRate ?? 5,
          isEmergencyTax: params?.isEmergencyTax ?? existingPolicy?.isEmergencyTax ?? false,
          changedBy: characterId,
          changedAt: new Date()
        };

        faction.data.taxPolicy = newTaxPolicy;
        faction.markModified('data');
        await faction.save();

        // BudgetService를 통해 NationalTreasury의 세율도 업데이트
        const normalizedRate = newRate / 100; // 0-100을 0-1로 변환
        await BudgetService.setTaxRate(sessionId, factionId, 'base', Math.min(normalizedRate, 0.5));

        this.emit('politics:taxPolicyChanged', {
          sessionId,
          characterId,
          characterName: character.name,
          factionId,
          factionName: faction.name,
          oldRate,
          newRate,
          policy: newTaxPolicy,
          authorizedBy: authorityCheck.position,
        });
      }

      logger.info(`[PoliticsCommandService] Tax rate changed: ${oldRate}% -> ${newRate}% by ${authorityCheck.position}`);

      return {
        success: true,
        commandId: 'CHANGE_TAX_RATE',
        effects: { taxRateChange: newRate - oldRate },
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Change tax rate error:', error);
      return this.errorResult('CHANGE_TAX_RATE', cpCost, '세율 변경 중 오류 발생');
    }
  }

  /**
   * 세율 변경에 따른 지지율 영향 계산
   */
  private calculateTaxLoyaltyImpact(oldRate: number, newRate: number): number {
    const diff = newRate - oldRate;
    if (diff === 0) return 0;
    
    // 세율 인상 시 지지율 하락, 인하 시 상승
    if (diff > 0) {
      // 인상: 10% 인상마다 지지율 -3
      return -Math.floor(diff / 10) * 3;
    } else {
      // 인하: 10% 인하마다 지지율 +2
      return -Math.floor(diff / 10) * 2;
    }
  }

  /**
   * 관세율 변경
   * Faction 모델의 data.tariffPolicy에 ITariffPolicyData 구조로 저장
   * BudgetService를 통해 NationalTreasury에도 반영
   * 권한: 황제/의장, 재정권자 또는 외교권자 (TARIFF_CHANGE 권한)
   */
  private async executeChangeTariff(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('CHANGE_TARIFF');

    const newRate = params?.tariffRate;
    if (newRate === undefined || newRate < TAX_RATE_LIMITS.MIN_TARIFF_RATE || newRate > TAX_RATE_LIMITS.MAX_TARIFF_RATE) {
      return this.errorResult('CHANGE_TARIFF', cpCost, `유효한 관세율(${TAX_RATE_LIMITS.MIN_TARIFF_RATE}-${TAX_RATE_LIMITS.MAX_TARIFF_RATE})이 필요합니다.`);
    }

    try {
      // 캐릭터의 소속 세력 조회
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('CHANGE_TARIFF', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const factionId = character.factionId || character.faction;
      if (!factionId) {
        return this.errorResult('CHANGE_TARIFF', cpCost, '소속 세력이 없습니다.');
      }

      // 권한 검증 (황제/의장, 재정권자 또는 외교권자)
      const authorityCheck = await this.checkPoliticsAuthority(
        sessionId,
        factionId,
        characterId,
        'TARIFF_CHANGE'
      );
      if (!authorityCheck.hasAuthority) {
        return this.errorResult('CHANGE_TARIFF', cpCost, authorityCheck.reason || '관세율 변경 권한이 없습니다.');
      }

      // Faction 모델에 관세율 저장
      const faction = await Faction.findOne({ sessionId, factionId });
      if (!faction) {
        return this.errorResult('CHANGE_TARIFF', cpCost, '세력을 찾을 수 없습니다.');
      }

      if (!faction.data) faction.data = {};
      const existingPolicy = faction.data.tariffPolicy as ITariffPolicyData | undefined;
      const oldRate = existingPolicy?.tariffRate || 5; // 기본 관세율 5%

      // ITariffPolicyData 구조로 저장
      const newTariffPolicy: ITariffPolicyData = {
        tariffRate: newRate,
        changedBy: characterId,
        changedAt: new Date()
      };

      faction.data.tariffPolicy = newTariffPolicy;
      faction.markModified('data');
      await faction.save();

      // BudgetService를 통해 NationalTreasury의 tradeTaxRate도 업데이트
      // newRate는 0-100 범위이고 BudgetService는 0-0.15 (0-15%) 범위를 사용하므로 변환
      const normalizedRate = Math.min(newRate / 100, 0.15);
      const budgetResult = await BudgetService.setTaxRate(sessionId, factionId, 'trade', normalizedRate);
      if (!budgetResult.success) {
        logger.warn(`[PoliticsCommandService] Failed to update trade tax rate in treasury: ${budgetResult.error}`);
      }

      // 관세율 변경에 따른 무역 영향 계산
      const tradeImpact = this.calculateTariffTradeImpact(oldRate, newRate);

      this.emit('politics:tariffChanged', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        factionName: faction.name,
        oldRate,
        newRate,
        tradeImpact,
        authorizedBy: authorityCheck.position,
      });

      logger.info(`[PoliticsCommandService] Tariff rate changed for ${factionId}: ${oldRate}% -> ${newRate}% by ${authorityCheck.position}`);

      return {
        success: true,
        commandId: 'CHANGE_TARIFF',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Change tariff error:', error);
      return this.errorResult('CHANGE_TARIFF', cpCost, '관세율 변경 중 오류 발생');
    }
  }

  /**
   * 관세율 변경에 따른 무역 영향 계산
   */
  private calculateTariffTradeImpact(oldRate: number, newRate: number): number {
    const diff = newRate - oldRate;
    // 관세율 인상 시 무역량 감소, 인하 시 증가
    return -diff * 0.5; // 관세율 1% 변경당 무역량 0.5% 변화
  }

  /**
   * 예산 분배
   * BudgetService.allocateBudget을 통해 NationalTreasury에 예산 배분 반영
   * 권한: 황제/의장 또는 재정권자 (BUDGET_ALLOCATION 권한)
   * 
   * params.allocation은 두 가지 형식 지원:
   * 1. 비율 형식: { defense: 30, administration: 20, ... } (합계 100%)
   * 2. 금액 형식: { defense: 30000, administration: 20000, ... } (실제 금액)
   */
  private async executeBudgetAllocation(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('BUDGET_ALLOCATION');

    const allocation = params?.allocation;
    if (!allocation) {
      return this.errorResult('BUDGET_ALLOCATION', cpCost, '예산 배분이 필요합니다.');
    }

    try {
      // 캐릭터의 소속 세력 조회
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('BUDGET_ALLOCATION', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const factionId = character.factionId || character.faction;
      if (!factionId) {
        return this.errorResult('BUDGET_ALLOCATION', cpCost, '소속 세력이 없습니다.');
      }

      // 권한 검증 (황제/의장 또는 재정권자)
      const authorityCheck = await this.checkPoliticsAuthority(
        sessionId,
        factionId,
        characterId,
        'BUDGET_ALLOCATION'
      );
      if (!authorityCheck.hasAuthority) {
        return this.errorResult('BUDGET_ALLOCATION', cpCost, authorityCheck.reason || '예산 배분 권한이 없습니다.');
      }

      // 비율 형식인지 금액 형식인지 판단 (값의 합계로 판단)
      const values = Object.values(allocation).filter(v => typeof v === 'number') as number[];
      const total = values.reduce((sum, v) => sum + v, 0);
      const isRatioFormat = total <= 101; // 비율 합계가 ~100%

      let budgetAllocations: Array<{ category: BudgetCategory; amount: number; priority?: number }> = [];

      const categoryMapping: Record<string, BudgetCategory> = {
        defense: 'defense' as BudgetCategory,
        military: 'defense' as BudgetCategory,
        administration: 'administration' as BudgetCategory,
        construction: 'construction' as BudgetCategory,
        research: 'research' as BudgetCategory,
        welfare: 'welfare' as BudgetCategory,
        intelligence: 'intelligence' as BudgetCategory,
        security: 'intelligence' as BudgetCategory,
        diplomacy: 'diplomacy' as BudgetCategory,
        reserve: 'reserve' as BudgetCategory,
      };

      if (isRatioFormat) {
        // 비율 형식: 합계 100% 검증
        const ratioAllocation: Partial<IBudgetAllocationRatio> = {};
        for (const [key, value] of Object.entries(allocation)) {
          const normalizedKey = key.toLowerCase();
          if (categoryMapping[normalizedKey] && typeof value === 'number') {
            const category = categoryMapping[normalizedKey];
            ratioAllocation[category as keyof IBudgetAllocationRatio] = value;
          }
        }

        const validation = this.validateBudgetAllocation(ratioAllocation);
        if (!validation.valid) {
          return this.errorResult('BUDGET_ALLOCATION', cpCost, validation.error || '예산 비율 검증 실패');
        }

        // 국고 잔액 조회하여 비율을 금액으로 변환
        const treasury = await BudgetService.getTreasury(sessionId, factionId);
        const availableFunds = treasury ? treasury.balance - treasury.frozenFunds : 100000;

        for (const [category, ratio] of Object.entries(validation.normalized!)) {
          const amount = Math.floor(availableFunds * (ratio / 100));
          budgetAllocations.push({ category: category as BudgetCategory, amount });
        }
      } else {
        // 금액 형식: 직접 변환
        for (const [key, amount] of Object.entries(allocation)) {
          const category = categoryMapping[key.toLowerCase()];
          if (category && typeof amount === 'number') {
            budgetAllocations.push({ category, amount });
          }
        }
      }

      if (budgetAllocations.length === 0) {
        return this.errorResult('BUDGET_ALLOCATION', cpCost, '유효한 예산 카테고리가 없습니다.');
      }

      // BudgetService를 통해 예산 배분
      const result = await BudgetService.allocateBudget(sessionId, factionId, budgetAllocations);
      if (!result.success) {
        return this.errorResult('BUDGET_ALLOCATION', cpCost, result.error || '예산 배분 실패');
      }

      // Faction 모델에도 최근 예산 배분 기록 (IBudgetAllocationData 구조)
      const faction = await Faction.findOne({ sessionId, factionId });
      if (faction) {
        if (!faction.data) faction.data = {};
        faction.data.budgetAllocation = {
          allocation: isRatioFormat ? allocation : this.convertToRatio(budgetAllocations),
          allocatedBy: characterId,
          allocatedAt: new Date(),
          totalBudget: budgetAllocations.reduce((sum, a) => sum + a.amount, 0)
        };
        faction.markModified('data');
        await faction.save();
      }

      this.emit('politics:budgetAllocated', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        allocation,
        authorizedBy: authorityCheck.position,
      });

      logger.info(`[PoliticsCommandService] Budget allocated for ${factionId} by ${authorityCheck.position}:`, allocation);

      return {
        success: true,
        commandId: 'BUDGET_ALLOCATION',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Budget allocation error:', error);
      return this.errorResult('BUDGET_ALLOCATION', cpCost, '예산 분배 중 오류 발생');
    }
  }

  /**
   * 금액 배열을 비율로 변환
   */
  private convertToRatio(allocations: Array<{ category: BudgetCategory; amount: number }>): IBudgetAllocationRatio {
    const total = allocations.reduce((sum, a) => sum + a.amount, 0) || 1;
    const result: IBudgetAllocationRatio = { ...DEFAULT_BUDGET_ALLOCATION };
    
    for (const alloc of allocations) {
      result[alloc.category as keyof IBudgetAllocationRatio] = Math.round((alloc.amount / total) * 100);
    }
    
    return result;
  }

  /**
   * 처단 (구금자)
   */
  private async executeJudgment(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('JUDGMENT');

    if (!targetId) {
      return this.errorResult('JUDGMENT', cpCost, '처단 대상이 필요합니다.');
    }

    const judgmentType = params?.type || 'execution'; // execution, exile, pardon

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('JUDGMENT', cpCost, '대상을 찾을 수 없습니다.');
      }

      // 구금 상태 확인
      if (target.status !== 'DETAINED') {
        return this.errorResult('JUDGMENT', cpCost, '구금 상태인 캐릭터만 처단할 수 있습니다.');
      }

      switch (judgmentType) {
        case 'execution':
          target.status = 'DEAD';
          break;
        case 'exile':
          target.status = 'MISSING'; // EXILED는 없으므로 MISSING으로 대체
          break;
        case 'pardon':
          target.status = 'ACTIVE';
          break;
      }
      await target.save();

      this.emit('politics:judgment', {
        sessionId,
        characterId,
        targetId,
        targetName: target.name,
        judgmentType,
      });

      return {
        success: true,
        commandId: 'JUDGMENT',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Judgment error:', error);
      return this.errorResult('JUDGMENT', cpCost, '처단 처리 중 오류 발생');
    }
  }

  /**
   * 외교 (페잔)
   */
  private async executeDiplomacy(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('DIPLOMACY');

    const action = params?.action; // negotiate, trade, alliance 등

    try {
      // TODO: 페잔 외교 로직 (FezzanService 연동)
      this.emit('politics:diplomacy', {
        sessionId,
        characterId,
        action,
      });

      return {
        success: true,
        commandId: 'DIPLOMACY',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Diplomacy error:', error);
      return this.errorResult('DIPLOMACY', cpCost, '외교 처리 중 오류 발생');
    }
  }

  /**
   * 통치 목표 설정 (행성별)
   */
  private async executeSetLocalGoal(request: PoliticsRequest): Promise<PoliticsResult> {
    const { sessionId, characterId, planetId, params } = request;
    const cpCost = this.getCommandCost('SET_LOCAL_GOAL');

    if (!planetId) {
      return this.errorResult('SET_LOCAL_GOAL', cpCost, '행성이 필요합니다.');
    }

    const goal = params?.goal;
    if (!goal) {
      return this.errorResult('SET_LOCAL_GOAL', cpCost, '목표가 필요합니다.');
    }

    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return this.errorResult('SET_LOCAL_GOAL', cpCost, '행성을 찾을 수 없습니다.');
      }

      if (!planet.data) planet.data = {};
      planet.data.localGoal = goal;
      await planet.save();

      this.emit('politics:localGoalSet', {
        sessionId,
        characterId,
        planetId,
        planetName: planet.name,
        goal,
      });

      return {
        success: true,
        commandId: 'SET_LOCAL_GOAL',
        effects: {},
        cpCost,
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Set local goal error:', error);
      return this.errorResult('SET_LOCAL_GOAL', cpCost, '통치 목표 설정 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 320;
  }

  private errorResult(commandId: string, cpCost: number, error: string): PoliticsResult {
    return {
      success: false,
      commandId,
      effects: {},
      cpCost,
      error,
    };
  }

  // ============================================================
  // 권한 검증 헬퍼
  // ============================================================

  /**
   * 정치 커맨드 권한 검증
   * GovernmentStructure 기반으로 캐릭터의 권한을 확인
   * 
   * @param sessionId 세션 ID
   * @param factionId 세력 ID
   * @param characterId 캐릭터 ID
   * @param authorityType 필요한 권한 타입
   * @returns 권한 검증 결과
   */
  private async checkPoliticsAuthority(
    sessionId: string,
    factionId: string,
    characterId: string,
    authorityType: PoliticsAuthorityType
  ): Promise<IAuthorityCheckResult> {
    try {
      // 1. 정부 구조 조회
      const government = await GovernmentStructure.findOne({ sessionId, factionId });
      
      if (!government) {
        // 정부 구조가 없으면 세력 리더인지 확인
        const faction = await Faction.findOne({ sessionId, factionId });
        if (faction && faction.leaderId === characterId) {
          return { hasAuthority: true, position: 'faction_leader' };
        }
        return { hasAuthority: false, reason: '정부 구조가 없습니다.' };
      }

      // 2. 필요한 권한 목록 조회
      const requiredAuthorities = POLITICS_AUTHORITY_MAP[authorityType];

      // 3. 캐릭터가 해당 권한을 가진 직책을 보유하는지 확인
      for (const authority of requiredAuthorities) {
        if (government.hasAuthority(characterId, authority as AuthorityType)) {
          // 어떤 직책에서 권한을 얻었는지 찾기
          const position = government.positions.find(
            p => p.holderId === characterId && 
                 (p.authorities.includes('all') || p.authorities.includes(authority as AuthorityType))
          );
          return { 
            hasAuthority: true, 
            position: position?.positionName || authority 
          };
        }
      }

      // 4. 최고 권력자(황제/의장)인지 확인
      const topPositions = ['emperor', 'council_chair'];
      const isTopLeader = government.positions.some(
        p => p.holderId === characterId && topPositions.includes(p.positionType)
      );
      
      if (isTopLeader) {
        return { hasAuthority: true, position: '최고 권력자' };
      }

      return { 
        hasAuthority: false, 
        reason: `${authorityType} 권한이 없습니다. 필요한 권한: ${requiredAuthorities.join(', ')}` 
      };
    } catch (error) {
      logger.error('[PoliticsCommandService] Authority check error:', error);
      return { hasAuthority: false, reason: '권한 확인 중 오류 발생' };
    }
  }

  /**
   * 예산 배분 비율 검증
   * 합계가 100%인지 확인하고, 각 항목이 유효한 범위인지 검증
   */
  private validateBudgetAllocation(allocation: Partial<IBudgetAllocationRatio>): { 
    valid: boolean; 
    error?: string;
    normalized?: IBudgetAllocationRatio;
  } {
    // 기본값으로 채우기
    const normalized: IBudgetAllocationRatio = {
      defense: allocation.defense ?? DEFAULT_BUDGET_ALLOCATION.defense,
      administration: allocation.administration ?? DEFAULT_BUDGET_ALLOCATION.administration,
      construction: allocation.construction ?? DEFAULT_BUDGET_ALLOCATION.construction,
      research: allocation.research ?? DEFAULT_BUDGET_ALLOCATION.research,
      welfare: allocation.welfare ?? DEFAULT_BUDGET_ALLOCATION.welfare,
      intelligence: allocation.intelligence ?? DEFAULT_BUDGET_ALLOCATION.intelligence,
      diplomacy: allocation.diplomacy ?? DEFAULT_BUDGET_ALLOCATION.diplomacy,
      reserve: allocation.reserve ?? DEFAULT_BUDGET_ALLOCATION.reserve
    };

    // 각 항목이 0-100 범위인지 확인
    for (const [key, value] of Object.entries(normalized)) {
      if (value < 0 || value > 100) {
        return { valid: false, error: `${key} 예산 비율이 유효하지 않습니다. (0-100%)` };
      }
    }

    // 합계가 100%인지 확인
    const total = Object.values(normalized).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      return { valid: false, error: `예산 배분 합계가 100%가 아닙니다. (현재: ${total.toFixed(1)}%)` };
    }

    return { valid: true, normalized };
  }
}

export const politicsCommandService = PoliticsCommandService.getInstance();
export default PoliticsCommandService;

