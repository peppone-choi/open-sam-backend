/**
 * [전술] 대열 명령 (隊列命令)
 * 함선 그룹화 및 대열 변경
 */

import { Fleet } from '../../../models/logh/Fleet.model';

export class FormationTacticalCommand {
  getName(): string {
    return 'formation';
  }

  getDisplayName(): string {
    return '대열 명령';
  }

  getDescription(): string {
    return '함선 그룹화 및 대열 변경';
  }

  getShortcut(): string {
    return 'v';
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
