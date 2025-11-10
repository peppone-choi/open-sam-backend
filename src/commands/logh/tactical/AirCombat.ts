/**
 * [전술] 공전 명령 (空戦命令)
 * 지정 적에게 전투정 공격
 */

export class AirCombatTacticalCommand {
  getName(): string {
    return 'air_combat';
  }

  getDisplayName(): string {
    return '공전 명령';
  }

  getDescription(): string {
    return '지정 적에게 전투정 공격';
  }

  getShortcut(): string {
    return 'w';
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
