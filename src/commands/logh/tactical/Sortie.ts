/**
 * [전술] 출격 (出撃)
 * 행성/요새에 주류 중인 함선 출격
 */

export class SortieTacticalCommand {
  getName(): string {
    return 'sortie';
  }

  getDisplayName(): string {
    return '출격';
  }

  getDescription(): string {
    return '행성/요새에 주류 중인 함선 출격';
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
