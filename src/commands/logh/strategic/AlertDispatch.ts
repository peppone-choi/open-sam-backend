/**
 * 경계 출동 (Alert Dispatch)
 * 주둔 중인 육전대로 행성/요새의 치안 유지율 증가
 * 치안 +5
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { Fleet } from '../../../models/logh/Fleet.model';

export class AlertDispatchCommand extends BaseLoghCommand {
  getName(): string {
    return 'alert_dispatch';
  }

  getDisplayName(): string {
    return '경계 출동';
  }

  getDescription(): string {
    return '주둔 중인 육전대로 행성/요새의 치안 유지율 증가 (치안 +5)';
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
      return { success: false, message: '경계 출동할 행성을 지정해주세요.' };
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
      return { success: false, message: '육전대가 없습니다. 경계 출동에는 육전대가 필요합니다.' };
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
      return { success: false, message: '자기 세력 소유의 행성만 경계 출동이 가능합니다.' };
    }

    // 이미 최대치인지 확인
    if (planet.stats.security >= 100) {
      return { success: false, message: '치안이 이미 최대치입니다.' };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 치안 증가 (+5)
    const SECURITY_INCREASE = 5;
    const beforeSecurity = planet.stats.security;
    planet.stats.security = Math.min(100, planet.stats.security + SECURITY_INCREASE);

    planet.markModified('stats');
    await planet.save();
    await commander.save();

    return {
      success: true,
      message: `${planet.name}에 경계 출동을 실시했습니다. 치안 ${beforeSecurity} → ${planet.stats.security}`,
      effects: [
        {
          type: 'security_increased',
          planetId: targetPlanetId,
          planetName: planet.name,
          before: beforeSecurity,
          after: planet.stats.security,
          increase: SECURITY_INCREASE,
        },
      ],
    };
  }
}
