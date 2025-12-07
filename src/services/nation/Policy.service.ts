/**
 * Policy.service.ts - 국가 정책 시스템 서비스
 *
 * 국가 정책 설정 및 효과 적용을 담당합니다.
 */

import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';
import { ActionLogger } from '../../utils/ActionLogger';

/**
 * 정책 타입
 */
export enum PolicyType {
  // 내정 정책
  AGRICULTURE_FOCUS = 'agriculture_focus',   // 농업 중시
  COMMERCE_FOCUS = 'commerce_focus',         // 상업 중시
  MILITARY_FOCUS = 'military_focus',         // 군사 중시
  BALANCED = 'balanced',                     // 균형 발전
  
  // 세금 정책
  LOW_TAX = 'low_tax',                       // 저세율 (민심↑, 수입↓)
  NORMAL_TAX = 'normal_tax',                 // 보통 세율
  HIGH_TAX = 'high_tax',                     // 고세율 (민심↓, 수입↑)
  
  // 징병 정책
  VOLUNTARY = 'voluntary',                   // 모병제 (비용↑, 사기↑)
  CONSCRIPTION = 'conscription',             // 징병제 (비용↓, 민심↓)
  
  // 외교 정책
  ISOLATIONIST = 'isolationist',             // 고립주의
  EXPANSIONIST = 'expansionist',             // 팽창주의
  DIPLOMATIC = 'diplomatic',                 // 외교 중시
}

/**
 * 정책 카테고리
 */
export enum PolicyCategory {
  DOMESTIC = 'domestic',       // 내정
  TAX = 'tax',                 // 세금
  MILITARY = 'military',       // 군사
  DIPLOMACY = 'diplomacy',     // 외교
}

/**
 * 정책 설정 인터페이스
 */
export interface PolicyConfig {
  id: PolicyType;
  name: string;
  description: string;
  category: PolicyCategory;
  effects: PolicyEffect;
  requirements?: PolicyRequirement;
  exclusive?: PolicyType[];
}

/**
 * 정책 효과
 */
export interface PolicyEffect {
  // 도시 성장
  agriGrowthRate?: number;     // 농업 성장률 보정
  commGrowthRate?: number;     // 상업 성장률 보정
  techGrowthRate?: number;     // 기술 성장률 보정
  
  // 세금/수입
  taxRate?: number;            // 세율 보정
  trustChange?: number;        // 민심 변화
  
  // 군사
  conscriptCost?: number;      // 징병 비용 보정
  troopMorale?: number;        // 병사 사기 보정
  trainingSpeed?: number;      // 훈련 속도 보정
  
  // 외교
  diplomacyBonus?: number;     // 외교 성공률 보정
  warPenalty?: number;         // 전쟁 패널티 보정
  
  // 특수
  specialEffect?: string;      // 특수 효과 ID
}

/**
 * 정책 요구사항
 */
export interface PolicyRequirement {
  minCities?: number;          // 최소 도시 수
  minGenerals?: number;        // 최소 장수 수
  minGold?: number;            // 최소 금
  minTrust?: number;           // 최소 평균 민심
}

/**
 * 국가 정책 현황
 */
export interface NationPolicies {
  domestic: PolicyType;
  tax: PolicyType;
  military: PolicyType;
  diplomacy: PolicyType;
  changedAt: Date;
}

/**
 * 정책 목록
 */
export const POLICIES: Record<PolicyType, PolicyConfig> = {
  // 내정 정책
  [PolicyType.AGRICULTURE_FOCUS]: {
    id: PolicyType.AGRICULTURE_FOCUS,
    name: '농업 중시',
    description: '농업 발전에 집중하여 식량 생산을 늘립니다.',
    category: PolicyCategory.DOMESTIC,
    effects: {
      agriGrowthRate: 1.3,
      commGrowthRate: 0.8,
    },
  },
  [PolicyType.COMMERCE_FOCUS]: {
    id: PolicyType.COMMERCE_FOCUS,
    name: '상업 중시',
    description: '상업 발전에 집중하여 금 수입을 늘립니다.',
    category: PolicyCategory.DOMESTIC,
    effects: {
      commGrowthRate: 1.3,
      agriGrowthRate: 0.8,
    },
  },
  [PolicyType.MILITARY_FOCUS]: {
    id: PolicyType.MILITARY_FOCUS,
    name: '군사 중시',
    description: '군사력 강화에 집중합니다.',
    category: PolicyCategory.DOMESTIC,
    effects: {
      techGrowthRate: 1.2,
      trainingSpeed: 1.2,
      agriGrowthRate: 0.9,
      commGrowthRate: 0.9,
    },
  },
  [PolicyType.BALANCED]: {
    id: PolicyType.BALANCED,
    name: '균형 발전',
    description: '모든 분야를 균형있게 발전시킵니다.',
    category: PolicyCategory.DOMESTIC,
    effects: {
      agriGrowthRate: 1.0,
      commGrowthRate: 1.0,
      techGrowthRate: 1.0,
    },
  },
  
  // 세금 정책
  [PolicyType.LOW_TAX]: {
    id: PolicyType.LOW_TAX,
    name: '저세율',
    description: '세금을 낮춰 민심을 높입니다.',
    category: PolicyCategory.TAX,
    effects: {
      taxRate: 0.7,
      trustChange: 3,
    },
  },
  [PolicyType.NORMAL_TAX]: {
    id: PolicyType.NORMAL_TAX,
    name: '보통 세율',
    description: '보통 수준의 세금을 거둡니다.',
    category: PolicyCategory.TAX,
    effects: {
      taxRate: 1.0,
      trustChange: 0,
    },
  },
  [PolicyType.HIGH_TAX]: {
    id: PolicyType.HIGH_TAX,
    name: '고세율',
    description: '세금을 높여 수입을 늘리지만 민심이 떨어집니다.',
    category: PolicyCategory.TAX,
    effects: {
      taxRate: 1.4,
      trustChange: -5,
    },
  },
  
  // 군사 정책
  [PolicyType.VOLUNTARY]: {
    id: PolicyType.VOLUNTARY,
    name: '모병제',
    description: '자원병을 모집합니다. 비용이 높지만 사기가 높습니다.',
    category: PolicyCategory.MILITARY,
    effects: {
      conscriptCost: 1.5,
      troopMorale: 10,
    },
  },
  [PolicyType.CONSCRIPTION]: {
    id: PolicyType.CONSCRIPTION,
    name: '징병제',
    description: '강제로 병사를 징집합니다. 비용은 낮지만 민심이 떨어집니다.',
    category: PolicyCategory.MILITARY,
    effects: {
      conscriptCost: 0.7,
      trustChange: -2,
    },
  },
  
  // 외교 정책
  [PolicyType.ISOLATIONIST]: {
    id: PolicyType.ISOLATIONIST,
    name: '고립주의',
    description: '외교보다 내정에 집중합니다.',
    category: PolicyCategory.DIPLOMACY,
    effects: {
      agriGrowthRate: 1.1,
      commGrowthRate: 1.1,
      diplomacyBonus: -0.2,
    },
  },
  [PolicyType.EXPANSIONIST]: {
    id: PolicyType.EXPANSIONIST,
    name: '팽창주의',
    description: '적극적인 영토 확장을 추구합니다.',
    category: PolicyCategory.DIPLOMACY,
    effects: {
      trainingSpeed: 1.2,
      warPenalty: -0.3,
    },
  },
  [PolicyType.DIPLOMATIC]: {
    id: PolicyType.DIPLOMATIC,
    name: '외교 중시',
    description: '외교를 통한 평화로운 발전을 추구합니다.',
    category: PolicyCategory.DIPLOMACY,
    effects: {
      diplomacyBonus: 0.3,
      warPenalty: 0.2,
    },
  },
};

/**
 * 기본 정책 설정
 */
export const DEFAULT_POLICIES: NationPolicies = {
  domestic: PolicyType.BALANCED,
  tax: PolicyType.NORMAL_TAX,
  military: PolicyType.CONSCRIPTION,
  diplomacy: PolicyType.DIPLOMATIC,
  changedAt: new Date(),
};

/**
 * 정책 서비스 클래스
 */
export class PolicyService {
  /**
   * 국가 정책 조회
   */
  static async getPolicies(
    sessionId: string,
    nationId: number
  ): Promise<NationPolicies | null> {
    try {
      const nation = await nationRepository.findBySessionAndNationId(sessionId, nationId);
      if (!nation) return null;

      const nationData = nation.data || {};
      return nationData.policies || { ...DEFAULT_POLICIES };
    } catch (error: any) {
      logger.error('[Policy] Get policies failed', {
        sessionId,
        nationId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 정책 설정
   */
  static async setPolicy(
    sessionId: string,
    nationId: number,
    policyType: PolicyType,
    setterId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = POLICIES[policyType];
      if (!config) {
        return { success: false, error: '존재하지 않는 정책입니다.' };
      }

      const nation = await nationRepository.findBySessionAndNationId(sessionId, nationId);
      if (!nation) {
        return { success: false, error: '국가를 찾을 수 없습니다.' };
      }

      // 요구사항 체크
      if (config.requirements) {
        const req = config.requirements;
        
        if (req.minCities) {
          const cityCount = nation.data?.cityCount || nation.cityCount || 0;
          if (cityCount < req.minCities) {
            return { success: false, error: `최소 ${req.minCities}개 도시가 필요합니다.` };
          }
        }
        
        if (req.minGenerals) {
          const genCount = nation.data?.gennum || nation.gennum || 0;
          if (genCount < req.minGenerals) {
            return { success: false, error: `최소 ${req.minGenerals}명의 장수가 필요합니다.` };
          }
        }
        
        if (req.minGold) {
          const gold = nation.data?.gold || nation.gold || 0;
          if (gold < req.minGold) {
            return { success: false, error: `최소 ${req.minGold} 금이 필요합니다.` };
          }
        }
      }

      // 현재 정책 가져오기
      const nationData = nation.data || {};
      const currentPolicies: NationPolicies = nationData.policies || { ...DEFAULT_POLICIES };

      // 카테고리별 정책 업데이트
      switch (config.category) {
        case PolicyCategory.DOMESTIC:
          currentPolicies.domestic = policyType;
          break;
        case PolicyCategory.TAX:
          currentPolicies.tax = policyType;
          break;
        case PolicyCategory.MILITARY:
          currentPolicies.military = policyType;
          break;
        case PolicyCategory.DIPLOMACY:
          currentPolicies.diplomacy = policyType;
          break;
      }

      currentPolicies.changedAt = new Date();
      nationData.policies = currentPolicies;

      await nationRepository.updateBySessionAndNationId(sessionId, nationId, {
        data: nationData,
      });

      // 로그 기록
      const nationName = nation.name || `국가${nationId}`;
      const actionLogger = new ActionLogger(setterId, nationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<D><b>${nationName}</b></>이(가) <C>${config.name}</> 정책을 시행했습니다.`
      );
      await actionLogger.flush();

      logger.info('[Policy] Set policy', {
        sessionId,
        nationId,
        policyType,
        category: config.category,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Policy] Set policy failed', {
        sessionId,
        nationId,
        policyType,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 정책 효과 계산
   */
  static calculatePolicyEffects(policies: NationPolicies): PolicyEffect {
    const totalEffect: PolicyEffect = {};

    const policyTypes = [
      policies.domestic,
      policies.tax,
      policies.military,
      policies.diplomacy,
    ];

    for (const policyType of policyTypes) {
      const config = POLICIES[policyType];
      if (!config) continue;

      for (const [key, value] of Object.entries(config.effects)) {
        const effectKey = key as keyof PolicyEffect;
        if (typeof value === 'number') {
          if (totalEffect[effectKey] === undefined) {
            totalEffect[effectKey] = value;
          } else {
            // 성장률은 곱셈, 나머지는 덧셈
            if (key.endsWith('Rate') || key.endsWith('Cost') || key.endsWith('Speed')) {
              (totalEffect[effectKey] as number) *= value;
            } else {
              (totalEffect[effectKey] as number) += value;
            }
          }
        }
      }
    }

    return totalEffect;
  }

  /**
   * 카테고리별 사용 가능한 정책 목록
   */
  static getPoliciesByCategory(category: PolicyCategory): PolicyConfig[] {
    return Object.values(POLICIES).filter(p => p.category === category);
  }

  /**
   * 모든 정책 목록
   */
  static getAllPolicies(): PolicyConfig[] {
    return Object.values(POLICIES);
  }
}

export default PolicyService;





