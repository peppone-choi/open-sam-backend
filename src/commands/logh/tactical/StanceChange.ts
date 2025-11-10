/**
 * [전술] 태세 변경 (態勢変更)
 * 함정 태세 변경
 */

export class StanceChangeTacticalCommand {
  getName(): string {
    return 'stance_change';
  }

  getDisplayName(): string {
    return '태세 변경';
  }

  getDescription(): string {
    return '함정 태세 변경';
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
