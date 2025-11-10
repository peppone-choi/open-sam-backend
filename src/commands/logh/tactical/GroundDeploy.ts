/**
 * [전술] 육전대 출격 (陸戦隊出撃)
 * 육전대를 행성/요새로 강하/출격
 */

export class GroundDeployTacticalCommand {
  getName(): string {
    return 'ground_deploy';
  }

  getDisplayName(): string {
    return '육전대 출격';
  }

  getDescription(): string {
    return '육전대를 행성/요새로 강하/출격';
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
