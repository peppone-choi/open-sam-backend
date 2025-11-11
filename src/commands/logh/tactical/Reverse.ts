/**
 * [전술] 후진 (後進, Reverse)
 * 방향 유지하며 후진 이동
 * 
 * 기능:
 * - 현재 진행 방향(heading) 유지
 * - 반대 방향으로 이동 (후진)
 * - 적과의 거리 벌리기
 * - 후진 속도는 전진의 50%
 * - 방어 자세 유지에 유리
 */

import { Fleet } from '../../../models/logh/Fleet.model';

export class ReverseTacticalCommand {
  getName(): string {
    return 'reverse';
  }

  getDisplayName(): string {
    return '후진';
  }

  getDescription(): string {
    return '방향을 유지하며 후진합니다. 적과의 거리를 벌리거나 방어 태세 유지에 유리합니다.';
  }

  getShortcut(): string {
    return 'b';
  }

  getExecutionDelay(): number {
    return 3; // 3 게임시간 (7.5초)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 후진 목표 좌표 계산
   * 현재 방향의 반대 방향으로 distance만큼 이동
   */
  private calculateReversePosition(
    currentPos: { x: number; y: number },
    heading: number,
    distance: number
  ): { x: number; y: number } {
    // heading은 진행 방향, 후진은 반대 방향
    const reverseHeading = (heading + 180) % 360;
    const radians = (reverseHeading * Math.PI) / 180;

    const newX = currentPos.x + Math.cos(radians) * distance;
    const newY = currentPos.y + Math.sin(radians) * distance;

    return { x: newX, y: newY };
  }

  /**
   * 맵 경계 체크 및 보정
   */
  private clampToMapBounds(
    pos: { x: number; y: number },
    mapSize: { width: number; height: number }
  ): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(mapSize.width, pos.x)),
      y: Math.max(0, Math.min(mapSize.height, pos.y)),
    };
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, distance } = params;

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

    // 전술 위치 확인
    if (!fleet.tacticalPosition) {
      return {
        success: false,
        message: '전술 맵에 배치되지 않은 함대입니다.',
      };
    }

    // 기본 후진 거리 (파라미터로 지정 안하면 기본값)
    const reverseDistance = distance || 500; // 기본 500 유닛 후진

    if (reverseDistance <= 0) {
      return {
        success: false,
        message: '후진 거리는 0보다 커야 합니다.',
      };
    }

    const currentPos = {
      x: fleet.tacticalPosition.x,
      y: fleet.tacticalPosition.y,
    };
    const heading = fleet.tacticalPosition.heading || 0;

    // 후진 목표 좌표 계산
    const targetPos = this.calculateReversePosition(currentPos, heading, reverseDistance);

    // 전술 맵 크기 확인 (기본값 10000x10000)
    const mapSize = { width: 10000, height: 10000 };
    // TODO: TacticalMap에서 실제 크기 가져오기

    // 맵 경계 체크
    const clampedTarget = this.clampToMapBounds(targetPos, mapSize);

    // 실제 이동 거리 계산 (경계로 인해 줄어들 수 있음)
    const actualDistance = Math.sqrt(
      Math.pow(clampedTarget.x - currentPos.x, 2) + 
      Math.pow(clampedTarget.y - currentPos.y, 2)
    );

    if (actualDistance < 10) {
      return {
        success: false,
        message: '후진할 공간이 부족합니다. (맵 경계)',
      };
    }

    // 후진 상태 설정
    fleet.destination = clampedTarget;
    fleet.isMoving = true;
    
    // 후진 중임을 표시
    if (!fleet.customData) fleet.customData = {};
    fleet.customData.isReversing = true;
    fleet.customData.reverseStartTime = new Date();

    // 속도 보정 (후진은 전진의 50%)
    const normalSpeed = fleet.movementSpeed || 10;
    fleet.customData.currentSpeed = normalSpeed * 0.5;

    // 로그 기록
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'reverse',
      from: currentPos,
      to: clampedTarget,
      distance: actualDistance,
      heading: heading,
    });

    await fleet.save();

    return {
      success: true,
      message: `함대가 후진합니다. (거리: ${actualDistance.toFixed(0)} 유닛, 속도: 50%)`,
    };
  }

  /**
   * 긴급 후진 (빠른 명령)
   */
  static async emergencyReverse(fleetId: string, sessionId: string): Promise<any> {
    const command = new ReverseTacticalCommand();
    return command.execute(fleetId, {
      sessionId,
      distance: 1000, // 긴급 후진: 1000 유닛
    });
  }
}
