/**
 * BaseTacticalCommand - Tactical 커맨드를 BaseLoghCommand 인터페이스에 맞게 래핑
 * 
 * Tactical Commands는 실시간 전투용이므로 Strategic Commands와 다른 구조를 가집니다.
 * 이 어댑터 클래스는 두 시스템 간의 호환성을 제공합니다.
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';

export interface ITacticalCommand {
  getName(): string;
  getDisplayName(): string;
  getDescription(): string;
  getShortcut?(): string;
  getExecutionDelay?(): number;
  getExecutionDuration?(): number;
  execute(fleetId: string, params: any): Promise<{ success: boolean; message: string }>;
}

/**
 * Tactical Command를 BaseLoghCommand로 래핑하는 어댑터 클래스
 */
export abstract class BaseTacticalCommand extends BaseLoghCommand {
  abstract getShortcut(): string;
  abstract getExecutionDelay(): number;
  abstract getExecutionDuration(): number;
  
  /**
   * Tactical 커맨드는 실시간 전투용이므로 category는 항상 'tactical'
   */
  getCategory(): 'tactical' {
    return 'tactical';
  }

  /**
   * Tactical 커맨드는 실시간이므로 CP 소모 없음 (전투 중 실행)
   */
  getRequiredCommandPoints(): number {
    return 0;
  }

  /**
   * Tactical 커맨드는 즉시 실행되므로 턴 소요 없음
   */
  getRequiredTurns(): number {
    return 0;
  }

  /**
   * BaseLoghCommand의 execute를 Tactical execute로 변환
   */
  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const fleetId = context.fleet?.fleetId || context.commander.getFleetId();
    
    if (!fleetId) {
      return {
        success: false,
        message: '함대 정보를 찾을 수 없습니다.',
        effects: [],
      };
    }

    const params = {
      sessionId: context.session.session_id,
      ...context.env,
    };

    // Tactical execute 호출
    const result = await this.executeTactical(fleetId, params);

    return {
      success: result.success,
      message: result.message,
      effects: [],
    };
  }

  /**
   * Tactical 커맨드의 실제 실행 로직 (서브클래스에서 구현)
   */
  abstract executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }>;
}
