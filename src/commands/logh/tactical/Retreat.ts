/**
 * [전술] 철퇴 명령 (撤退命令)
 * 그리드에서 철퇴 (단거리 워프)
 */

export class RetreatTacticalCommand {
  getName(): string {
    return 'retreat';
  }

  getDisplayName(): string {
    return '철퇴 명령';
  }

  getDescription(): string {
    return '그리드에서 철퇴 (단거리 워프)';
  }

  

  getExecutionDelay(): number {
    return 5;
  }

  getExecutionDuration(): number {
    return 150;
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
