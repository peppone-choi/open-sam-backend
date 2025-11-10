/**
 * [전술] 평행 이동 (平行移動)
 * 정면 방향 유지하며 이동. 속도 50%
 */

export class ParallelMoveTacticalCommand {
  getName(): string {
    return 'parallel_move';
  }

  getDisplayName(): string {
    return '평행 이동';
  }

  getDescription(): string {
    return '정면 방향 유지하며 이동. 속도 50%';
  }

  getShortcut(): string {
    return 'd';
  }

  getExecutionDelay(): number {
    return 5;
  }

  getExecutionDuration(): number {
    return 0;
  }

  getSpeedPenalty(): number {
    return 0.5;
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
