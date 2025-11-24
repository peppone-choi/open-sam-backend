/**
 * [전술] 사격 명령 (射撃命令, Fire)
 * 지정 적에게 일시 공격 (Attack보다 더 강력하지만 재사용 대기시간 있음)
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class FireTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'fire';
  }

  getDisplayName(): string {
    return '사격 명령';
  }

  getDescription(): string {
    return '지정 적에게 일시 공격';
  }

  getShortcut(): string {
    return 'e';
  }

  getExecutionDelay(): number {
    return 5;
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, targetFleetId, targetX, targetY } = params;

    // 아군 함대 조회
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

    if (!fleet.isInCombat) {
      return {
        success: false,
        message: '전투 중이 아닙니다.',
      };
    }

    // 목표 함대 또는 좌표 확인
    let targetFleet;
    let targetPosition = { x: targetX, y: targetY };

    if (targetFleetId) {
      targetFleet = await Fleet.findOne({
        session_id: sessionId,
        fleetId: targetFleetId,
      });

      if (!targetFleet) {
        return {
          success: false,
          message: '목표를 찾을 수 없습니다.',
        };
      }

      // 아군 공격 경고 (허용은 하되 경고 및 페널티)
      if (targetFleet.faction === fleet.faction) {
        // 아군 일제 사격 시 큰 사기 하락
        fleet.morale = Math.max(0, fleet.morale - 20);
        
        // 군기가 높아야만 아군 공격 가능
        if (fleet.training.discipline < 70) {
          return {
            success: false,
            message: '아군 일제 사격은 군기 70 이상일 때만 가능합니다. (현재: ' + fleet.training.discipline + ')',
          };
        }
        
        // 확인 메시지 (실제로는 프론트엔드에서 처리해야 하지만 시뮬레이션)
        if (!params.confirmFriendlyFire) {
          return {
            success: false,
            message: '⚠️ 아군에게 일제 사격을 가합니다. 사격 허용 여부를 다시 확인해주세요.',
          };
        }
      }

      if (targetFleet.tacticalPosition) {
        targetPosition = {
          x: targetFleet.tacticalPosition.x,
          y: targetFleet.tacticalPosition.y,
        };
      }
    } else if (targetX === undefined || targetY === undefined) {
      return {
        success: false,
        message: '목표 함대 또는 좌표를 지정해주세요.',
      };
    }

    // 사정거리 확인
    if (fleet.tacticalPosition) {
      const dx = targetPosition.x - fleet.tacticalPosition.x;
      const dy = targetPosition.y - fleet.tacticalPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > (fleet.combatRange || 100)) {
        return {
          success: false,
          message: `목표가 사정거리 밖입니다. (거리: ${Math.floor(distance)}, 사정거리: ${fleet.combatRange})`,
        };
      }

      // 일제 사격 - Attack보다 1.5배 강력
      const attackPower = fleet.totalStrength * 0.15 * (fleet.morale / 100);
      const damage = Math.max(1, Math.floor(attackPower));

      // 목표 함대가 있으면 피해 입히기
      if (targetFleet) {
        let remainingDamage = damage;
        for (const ship of targetFleet.ships) {
          if (remainingDamage <= 0) break;
          
          const shipDamage = Math.min(remainingDamage, ship.count * (ship.health || 100) * 0.01);
          const healthReduction = shipDamage / ship.count;
          ship.health = Math.max(0, (ship.health || 100) - healthReduction);
          
          // HP 0 이하인 함선 격침
          if (ship.health <= 0) {
            ship.count = 0;
          }
          
          remainingDamage -= shipDamage;
        }

        // 총 함선 수 재계산
        targetFleet.totalShips = targetFleet.ships.reduce((sum, ship) => sum + ship.count, 0);
        targetFleet.markModified('ships');
        await targetFleet.save();
      }

      // 보급품 소모 (일제 사격은 비용이 듦)
      fleet.supplies = Math.max(0, fleet.supplies - Math.floor(fleet.totalShips * 0.1));

      await fleet.save();

      return {
        success: true,
        message: targetFleet 
          ? `${targetFleet.name}에게 일제 사격으로 ${damage} 피해를 입혔습니다.`
          : `좌표 (${Math.floor(targetX)}, ${Math.floor(targetY)})에 일제 사격을 실행했습니다.`,
      };
    }

    return {
      success: false,
      message: '사격을 실행할 수 없습니다.',
    };
  }
}
