/**
 * 작전 계획 (Operation Planning)
 * 점령/방어/소탕 작전 계획 수립
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class OperationPlanCommand extends BaseLoghCommand {
  getName(): string {
    return 'operation_plan';
  }

  getDisplayName(): string {
    return '작전 계획';
  }

  getDescription(): string {
    return '점령/방어/소탕 작전 계획 수립';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 50; // Variable cost based on operation timing, base 50
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    
    // 제약 조건: 발동 예정 시기에 따라 CP 비용 변동. 작전 기간 30일
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          // FUTURE: 구체적인 제약 조건 구현 (v2.0)
          return true;
        },
        '발동 예정 시기에 따라 CP 비용 변동. 작전 기간 30일'
      )
    );
    

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
