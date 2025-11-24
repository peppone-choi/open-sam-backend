/**
 * [전술] 이동 (移動, Move)
 * 선택 함선을 지정 위치로 이동
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class MoveTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'move';
  }

  getDisplayName(): string {
    return '이동';
  }

  getDescription(): string {
    return '선택 함선을 지정 위치로 이동';
  }

  getShortcut(): string {
    return 'f';
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
    const { sessionId, destination } = params;

    if (!destination || destination.x === undefined || destination.y === undefined) {
      return {
        success: false,
        message: '이동 목적지를 지정해주세요.',
      };
    }

    // 함대 조회
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

    // 전투 중이 아니면 전략 맵 이동
    if (!fleet.isInCombat) {
      // 전략 맵 이동 (그리드 좌표)
      fleet.destination = {
        x: Math.floor(destination.x),
        y: Math.floor(destination.y),
      };
      fleet.isMoving = true;
      fleet.status = 'moving';
    } else {
      // 전투 중이면 전술 맵 이동
      if (!fleet.tacticalPosition) {
        fleet.tacticalPosition = {
          x: fleet.strategicPosition.x * 100,
          y: fleet.strategicPosition.y * 100,
          velocity: { x: 0, y: 0 },
          heading: 0,
        };
      }

      // 목적지 설정
      fleet.destination = destination;
      fleet.isMoving = true;

      // 이동 방향 계산
      const dx = destination.x - fleet.tacticalPosition.x;
      const dy = destination.y - fleet.tacticalPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // 속도 벡터 설정
        fleet.tacticalPosition.velocity = {
          x: (dx / distance) * fleet.movementSpeed,
          y: (dy / distance) * fleet.movementSpeed,
        };

        // 진행 방향 설정 (각도)
        fleet.tacticalPosition.heading = Math.atan2(dy, dx) * (180 / Math.PI);
      }
    }

    await fleet.save();

    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
    };
  }
}
