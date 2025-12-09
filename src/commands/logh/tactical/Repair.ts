/**
 * [전술] 수리 명령 (修理命令, Repair)
 * 공작함이 아군 함선의 손상된 부위를 수리
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class RepairTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'repair';
  }

  getDisplayName(): string {
    return '수리 명령';
  }

  getDescription(): string {
    return '공작함이 아군 함선의 손상된 부위를 수리합니다. 수리 중에는 회피 불가.';
  }

  getShortcut(): string {
    return 'p';
  }

  getExecutionDelay(): number {
    return 10; // 수리 준비 시간
  }

  getExecutionDuration(): number {
    return 0; // 지속 시간은 부위별로 다름
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const { sessionId, targetFleetId, targetComponent } = params;

    // 아군 함대 조회 (공작함 포함)
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 공작함 확인
    const engineeringShips = fleet.ships.filter(
      (ship) => ship.type === '공병함' || ship.type === 'engineering'
    );

    if (engineeringShips.length === 0 || engineeringShips.every(s => s.count === 0)) {
      return {
        success: false,
        message: '함대에 공작함이 없습니다.',
      };
    }

    // 수리 대상 함대 조회
    const targetFleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId: targetFleetId,
    });

    if (!targetFleet) {
      return {
        success: false,
        message: '수리 대상 함대를 찾을 수 없습니다.',
      };
    }

    // 아군 확인
    if (targetFleet.faction !== fleet.faction) {
      return {
        success: false,
        message: '아군 함대만 수리할 수 있습니다.',
      };
    }

    // 전투 중인지 확인
    if (!fleet.isInCombat) {
      return {
        success: false,
        message: '전투 중이 아닙니다. 전투 중에만 야전 수리가 가능합니다.',
      };
    }

    // 같은 전술 맵에 있는지 확인
    if (fleet.tacticalMapId !== targetFleet.tacticalMapId) {
      return {
        success: false,
        message: '같은 전술 맵에 있어야 수리할 수 있습니다.',
      };
    }

    // 수리 거리 확인 (공작함 사정거리)
    if (fleet.tacticalPosition && targetFleet.tacticalPosition) {
      const dx = targetFleet.tacticalPosition.x - fleet.tacticalPosition.x;
      const dy = targetFleet.tacticalPosition.y - fleet.tacticalPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const repairRange = 150; // 수리 사정거리
      if (distance > repairRange) {
        return {
          success: false,
          message: `수리 대상이 너무 멀리 있습니다. (거리: ${Math.floor(distance)}, 사정거리: ${repairRange})`,
        };
      }
    }

    // 부위 검증
    const validComponents = ['HULL', 'ENGINE', 'BRIDGE', 'MAIN_WEAPON', 'HANGAR'];
    if (!validComponents.includes(targetComponent)) {
      return {
        success: false,
        message: `유효하지 않은 수리 부위입니다. (${validComponents.join(', ')})`,
      };
    }

    // 수리 시작 (실제 로직은 TacticalSession에서 처리)
    return {
      success: true,
      message: `${targetFleet.name}의 ${this.getComponentDisplayName(targetComponent)} 수리를 시작합니다.`,
      data: {
        repairShipFleetId: fleetId,
        targetFleetId,
        targetComponent,
        repairType: 'FIELD',
      },
    };
  }

  /**
   * 부위 표시 이름
   */
  private getComponentDisplayName(component: string): string {
    const names: Record<string, string> = {
      HULL: '선체',
      ENGINE: '기관',
      BRIDGE: '함교',
      MAIN_WEAPON: '주포',
      HANGAR: '격납고',
    };
    return names[component] || component;
  }
}













