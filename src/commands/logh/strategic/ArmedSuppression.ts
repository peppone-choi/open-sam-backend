/**
 * 무력 진압 (Armed Suppression)
 * 주둔 중인 육전대로 치안 유지율 증가. 정부 지지율 하락 가능성
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class ArmedSuppressionCommand extends BaseLoghCommand {
  getName(): string {
    return 'armed_suppression';
  }

  getDisplayName(): string {
    return '무력 진압';
  }

  getDescription(): string {
    return '주둔 중인 육전대로 치안 유지율 증가. 정부 지지율 하락 가능성';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // FUTURE: 커맨드별 구체적인 실행 로직 구현 (v2.0)
    // 현재는 기본 구현만 제공

    await commander.save();

    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
      effects: [
        {
          type: 'command_executed',
          commandType: this.getName(),
          cpCost: this.getRequiredCommandPoints(),
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
