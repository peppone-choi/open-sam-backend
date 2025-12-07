/**
 * 무력 진압 (Armed Suppression)
 * 주둔 중인 육전대로 치안 유지율 대폭 증가, 정부 지지율 하락, 사상자 발생 가능
 * 치안 +20, 지지율 -10, 사상자 발생 확률 있음
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { Fleet } from '../../../models/logh/Fleet.model';

export class ArmedSuppressionCommand extends BaseLoghCommand {
  getName(): string {
    return 'armed_suppression';
  }

  getDisplayName(): string {
    return '무력 진압';
  }

  getDescription(): string {
    return '주둔 중인 육전대로 치안 대폭 증가, 지지율 하락, 사상자 발생 가능 (치안 +20, 지지율 -10)';
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
      return { success: false, message: '무력 진압할 행성을 지정해주세요.' };
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
      return { success: false, message: '육전대가 없습니다. 무력 진압에는 육전대가 필요합니다.' };
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
      return { success: false, message: '자기 세력 소유의 행성만 무력 진압이 가능합니다.' };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 효과 상수
    const SECURITY_INCREASE = 20;
    const APPROVAL_DECREASE = 10;
    const CASUALTY_CHANCE = 0.3; // 30% 확률로 사상자 발생

    // 치안 증가 (+20)
    const beforeSecurity = planet.stats.security;
    planet.stats.security = Math.min(100, planet.stats.security + SECURITY_INCREASE);

    // 지지율 감소 (-10)
    const beforeApproval = planet.stats.approvalRating;
    planet.stats.approvalRating = Math.max(0, planet.stats.approvalRating - APPROVAL_DECREASE);

    // 사상자 발생 체크 (30% 확률)
    let casualties = 0;
    let casualtyMessage = '';
    if (Math.random() < CASUALTY_CHANCE) {
      // 인구의 0.01% ~ 0.05% 사상자 발생
      const casualtyRate = 0.0001 + Math.random() * 0.0004;
      casualties = Math.floor(planet.stats.population * casualtyRate);
      if (casualties > 0) {
        planet.stats.population = Math.max(1, planet.stats.population - casualties);
        casualtyMessage = ` 진압 과정에서 ${casualties}명의 사상자가 발생했습니다.`;
      }
    }

    planet.markModified('stats');
    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}에서 무력 진압을 실시했습니다. 치안 ${beforeSecurity} → ${planet.stats.security}, 지지율 ${beforeApproval} → ${planet.stats.approvalRating}${casualtyMessage}`,
      effects: [
        {
          type: 'armed_suppression',
          planetId: targetPlanetId,
          planetName: planet.name,
          securityBefore: beforeSecurity,
          securityAfter: planet.stats.security,
          approvalBefore: beforeApproval,
          approvalAfter: planet.stats.approvalRating,
          casualties,
        },
      ],
    };
  }
}
