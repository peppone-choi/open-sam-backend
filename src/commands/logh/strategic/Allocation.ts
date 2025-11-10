/**
 * 할당 (Allocation)
 * 행성 창고에서 부대 창고로 유닛/물자 할당
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class AllocationCommand extends BaseLoghCommand {
  getName(): string {
    return 'allocation';
  }

  getDisplayName(): string {
    return '할당';
  }

  getDescription(): string {
    return '행성 창고에서 부대 창고로 유닛/물자 할당';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 15;
  }

  getRequiredTurns(): number {
    return 60;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    
    // 제약 조건: 재편성/보충 실행 중 불가
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          // TODO: 구체적인 제약 조건 구현
          return true;
        },
        '재편성/보충 실행 중 불가'
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

    // TODO: 커맨드별 구체적인 실행 로직 구현
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
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
