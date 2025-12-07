/**
 * 수송 계획 (輸送計画)
 * 특정 행성/요새 대상 수송 패키지 작성. 작성 패키지는 수송 창고로 이동
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { AutoProductionService } from '../../../services/logh/AutoProductionService';
import { Planet } from '../../../models/logh/Planet.model';

interface TransportPackageInput {
  itemType: 'ship' | 'supplies' | 'fuel' | 'troops';
  itemSubType?: string;
  quantity: number;
}

export class TransportPlanCommand extends BaseLoghCommand {
  getName(): string {
    return 'transport_plan';
  }

  getDisplayName(): string {
    return '수송 계획';
  }

  getDescription(): string {
    return '특정 행성/요새 대상 수송 패키지 작성. 정기 수송편 설정 가능';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터 추출
    const sourceId = env.sourceId as string;
    const destinationId = env.destinationId as string;
    const packages = env.packages as TransportPackageInput[];
    const recurring = env.recurring as boolean | undefined;
    const interval = env.interval as number | undefined;

    // 필수 파라미터 검증
    if (!sourceId) {
      return {
        success: false,
        message: '출발지 행성을 지정해야 합니다.',
      };
    }

    if (!destinationId) {
      return {
        success: false,
        message: '도착지 행성을 지정해야 합니다.',
      };
    }

    if (!packages || packages.length === 0) {
      return {
        success: false,
        message: '수송할 물자를 지정해야 합니다.',
      };
    }

    // 출발지/도착지 행성 검증
    const sourcePlanet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: sourceId,
    });

    if (!sourcePlanet) {
      return {
        success: false,
        message: '출발지 행성을 찾을 수 없습니다.',
      };
    }

    const destPlanet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: destinationId,
    });

    if (!destPlanet) {
      return {
        success: false,
        message: '도착지 행성을 찾을 수 없습니다.',
      };
    }

    // 소유권 확인
    const faction = commander.getFactionType();
    if (sourcePlanet.owner !== faction) {
      return {
        success: false,
        message: '출발지 행성이 아군 소유가 아닙니다.',
      };
    }

    if (destPlanet.owner !== faction) {
      return {
        success: false,
        message: '도착지 행성이 아군 소유가 아닙니다.',
      };
    }

    // 물자 보유량 확인
    for (const pkg of packages) {
      if (pkg.itemType === 'ship' && sourcePlanet.warehouse.ships < pkg.quantity) {
        return {
          success: false,
          message: `출발지에 함선이 부족합니다. (보유: ${sourcePlanet.warehouse.ships}, 필요: ${pkg.quantity})`,
        };
      }
      if (pkg.itemType === 'supplies' && sourcePlanet.warehouse.supplies < pkg.quantity) {
        return {
          success: false,
          message: `출발지에 보급품이 부족합니다. (보유: ${sourcePlanet.warehouse.supplies}, 필요: ${pkg.quantity})`,
        };
      }
    }

    // 수송 계획 생성
    const service = new AutoProductionService(commander.session_id);

    try {
      const plan = await service.createTransportPlan({
        sourceId,
        destinationId,
        faction,
        packages: packages.map(p => ({
          itemType: p.itemType,
          itemSubType: p.itemSubType,
          quantity: p.quantity,
        })),
        recurring: recurring || false,
        interval: interval || 1,
      });

      // CP 소모
      commander.consumeCommandPoints(this.getRequiredCommandPoints());
      await commander.save();

      const packageSummary = packages
        .map(p => `${p.itemType} x${p.quantity}`)
        .join(', ');

      const scheduleType = recurring ? `정기 수송 (${interval || 1}턴 간격)` : '일회성 수송';

      return {
        success: true,
        message: `수송 계획이 생성되었습니다. [${sourcePlanet.name} → ${destPlanet.name}] ${packageSummary} (${scheduleType})`,
        effects: [
          {
            type: 'transport_plan_created',
            planId: plan.planId,
            sourceId,
            sourceName: sourcePlanet.name,
            destinationId,
            destinationName: destPlanet.name,
            packages,
            recurring: recurring || false,
            interval: interval || 1,
          },
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        message: `수송 계획 생성 실패: ${error.message}`,
      };
    }
  }
}
