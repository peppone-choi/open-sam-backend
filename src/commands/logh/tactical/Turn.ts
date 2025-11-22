/**
 * [전술] 회전 (回転, Turn)
 * 함대 방향 전환
 * 
 * 기능:
 * - 함대 진행 방향(heading) 변경
 * - 특정 각도로 회전 또는 특정 목표 방향으로 회전
 * - 측면/후방 공격에 대응
 * - 회전 속도는 함대 기동력에 비례
 */

import { Fleet } from '../../../models/logh/Fleet.model';

export class TurnTacticalCommand {
  getName(): string {
    return 'turn';
  }

  getDisplayName(): string {
    return '회전';
  }

  getDescription(): string {
    return '함대 방향을 전환합니다. 특정 각도 또는 목표 지점을 향해 회전합니다.';
  }

  getShortcut(): string {
    return 't';
  }

  getExecutionDelay(): number {
    return 5; // 5 게임시간 (12.5초)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 각도 정규화 (0-360)
   */
  private normalizeAngle(angle: number): number {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }

  /**
   * 두 각도 사이의 최단 회전 각도 계산
   * 시계방향이면 양수, 반시계방향이면 음수
   */
  private getShortestRotation(currentAngle: number, targetAngle: number): number {
    const current = this.normalizeAngle(currentAngle);
    const target = this.normalizeAngle(targetAngle);
    
    let diff = target - current;
    
    // 최단 경로 선택
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    return diff;
  }

  /**
   * 두 점 사이의 방향 각도 계산
   */
  private calculateAngleToTarget(from: { x: number; y: number }, to: { x: number; y: number }): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // atan2는 -π ~ π 반환, 이를 0~360도로 변환
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return this.normalizeAngle(angle);
  }

  /**
   * 회전 소요 시간 계산 (각도와 기동력에 따라)
   */
  private calculateTurnDuration(rotationAngle: number, mobility: number): number {
    // 기본: 90도 회전에 10 게임시간
    // 기동력에 따라 조정 (기동력 100 = 100%, 50 = 50% 속도)
    const baseDuration = Math.abs(rotationAngle) / 90 * 10;
    const mobilityFactor = mobility / 100;
    return Math.ceil(baseDuration / mobilityFactor);
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, targetAngle, targetX, targetY, relative } = params;

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

    const currentHeading = fleet.tacticalPosition.heading || 0;
    let newHeading: number;
    let rotationAngle: number;

    // 회전 방식 결정
    if (targetX !== undefined && targetY !== undefined) {
      // 특정 좌표를 향해 회전
      newHeading = this.calculateAngleToTarget(
        { x: fleet.tacticalPosition.x, y: fleet.tacticalPosition.y },
        { x: targetX, y: targetY }
      );
      rotationAngle = this.getShortestRotation(currentHeading, newHeading);
    } else if (targetAngle !== undefined) {
      if (relative) {
        // 상대 각도 회전 (현재 방향 기준)
        rotationAngle = targetAngle;
        newHeading = this.normalizeAngle(currentHeading + targetAngle);
      } else {
        // 절대 각도로 회전
        newHeading = this.normalizeAngle(targetAngle);
        rotationAngle = this.getShortestRotation(currentHeading, newHeading);
      }
    } else {
      return {
        success: false,
        message: '회전 목표를 지정해야 합니다. (각도 또는 좌표를 입력)',
      };
    }

    // 회전이 필요 없으면
    if (Math.abs(rotationAngle) < 1) {
      return {
        success: false,
        message: '이미 목표 방향을 향하고 있습니다.',
      };
    }

    // 기동력 가져오기 (기본값 50)
    const mobility = fleet.customData?.effectiveMobility || 50;

    // 회전 소요 시간 계산
    const turnDuration = this.calculateTurnDuration(rotationAngle, mobility);

    // 함대 방향 업데이트
    fleet.tacticalPosition.heading = newHeading;

    // 회전 중 상태 저장
    if (!fleet.customData) fleet.customData = {};
    fleet.customData.isTurning = true;
    fleet.customData.turnStartTime = new Date();
    fleet.customData.turnDuration = turnDuration;

    // 로그 기록
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'turn',
      fromHeading: currentHeading,
      toHeading: newHeading,
      rotationAngle,
      duration: turnDuration,
    });

    await fleet.save();

    const direction = rotationAngle > 0 ? '시계방향' : '반시계방향';
    const absAngle = Math.abs(rotationAngle).toFixed(1);

    return {
      success: true,
      message: `함대가 ${direction}으로 ${absAngle}도 회전합니다. (소요 시간: ${turnDuration} 게임시간)`,
    };
  }

  /**
   * 빠른 회전 명령 (90도 단위)
   */
  static async quickTurn(fleetId: string, sessionId: string, direction: 'left' | 'right' | 'back'): Promise<any> {
    const command = new TurnTacticalCommand();
    
    let relativeAngle: number;
    switch (direction) {
      case 'left':
        relativeAngle = -90;
        break;
      case 'right':
        relativeAngle = 90;
        break;
      case 'back':
        relativeAngle = 180;
        break;
      default:
        return { success: false, message: '잘못된 방향입니다.' };
    }

    return command.execute(fleetId, {
      sessionId,
      targetAngle: relativeAngle,
      relative: true,
    });
  }
}
