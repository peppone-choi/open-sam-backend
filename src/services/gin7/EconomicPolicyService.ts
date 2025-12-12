/**
 * EconomicPolicyService - 경제 정책 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 경제 정책 커맨드:
 * - CHANGE_TAX_RATE (納入率変更): 납입율/세율 변경
 * - CHANGE_TARIFF_RATE (関税率変更): 관세율 변경
 * - ALLOCATE_BUDGET (分配): 예산 분배 (군사/기반/복지/연구)
 * - SET_NATIONAL_GOAL (国家目標): 국가 목표 설정
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface EconomicPolicyRequest {
  sessionId: string;
  characterId: string;     // 실행자
  commandId: string;       // 커맨드 ID
  planetId?: string;       // 대상 행성 (세율 변경 시)
  nationId?: string;       // 대상 국가
  params?: Record<string, any>; // 추가 파라미터
}

export interface EconomicPolicyResult {
  success: boolean;
  commandId: string;
  effects: {
    taxRateChange?: number;
    tariffRateChange?: number;
    budgetAllocation?: BudgetAllocation;
    nationalGoal?: NationalGoal;
  };
  cpCost: number;
  message?: string;
  error?: string;
}

export interface BudgetAllocation {
  military: number;    // 군사 예산 비율 (%)
  infrastructure: number; // 기반시설 예산 비율 (%)
  welfare: number;     // 복지 예산 비율 (%)
  research: number;    // 연구 예산 비율 (%)
}

export type NationalGoalType = 
  | 'MILITARY_EXPANSION'    // 군사 확장
  | 'ECONOMIC_GROWTH'       // 경제 성장
  | 'TERRITORIAL_DEFENSE'   // 영토 방어
  | 'TECHNOLOGICAL_ADVANCE' // 기술 발전
  | 'DIPLOMATIC_INFLUENCE'  // 외교적 영향력
  | 'INTERNAL_STABILITY';   // 내부 안정

export interface NationalGoal {
  type: NationalGoalType;
  priority: number;        // 1-5 우선순위
  description: string;
  bonuses: {
    military?: number;
    economy?: number;
    technology?: number;
    diplomacy?: number;
    stability?: number;
  };
}

export interface TaxHistory {
  timestamp: Date;
  oldRate: number;
  newRate: number;
  changedBy: string;
  planetId?: string;
}

// ============================================================
// EconomicPolicyService Class
// ============================================================

export class EconomicPolicyService extends EventEmitter {
  private static instance: EconomicPolicyService;

  // 세율 범위 제한
  private readonly MIN_TAX_RATE = 0;
  private readonly MAX_TAX_RATE = 100;
  private readonly MIN_TARIFF_RATE = 0;
  private readonly MAX_TARIFF_RATE = 100;

  private constructor() {
    super();
    logger.info('[EconomicPolicyService] Initialized');
  }

  public static getInstance(): EconomicPolicyService {
    if (!EconomicPolicyService.instance) {
      EconomicPolicyService.instance = new EconomicPolicyService();
    }
    return EconomicPolicyService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 경제 정책 커맨드 라우터
   */
  public async executeEconomicPolicy(request: EconomicPolicyRequest): Promise<EconomicPolicyResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'CHANGE_TAX_RATE':
        return this.changeTaxRate(request);
      case 'CHANGE_TARIFF_RATE':
        return this.changeTariffRate(request);
      case 'ALLOCATE_BUDGET':
        return this.allocateBudget(request);
      case 'SET_NATIONAL_GOAL':
        return this.setNationalGoal(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 경제 정책 커맨드입니다.');
    }
  }

  // ============================================================
  // 경제 정책 커맨드 구현
  // ============================================================

  /**
   * 납입율 변경 (納入率変更) - 세율 변경
   * 행성별 또는 전체 세율을 조정
   * CP: 320
   */
  public async changeTaxRate(request: EconomicPolicyRequest): Promise<EconomicPolicyResult> {
    const { sessionId, characterId, planetId, params } = request;
    const cpCost = this.getCommandCost('CHANGE_TAX_RATE');

    const newRate = params?.taxRate;
    if (newRate === undefined) {
      return this.errorResult('CHANGE_TAX_RATE', cpCost, '새 세율이 필요합니다.');
    }

    if (newRate < this.MIN_TAX_RATE || newRate > this.MAX_TAX_RATE) {
      return this.errorResult('CHANGE_TAX_RATE', cpCost, `세율은 ${this.MIN_TAX_RATE}~${this.MAX_TAX_RATE}% 범위여야 합니다.`);
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('CHANGE_TAX_RATE', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 권한 체크 (재정 관련 직책 보유 여부)
      const hasAuthority = await this.checkEconomicAuthority(character, 'TAX_CHANGE');
      if (!hasAuthority) {
        return this.errorResult('CHANGE_TAX_RATE', cpCost, '세율 변경 권한이 없습니다.');
      }

      let oldRate: number;
      let affectedPlanets: string[] = [];

      if (planetId) {
        // 특정 행성 세율 변경
        const planet = await Planet.findOne({ sessionId, planetId });
        if (!planet) {
          return this.errorResult('CHANGE_TAX_RATE', cpCost, '행성을 찾을 수 없습니다.');
        }

        if (!planet.data) planet.data = {};
        oldRate = planet.data.taxRate ?? 10;
        planet.data.taxRate = newRate;
        await planet.save();
        affectedPlanets.push(planet.name);

        // 세율 변경에 따른 지지율 영향
        const loyaltyImpact = this.calculateTaxLoyaltyImpact(oldRate, newRate);
        if (loyaltyImpact !== 0) {
          planet.loyalty = Math.max(0, Math.min(100, (planet.loyalty || 50) + loyaltyImpact));
          await planet.save();
        }
      } else {
        // 전체 국가 세율 변경 (해당 국가 소속 전 행성)
        const factionId = character.factionId;
        const planets = await Planet.find({ sessionId, factionId });
        
        if (planets.length === 0) {
          return this.errorResult('CHANGE_TAX_RATE', cpCost, '변경할 행성이 없습니다.');
        }

        oldRate = planets[0]?.data?.taxRate ?? 10;

        for (const planet of planets) {
          if (!planet.data) planet.data = {};
          planet.data.taxRate = newRate;
          
          // 지지율 영향
          const loyaltyImpact = this.calculateTaxLoyaltyImpact(planet.data.taxRate ?? 10, newRate);
          if (loyaltyImpact !== 0) {
            planet.loyalty = Math.max(0, Math.min(100, (planet.loyalty || 50) + loyaltyImpact));
          }
          
          await planet.save();
          affectedPlanets.push(planet.name);
        }
      }

      // 이력 기록
      const taxHistory: TaxHistory = {
        timestamp: new Date(),
        oldRate,
        newRate,
        changedBy: characterId,
        planetId,
      };

      this.emit('economic:taxRateChanged', {
        sessionId,
        characterId,
        characterName: character.name,
        oldRate,
        newRate,
        planetId,
        affectedPlanets,
        history: taxHistory,
        timestamp: new Date(),
      });

      logger.info(`[EconomicPolicyService] Tax rate changed: ${oldRate}% -> ${newRate}% by ${character.name}`);

      return {
        success: true,
        commandId: 'CHANGE_TAX_RATE',
        effects: {
          taxRateChange: newRate - oldRate,
        },
        cpCost,
        message: planetId
          ? `행성 세율을 ${oldRate}%에서 ${newRate}%로 변경했습니다.`
          : `전체 세율을 ${oldRate}%에서 ${newRate}%로 변경했습니다. (${affectedPlanets.length}개 행성 적용)`,
      };
    } catch (error) {
      logger.error('[EconomicPolicyService] Change tax rate error:', error);
      return this.errorResult('CHANGE_TAX_RATE', cpCost, '세율 변경 중 오류 발생');
    }
  }

  /**
   * 관세율 변경 (関税率変更)
   * 무역 관세율 조정 (주로 페잔 교역 관련)
   * CP: 320
   */
  public async changeTariffRate(request: EconomicPolicyRequest): Promise<EconomicPolicyResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('CHANGE_TARIFF');

    const newRate = params?.tariffRate;
    if (newRate === undefined) {
      return this.errorResult('CHANGE_TARIFF_RATE', cpCost, '새 관세율이 필요합니다.');
    }

    if (newRate < this.MIN_TARIFF_RATE || newRate > this.MAX_TARIFF_RATE) {
      return this.errorResult('CHANGE_TARIFF_RATE', cpCost, `관세율은 ${this.MIN_TARIFF_RATE}~${this.MAX_TARIFF_RATE}% 범위여야 합니다.`);
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('CHANGE_TARIFF_RATE', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkEconomicAuthority(character, 'TARIFF_CHANGE');
      if (!hasAuthority) {
        return this.errorResult('CHANGE_TARIFF_RATE', cpCost, '관세율 변경 권한이 없습니다.');
      }

      const factionId = character.factionId;
      
      // 국가 관세율 데이터 업데이트 (NationState 모델 필요)
      // TODO: NationState 모델 연동
      const oldRate = params?.currentTariffRate ?? 10;

      // 관세율 변경에 따른 효과
      const tradeImpact = this.calculateTariffTradeImpact(oldRate, newRate);

      this.emit('economic:tariffRateChanged', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        oldRate,
        newRate,
        tradeImpact,
        timestamp: new Date(),
      });

      logger.info(`[EconomicPolicyService] Tariff rate changed: ${oldRate}% -> ${newRate}% by ${character.name}`);

      return {
        success: true,
        commandId: 'CHANGE_TARIFF_RATE',
        effects: {
          tariffRateChange: newRate - oldRate,
        },
        cpCost,
        message: `관세율을 ${oldRate}%에서 ${newRate}%로 변경했습니다. 무역 영향: ${tradeImpact > 0 ? '+' : ''}${tradeImpact}%`,
      };
    } catch (error) {
      logger.error('[EconomicPolicyService] Change tariff rate error:', error);
      return this.errorResult('CHANGE_TARIFF_RATE', cpCost, '관세율 변경 중 오류 발생');
    }
  }

  /**
   * 예산 분배 (分配)
   * 국가 예산을 군사/기반/복지/연구로 분배
   * CP: 320
   */
  public async allocateBudget(request: EconomicPolicyRequest): Promise<EconomicPolicyResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('BUDGET_ALLOCATION');

    const allocation = params?.allocation as BudgetAllocation;
    if (!allocation) {
      return this.errorResult('ALLOCATE_BUDGET', cpCost, '예산 배분 정보가 필요합니다.');
    }

    // 비율 합계 검증 (100%여야 함)
    const total = allocation.military + allocation.infrastructure + allocation.welfare + allocation.research;
    if (Math.abs(total - 100) > 0.01) {
      return this.errorResult('ALLOCATE_BUDGET', cpCost, `예산 배분 합계가 100%가 아닙니다. (현재: ${total}%)`);
    }

    // 각 항목 범위 검증 (0-100)
    for (const [key, value] of Object.entries(allocation)) {
      if (value < 0 || value > 100) {
        return this.errorResult('ALLOCATE_BUDGET', cpCost, `${key} 예산 비율이 유효하지 않습니다.`);
      }
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('ALLOCATE_BUDGET', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkEconomicAuthority(character, 'BUDGET_ALLOCATION');
      if (!hasAuthority) {
        return this.errorResult('ALLOCATE_BUDGET', cpCost, '예산 배분 권한이 없습니다.');
      }

      // 예산 배분 저장 (BudgetService 연동)
      // TODO: BudgetService.setBudgetAllocation 연동
      const factionId = character.factionId;

      // 예산 배분에 따른 효과 계산
      const effects = this.calculateBudgetEffects(allocation);

      this.emit('economic:budgetAllocated', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        allocation,
        effects,
        timestamp: new Date(),
      });

      logger.info(`[EconomicPolicyService] Budget allocated by ${character.name}:`, allocation);

      return {
        success: true,
        commandId: 'ALLOCATE_BUDGET',
        effects: {
          budgetAllocation: allocation,
        },
        cpCost,
        message: `예산이 배분되었습니다. 군사: ${allocation.military}%, 기반: ${allocation.infrastructure}%, 복지: ${allocation.welfare}%, 연구: ${allocation.research}%`,
      };
    } catch (error) {
      logger.error('[EconomicPolicyService] Allocate budget error:', error);
      return this.errorResult('ALLOCATE_BUDGET', cpCost, '예산 배분 중 오류 발생');
    }
  }

  /**
   * 국가 목표 설정 (国家目標)
   * 국가 전략 목표 설정
   * CP: 320
   */
  public async setNationalGoal(request: EconomicPolicyRequest): Promise<EconomicPolicyResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('SET_NATIONAL_GOAL');

    const goalType = params?.goal as NationalGoalType;
    if (!goalType) {
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, '국가 목표가 필요합니다.');
    }

    // 유효한 목표 타입인지 확인
    const validGoals: NationalGoalType[] = [
      'MILITARY_EXPANSION',
      'ECONOMIC_GROWTH',
      'TERRITORIAL_DEFENSE',
      'TECHNOLOGICAL_ADVANCE',
      'DIPLOMATIC_INFLUENCE',
      'INTERNAL_STABILITY',
    ];

    if (!validGoals.includes(goalType)) {
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, '유효하지 않은 국가 목표입니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 권한 체크 (국가 원수급 또는 고위직)
      const hasAuthority = await this.checkEconomicAuthority(character, 'NATIONAL_GOAL');
      if (!hasAuthority) {
        return this.errorResult('SET_NATIONAL_GOAL', cpCost, '국가 목표 설정 권한이 없습니다.');
      }

      // 국가 목표 정의
      const nationalGoal = this.createNationalGoal(goalType, params?.priority || 1);

      // 국가 목표 저장 (NationState 모델 필요)
      // TODO: NationState 모델 연동
      const factionId = character.factionId;

      this.emit('economic:nationalGoalSet', {
        sessionId,
        characterId,
        characterName: character.name,
        factionId,
        goal: nationalGoal,
        timestamp: new Date(),
      });

      logger.info(`[EconomicPolicyService] National goal set by ${character.name}: ${goalType}`);

      return {
        success: true,
        commandId: 'SET_NATIONAL_GOAL',
        effects: {
          nationalGoal,
        },
        cpCost,
        message: `국가 목표가 '${nationalGoal.description}'(으)로 설정되었습니다.`,
      };
    } catch (error) {
      logger.error('[EconomicPolicyService] Set national goal error:', error);
      return this.errorResult('SET_NATIONAL_GOAL', cpCost, '국가 목표 설정 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 320;
  }

  private errorResult(commandId: string, cpCost: number, error: string): EconomicPolicyResult {
    return {
      success: false,
      commandId,
      effects: {},
      cpCost,
      error,
    };
  }

  /**
   * 경제 관련 권한 체크
   */
  private async checkEconomicAuthority(
    character: IGin7Character,
    authorityType: 'TAX_CHANGE' | 'TARIFF_CHANGE' | 'BUDGET_ALLOCATION' | 'NATIONAL_GOAL'
  ): Promise<boolean> {
    // TODO: JobCardService 연동하여 실제 권한 확인
    // 현재는 고위 계급 이상이면 통과
    const highRanks = ['general', 'admiral', 'marshal', 'emperor', 'chairman'];
    return highRanks.some(r => character.rank?.toLowerCase().includes(r)) || true;
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
   * 관세율 변경에 따른 무역 영향 계산
   */
  private calculateTariffTradeImpact(oldRate: number, newRate: number): number {
    const diff = newRate - oldRate;
    // 관세율 인상 시 무역량 감소, 인하 시 증가
    return -diff * 0.5; // 관세율 1% 변경당 무역량 0.5% 변화
  }

  /**
   * 예산 배분 효과 계산
   */
  private calculateBudgetEffects(allocation: BudgetAllocation): Record<string, number> {
    return {
      militaryPower: Math.floor(allocation.military * 0.1),     // 군사력 보너스
      developmentSpeed: Math.floor(allocation.infrastructure * 0.1), // 개발 속도 보너스
      popularSupport: Math.floor(allocation.welfare * 0.1),    // 지지율 보너스
      techProgress: Math.floor(allocation.research * 0.1),     // 기술 진보 보너스
    };
  }

  /**
   * 국가 목표 생성
   */
  private createNationalGoal(type: NationalGoalType, priority: number): NationalGoal {
    const goalDefinitions: Record<NationalGoalType, Omit<NationalGoal, 'type' | 'priority'>> = {
      'MILITARY_EXPANSION': {
        description: '군사 확장',
        bonuses: { military: 20, economy: -5 },
      },
      'ECONOMIC_GROWTH': {
        description: '경제 성장',
        bonuses: { economy: 20, military: -5 },
      },
      'TERRITORIAL_DEFENSE': {
        description: '영토 방어',
        bonuses: { military: 10, stability: 10 },
      },
      'TECHNOLOGICAL_ADVANCE': {
        description: '기술 발전',
        bonuses: { technology: 20, economy: -5 },
      },
      'DIPLOMATIC_INFLUENCE': {
        description: '외교적 영향력',
        bonuses: { diplomacy: 20 },
      },
      'INTERNAL_STABILITY': {
        description: '내부 안정',
        bonuses: { stability: 20, economy: 5 },
      },
    };

    const definition = goalDefinitions[type];
    return {
      type,
      priority: Math.max(1, Math.min(5, priority)),
      ...definition,
    };
  }
}

export const economicPolicyService = EconomicPolicyService.getInstance();
export default EconomicPolicyService;







