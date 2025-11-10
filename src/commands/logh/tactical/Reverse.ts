/**
 * [전술] 반전 (反転)
 * 제자리에서 180도 회두. 기동 능력에 따라 속도 변화
 */

export class ReverseTacticalCommand {
  getName(): string {
    return 'reverse';
  }

  getDisplayName(): string {
    return '반전';
  }

  getDescription(): string {
    return '제자리에서 180도 회두. 기동 능력에 따라 속도 변화';
  }

  

  getExecutionDelay(): number {
    return 10;
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
