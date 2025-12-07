/**
 * 징발 (Requisition, 徴発)
 * 점령한 타 세력의 행성/요새에서 군수물자 징발
 * 
 * 효과:
 * - 행성의 민간 물자를 군수 물자로 변환
 * - 징발량 = 행성 자원 × 징발율
 * 
 * 페널티:
 * - 지지율(충성도) 대폭 하락 (-20 ~ -40)
 * - 치안 하락 (반란 위험 증가)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';

// 징발 설정
const REQUISITION_CONFIG = {
  BASE_RATE: 0.3, // 기본 징발율 30%
  MAX_RATE: 0.5, // 최대 징발율 50%
  LOYALTY_PENALTY_MIN: -20, // 최소 충성도 감소
  LOYALTY_PENALTY_MAX: -40, // 최대 충성도 감소
  REBELLION_RISK_THRESHOLD: 30, // 반란 위험 임계값
  SUPPLIES_PER_RESOURCE: 100, // 자원 1당 보급품 환산
};

export class RequisitionCommand extends BaseLoghCommand {
  getName(): string {
    return 'requisition';
  }

  getDisplayName(): string {
    return '징발';
  }

  getDescription(): string {
    return '점령한 타 세력의 행성/요새에서 군수물자 징발. 지지율이 대폭 하락합니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0; // 실행 후 24턴(게임시간) 지연
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  /**
   * 징발량 계산
   */
  private calculateRequisitionAmount(planet: any, rate: number): number {
    const resources = planet.stats?.resources || 0;
    const population = planet.stats?.population || 0;
    
    // 징발량 = (자원 × 인구 / 1000) × 징발율 × 기본 환산율
    const baseAmount = (resources * population / 1000) * rate;
    return Math.floor(baseAmount * REQUISITION_CONFIG.SUPPLIES_PER_RESOURCE);
  }

  /**
   * 충성도 감소량 계산
   */
  private calculateLoyaltyPenalty(rate: number): number {
    // 징발율에 비례하여 충성도 감소
    const ratio = rate / REQUISITION_CONFIG.MAX_RATE;
    const penalty = REQUISITION_CONFIG.LOYALTY_PENALTY_MIN + 
      (REQUISITION_CONFIG.LOYALTY_PENALTY_MAX - REQUISITION_CONFIG.LOYALTY_PENALTY_MIN) * ratio;
    return Math.floor(penalty);
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터 추출
    const planetId = env.planetId as string;
    const rate = Math.min(
      Math.max(env.rate as number || REQUISITION_CONFIG.BASE_RATE, 0.1),
      REQUISITION_CONFIG.MAX_RATE
    );

    if (!planetId) {
      return {
        success: false,
        message: '징발할 행성을 지정해야 합니다.',
      };
    }

    // 행성 조회
    const planet = await Planet.findOne({
      session_id: commander.session_id,
      planetId,
    });

    if (!planet) {
      return {
        success: false,
        message: '행성을 찾을 수 없습니다.',
      };
    }

    // 소유권 확인 (아군 소유여야 징발 가능)
    const faction = commander.getFactionType();
    if (planet.owner !== faction) {
      return {
        success: false,
        message: '아군이 점령한 행성에서만 징발할 수 있습니다.',
      };
    }

    // 점령지 확인 (원래 다른 세력 영토였는지)
    // territoryType이 다른 경우 = 점령지
    const isOccupiedTerritory = planet.territoryType && planet.territoryType !== faction;
    
    // 자원이 있는지 확인
    if (!planet.stats?.resources || planet.stats.resources <= 0) {
      return {
        success: false,
        message: '이 행성에는 징발할 자원이 없습니다.',
      };
    }

    // 징발량 계산
    const requisitionAmount = this.calculateRequisitionAmount(planet, rate);

    if (requisitionAmount <= 0) {
      return {
        success: false,
        message: '징발 가능한 물자가 없습니다.',
      };
    }

    // 충성도 감소 계산
    const loyaltyPenalty = this.calculateLoyaltyPenalty(rate);
    const currentLoyalty = planet.stats?.loyalty || 50;
    const newLoyalty = Math.max(-100, currentLoyalty + loyaltyPenalty);

    // 반란 위험 경고
    const rebellionRisk = newLoyalty < REQUISITION_CONFIG.REBELLION_RISK_THRESHOLD;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 행성 업데이트
    planet.warehouse.supplies += requisitionAmount;
    planet.stats.loyalty = newLoyalty;
    
    // 자원 감소 (징발로 인한 경제 피해)
    planet.stats.resources = Math.max(0, planet.stats.resources - Math.floor(rate * 10));

    await planet.save();
    await commander.save();

    // 결과 메시지
    let message = `${planet.name}에서 보급품 ${requisitionAmount.toLocaleString()}을 징발했습니다. `;
    message += `충성도: ${currentLoyalty} → ${newLoyalty} (${loyaltyPenalty})`;

    if (rebellionRisk) {
      message += ` ⚠️ 반란 위험!`;
    }

    return {
      success: true,
      message,
      effects: [
        {
          type: 'requisition_executed',
          planetId,
          planetName: planet.name,
          amount: requisitionAmount,
          rate,
        },
        {
          type: 'loyalty_change',
          planetId,
          previousLoyalty: currentLoyalty,
          newLoyalty,
          change: loyaltyPenalty,
          rebellionRisk,
        },
        {
          type: 'resource_change',
          resource: 'supplies',
          amount: requisitionAmount,
          location: planetId,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 징발 후 턴 종료 시 반란 체크는 별도 시스템에서 처리
  }
}
