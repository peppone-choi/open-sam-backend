/**
 * [전술] 정지 명령 (停止命令)
 * 현재 실행 중인 커맨드 취소, 전 유닛 동작 정지
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class StopTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'stop';
  }

  getDisplayName(): string {
    return '정지 명령';
  }

  getDescription(): string {
    return '현재 실행 중인 커맨드 취소, 전 유닛 동작 정지';
  }

  

  getExecutionDelay(): number {
    return 0;
  }

  getExecutionDuration(): number {
    return 0;
  }

  

  getShortcut(): string {
    return 's';
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId } = params;

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

    // 이동 정지
    fleet.isMoving = false;
    fleet.destination = undefined;
    
    if (fleet.tacticalPosition?.velocity) {
      fleet.tacticalPosition.velocity = { x: 0, y: 0 };
      fleet.markModified('tacticalPosition');
    }

    if (!fleet.isInCombat) {
      fleet.status = 'idle';
    }

    await fleet.save();

    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
    };
  }
}
