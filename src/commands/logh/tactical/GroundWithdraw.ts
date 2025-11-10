/**
 * [전술] 육전대 철수 (陸戦隊撤収)
 * 강하/출격한 육전대 철수(탑재)
 */

export class GroundWithdrawTacticalCommand {
  getName(): string {
    return 'ground_withdraw';
  }

  getDisplayName(): string {
    return '육전대 철수';
  }

  getDescription(): string {
    return '강하/출격한 육전대 철수(탑재)';
  }

  

  getExecutionDelay(): number {
    return 5;
  }

  getExecutionDuration(): number {
    return 20;
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
