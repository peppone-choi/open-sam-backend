/**
 * 재편성 (再編成, Reorganization)
 * 부대 내 함선 구성 변경 (함종 교체, 수량 조정)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

interface ReorganizationChange {
  shipType: string;
  changeAmount: number; // 양수: 추가, 음수: 제거
}

export class ReorganizationCommand extends BaseLoghCommand {
  getName(): string {
    return 'reorganization';
  }

  getDisplayName(): string {
    return '재편성';
  }

  getDescription(): string {
    return '부대 내 함선 구성 변경 (함종 교체, 수량 조정)';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 4; // 재편성 작업 시간
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

    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return {
        success: false,
        message: '함대를 보유하지 않았습니다.',
      };
    }

    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 재편성 변경 사항
    const changes: ReorganizationChange[] = env.changes || [];

    if (!changes || changes.length === 0) {
      return {
        success: false,
        message: '재편성할 함선 구성을 지정해야 합니다.',
      };
    }

    // 행성 근처에 있어야 함 (창고 접근 필요)
    const planets = await Planet.find({
      session_id: commander.session_id,
      'gridCoordinates.x': fleet.strategicPosition.x,
      'gridCoordinates.y': fleet.strategicPosition.y,
      faction: fleet.faction,
    });

    if (planets.length === 0) {
      return {
        success: false,
        message: '재편성은 아군 행성 근처(창고)에서만 가능합니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 재편성 적용
    const changesApplied: any[] = [];

    for (const change of changes) {
      const shipIndex = fleet.ships.findIndex(s => s.type === change.shipType);

      if (change.changeAmount > 0) {
        // 함선 추가
        if (shipIndex >= 0) {
          fleet.ships[shipIndex].count += change.changeAmount;
        } else {
          // 새 함종 추가
          fleet.ships.push({
            type: change.shipType,
            count: change.changeAmount,
            health: 100,
          });
        }
        changesApplied.push({
          type: change.shipType,
          action: 'added',
          amount: change.changeAmount,
        });
      } else if (change.changeAmount < 0) {
        // 함선 제거
        if (shipIndex >= 0) {
          const removeAmount = Math.abs(change.changeAmount);
          const currentCount = fleet.ships[shipIndex].count;
          
          if (currentCount <= removeAmount) {
            // 전부 제거
            fleet.ships.splice(shipIndex, 1);
            changesApplied.push({
              type: change.shipType,
              action: 'removed',
              amount: currentCount,
            });
          } else {
            // 일부 제거
            fleet.ships[shipIndex].count -= removeAmount;
            changesApplied.push({
              type: change.shipType,
              action: 'removed',
              amount: removeAmount,
            });
          }
        }
      }
    }

    // 함대가 비어있으면 안됨
    if (fleet.ships.length === 0 || fleet.ships.every(s => s.count === 0)) {
      return {
        success: false,
        message: '함대에 최소 1척 이상의 함선이 있어야 합니다.',
      };
    }

    // 총 함선 수 재계산
    fleet.totalShips = fleet.ships.reduce((sum, ship) => sum + ship.count, 0);

    fleet.markModified('ships');
    await fleet.save();
    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('reorganization', durationMs, { fleetId, changesApplied });

    const changeSummary = changesApplied
      .map(c => `${c.type}: ${c.action === 'added' ? '+' : '-'}${c.amount}`)
      .join(', ');

    return {
      success: true,
      message: `${planets[0].name}에서 함대 재편성을 시작했습니다. [${changeSummary}] 총 함선: ${fleet.totalShips}척`,
      effects: [
        {
          type: 'fleet_reorganized',
          fleetId,
          changes: changesApplied,
          totalShips: fleet.totalShips,
          location: planets[0].name,
        },
      ],
    };
  }
}
