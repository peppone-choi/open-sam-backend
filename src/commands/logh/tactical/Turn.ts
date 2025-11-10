/**
 * [전술] 선회 (旋回)
 * 포메이션 유지하며 선회
 */

export class TurnTacticalCommand {
  getName(): string {
    return 'turn';
  }

  getDisplayName(): string {
    return '선회';
  }

  getDescription(): string {
    return '포메이션 유지하며 선회';
  }

  getShortcut(): string {
    return 's';
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
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    // TODO: 전술 커맨드 구현
    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
    };
  }
}
