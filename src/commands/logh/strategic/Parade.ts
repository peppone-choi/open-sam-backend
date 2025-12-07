/**
 * 분열 행진 (Parade / Military Parade)
 * 주둔 중인 육전대로 행성의 정부 지지율 증가
 * 지지율 +5, 비용 소모
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { Fleet } from '../../../models/logh/Fleet.model';

export class ParadeCommand extends BaseLoghCommand {
  getName(): string {
    return 'parade';
  }

  getDisplayName(): string {
    return '분열 행진';
  }

  getDescription(): string {
    return '주둔 중인 육전대로 행성의 정부 지지율 증가 (지지율 +5)';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  // 분열 행진 비용 (자금 소모)
  getRequiredFunds(): number {
    return 1000;
  }

  getConstraints(): IConstraint[] {
    return [
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
    ];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    const targetPlanetId = env?.targetPlanetId;
    if (!targetPlanetId) {
      return { success: false, message: '분열 행진을 실시할 행성을 지정해주세요.' };
    }

    // 함대 확인
    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return { success: false, message: '함대를 보유하지 않았습니다.' };
    }

    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId,
    });

    if (!fleet) {
      return { success: false, message: '함대를 찾을 수 없습니다.' };
    }

    // 육전대가 있는지 확인
    const hasGroundForces = fleet.totalGroundTroops && fleet.totalGroundTroops > 0;
    if (!hasGroundForces) {
      return { success: false, message: '육전대가 없습니다. 분열 행진에는 육전대가 필요합니다.' };
    }

    // 대상 행성 확인
    const planet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: targetPlanetId,
    });

    if (!planet) {
      return { success: false, message: '대상 행성을 찾을 수 없습니다.' };
    }

    // 자기 세력 소유인지 확인
    if (planet.owner !== commander.getFactionType()) {
      return { success: false, message: '자기 세력 소유의 행성만 분열 행진이 가능합니다.' };
    }

    // 이미 최대치인지 확인
    if (planet.stats.approvalRating >= 100) {
      return { success: false, message: '지지율이 이미 최대치입니다.' };
    }

    // 비용 확인 및 차감 (행성 재정에서)
    const requiredFunds = this.getRequiredFunds();
    if (planet.economy && planet.economy.treasury < requiredFunds) {
      return { success: false, message: `행성 재정이 부족합니다. (필요: ${requiredFunds}, 보유: ${planet.economy.treasury})` };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 비용 차감
    if (planet.economy) {
      planet.economy.treasury -= requiredFunds;
    }

    // 지지율 증가 (+5)
    const APPROVAL_INCREASE = 5;
    const beforeApproval = planet.stats.approvalRating;
    planet.stats.approvalRating = Math.min(100, planet.stats.approvalRating + APPROVAL_INCREASE);

    planet.markModified('stats');
    planet.markModified('economy');
    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}에서 분열 행진을 실시했습니다. 지지율 ${beforeApproval} → ${planet.stats.approvalRating} (비용: ${requiredFunds})`,
      effects: [
        {
          type: 'parade',
          planetId: targetPlanetId,
          planetName: planet.name,
          approvalBefore: beforeApproval,
          approvalAfter: planet.stats.approvalRating,
          increase: APPROVAL_INCREASE,
          fundsCost: requiredFunds,
        },
      ],
    };
  }
}
