/**
 * 특별 경비 (Special Security)
 * 특정 경계 스포트의 경비 태세 강화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class SpecialSecurityCommand extends BaseLoghCommand {
  getName(): string {
    return 'special_security';
  }

  getDisplayName(): string {
    return '특별 경비';
  }

  getDescription(): string {
    return '특정 경계 스포트의 경비 태세 강화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 24;
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
