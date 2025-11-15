/**
 * 생산 (生産, Production)
 * 함정 건조 및 병사 모병 (조병공창 필요)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { Fleet } from '../../../models/logh/Fleet.model';

interface ProductionOrder {
  shipType: string; // 함선 종류 (예: 'SS75-I', '787-I')
  count: number; // 생산 수량
}

export class ProductionCommand extends BaseLoghCommand {
  getName(): string {
    return 'production';
  }

  getDisplayName(): string {
    return '생산';
  }

  getDescription(): string {
    return '함정 건조 및 병사 모병 (조병공창 필요)';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 80; // 생산 명령 CP
  }

  getRequiredTurns(): number {
    return 0; // 생산 시간은 함선 종류와 수량에 따라 다름
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  /**
   * 함선 생산 비용 계산 (임시 - 나중에 ship-specifications.json 기반으로)
   */
  private calculateProductionCost(shipType: string, count: number): number {
    // 임시: 함선 종류별 기본 비용
    const baseCosts: Record<string, number> = {
      // 제국
      'SS75-I': 1000,   // 표준전함
      'PK86-I': 1200,   // 고속전함
      'SK80-I': 800,    // 순항함
      'Z82-I': 400,     // 구축함
      'FR88-I': 2000,   // 항공모함
      
      // 동맹
      '787-I': 1000,    // 표준전함
      '795-I': 800,     // 순항함
      '794-I': 900,     // 타격순항함
      '796-I': 400,     // 구축함
      '798-I': 2000,    // 항공모함
    };

    const baseCost = baseCosts[shipType] || 1000;
    return baseCost * count;
  }

  /**
   * 생산 소요 시간 계산 (게임시간)
   */
  private calculateProductionTime(shipType: string, count: number): number {
    // 함선 1척당 기본 10 게임시간
    const baseTime = 10;
    return baseTime * count;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 생산 명령 파라미터
    const planetId = env.planetId;
    const orders: ProductionOrder[] = env.orders || [];

    if (!planetId) {
      return {
        success: false,
        message: '생산할 행성을 지정해야 합니다.',
      };
    }

    if (!orders || orders.length === 0) {
      return {
        success: false,
        message: '생산할 함선 종류와 수량을 지정해야 합니다.',
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

    // 아군 행성인지 확인
    if (planet.owner !== commander.getFactionType()) {
      return {
        success: false,
        message: '아군 행성에서만 생산할 수 있습니다.',
      };
    }

    // FUTURE: 조병공창 시설 존재 여부 확인 (Facility 시스템 구현 후)
    // 현재는 industry 수치로 임시 대체
    const industry = planet.stats?.industry || 0;
    if (industry < 10) {
      return {
        success: false,
        message: '이 행성은 공업 수준이 낮아 함선을 생산할 수 없습니다. (조병공창 필요)',
      };
    }

    // 총 생산 비용 계산
    let totalCost = 0;
    let totalTime = 0;
    const productionDetails: any[] = [];

    for (const order of orders) {
      const cost = this.calculateProductionCost(order.shipType, order.count);
      const time = this.calculateProductionTime(order.shipType, order.count);
      
      totalCost += cost;
      totalTime = Math.max(totalTime, time); // 병렬 생산 가정
      
      productionDetails.push({
        shipType: order.shipType,
        count: order.count,
        cost,
        time,
      });
    }

    // FUTURE: 행성 자원(resources) 체크 (Planet 모델에 resources 필드 추가 필요)
    // 현재는 커맨더의 supplies로 임시 대체
    const commanderSupplies = commander.data.supplies || 0;
    if (commanderSupplies < totalCost) {
      return {
        success: false,
        message: `자원이 부족합니다. (필요: ${totalCost}, 보유: ${commanderSupplies})`,
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 자원 소비
    commander.data.supplies = commanderSupplies - totalCost;

    // 생산 큐에 등록 (커맨더 customData에 저장)
    const productionQueue = commander.data.production_queue || [];
    productionQueue.push({
      planetId,
      orders: productionDetails,
      startedAt: Date.now(),
      completesAt: Date.now() + (totalTime * 2500), // 게임시간 → 밀리초
    });
    commander.data.production_queue = productionQueue;

    await commander.save();

    // 소요 시간 등록
    const durationMs = totalTime * 2500;
    commander.startCommand('production', durationMs, { planetId, orders: productionDetails });

    const orderSummary = productionDetails
      .map(d => `${d.shipType} x${d.count}`)
      .join(', ');

    return {
      success: true,
      message: `${planet.name}에서 함선 생산을 시작했습니다. [${orderSummary}] 소요 시간: ${totalTime} 게임시간, 비용: ${totalCost}`,
      effects: [
        {
          type: 'resource_change',
          resource: 'supplies',
          amount: -totalCost,
        },
        {
          type: 'production_started',
          planetId,
          planetName: planet.name,
          orders: productionDetails,
          duration: totalTime,
        },
      ],
    };
  }
}
