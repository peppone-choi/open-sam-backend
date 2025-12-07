/**
 * 봉토 수여 (封土授与) - Fief Grant Command
 * 남작 이상 작위 보유 인물에게 봉토를 수여하는 황제 전용 커맨드
 * 
 * 봉토 = 영지로서 세금 수입을 받는 행성
 * 작위별 최대 봉토 수:
 * - 기사: 0개 (봉토 불가)
 * - 남작: 1개
 * - 자작: 2개
 * - 백작: 3개
 * - 후작: 5개
 * - 공작: 10개
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { nobilityService } from '../../../services/gin7/NobilityService';
import { NOBILITY_RANKS } from '../../../types/gin7/nobility.types';

export class FiefGrantCommand extends BaseLoghCommand {
  getName(): string {
    return 'fief_grant';
  }

  getDisplayName(): string {
    return '봉토 수여';
  }

  getDescription(): string {
    return '남작 이상 작위 보유 인물에게 봉토(영지)를 수여합니다. 봉토에서 세금 수입을 받습니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 640;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 제국 소속 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => ctx.commander.getFactionType() === 'empire',
        '봉토는 제국에서만 수여할 수 있습니다.'
      )
    );

    // 황제 권한 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          return data.jobPosition === '황제' ||
            data.authorityCards?.includes('EMPEROR') ||
            data.authorityCards?.includes('FIEF_GRANT');
        },
        '봉토를 수여할 권한이 없습니다. (황제 전용)'
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

    // 대상자 번호와 봉토로 수여할 행성 ID 확인
    const targetNo = env?.targetCommanderNo as number;
    const planetId = env?.planetId as string;

    if (!targetNo) {
      return {
        success: false,
        message: '대상자를 지정해주세요. (targetCommanderNo)',
      };
    }

    if (!planetId) {
      return {
        success: false,
        message: '봉토로 수여할 행성을 지정해주세요. (planetId)',
      };
    }

    // NobilityService를 통해 봉토 수여 실행
    const result = await nobilityService.grantFief(
      commander.session_id,
      commander.no,
      targetNo,
      planetId
    );

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: true,
      message: result.message,
      effects: [
        {
          type: 'fief_grant',
          targetCommanderNo: targetNo,
          fief: result.fief,
        },
      ],
    };
  }

  /**
   * 봉토 회수 (서브 커맨드)
   */
  static async revokeFief(
    context: ILoghCommandContext,
    targetNo: number,
    planetId: string
  ): Promise<{ success: boolean; message: string }> {
    const { commander } = context;

    return await nobilityService.revokeFief(
      commander.session_id,
      commander.no,
      targetNo,
      planetId
    );
  }
}
