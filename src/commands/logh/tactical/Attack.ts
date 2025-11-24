/**
 * [전술] 공격 명령 (攻撃命令, Attack)
 * 사정거리 내 적에게 자동 공격
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class AttackTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'attack';
  }

  getDisplayName(): string {
    return '공격 명령';
  }

  getDescription(): string {
    return '사정거리 내 적에게 자동 공격';
  }

  getShortcut(): string {
    return 'r';
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
    const { sessionId, targetFleetId } = params;

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

    // 목표가 지정되지 않았으면 자동 목표 탐색
    let targetFleet;
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

      // 아군 공격 경고 (허용은 하되 경고)
      if (targetFleet.faction === fleet.faction) {
        // 아군 공격 시 사기 하락
        fleet.morale = Math.max(0, fleet.morale - 10);
        
        // 충성도 있는 함선은 명령 거부 가능성
        if (Math.random() * 100 > fleet.training.discipline) {
          return {
            success: false,
            message: '함대가 아군 공격 명령을 거부했습니다. (군기 부족)',
          };
        }
      }
    } else {
      // 자동 목표 탐색: 같은 전술 맵의 가장 가까운 적
      const enemies = await Fleet.find({
        session_id: sessionId,
        tacticalMapId: fleet.tacticalMapId,
        faction: { $ne: fleet.faction },
        isInCombat: true,
      });

      if (enemies.length === 0) {
        return {
          success: false,
          message: '공격 가능한 적이 없습니다.',
        };
      }

      // 가장 가까운 적 선택
      let minDistance = Infinity;
      for (const enemy of enemies) {
        if (!fleet.tacticalPosition || !enemy.tacticalPosition) continue;

        const dx = enemy.tacticalPosition.x - fleet.tacticalPosition.x;
        const dy = enemy.tacticalPosition.y - fleet.tacticalPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          targetFleet = enemy;
        }
      }

      if (!targetFleet) {
        return {
          success: false,
          message: '공격 가능한 적이 없습니다.',
        };
      }
    }

    // 사정거리 확인
    if (fleet.tacticalPosition && targetFleet.tacticalPosition) {
      const dx = targetFleet.tacticalPosition.x - fleet.tacticalPosition.x;
      const dy = targetFleet.tacticalPosition.y - fleet.tacticalPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > (fleet.combatRange || 100)) {
        return {
          success: false,
          message: `목표가 사정거리 밖입니다. (거리: ${Math.floor(distance)}, 사정거리: ${fleet.combatRange})`,
        };
      }

      // 공격력 계산 (간단한 버전)
      const attackPower = fleet.totalStrength * 0.1 * (fleet.morale / 100);
      const damage = Math.max(1, Math.floor(attackPower));

      // 목표 함대에 피해 입히기
      // 함선 HP를 랜덤으로 감소
      let remainingDamage = damage;
      for (const ship of targetFleet.ships) {
        if (remainingDamage <= 0) break;
        
        const shipDamage = Math.min(remainingDamage, ship.count * (ship.health || 100) * 0.01);
        const healthReduction = shipDamage / ship.count;
        ship.health = Math.max(0, (ship.health || 100) - healthReduction);
        
        // HP 0 이하인 함선 제거
        if (ship.health <= 0) {
          ship.count = 0;
        }
        
        remainingDamage -= shipDamage;
      }

      // 총 함선 수 재계산
      targetFleet.totalShips = targetFleet.ships.reduce((sum, ship) => sum + ship.count, 0);
      targetFleet.markModified('ships');
      
      await fleet.save();
      await targetFleet.save();

      return {
        success: true,
        message: `${targetFleet.name}에게 ${damage} 피해를 입혔습니다.`,
      };
    }

    return {
      success: false,
      message: '공격을 실행할 수 없습니다.',
    };
  }
}
