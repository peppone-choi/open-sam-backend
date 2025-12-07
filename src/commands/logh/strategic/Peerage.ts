/**
 * 서작 (叙爵) - Peerage Command
 * 귀족 작위를 수여하는 황제 전용 커맨드
 * 
 * 작위 등급: 기사 → 남작 → 자작 → 백작 → 후작 → 공작
 * 제국 전용 시스템
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { nobilityService } from '../../../services/gin7/NobilityService';
import { NobilityRank, NOBILITY_RANKS } from '../../../types/gin7/nobility.types';

export class PeerageCommand extends BaseLoghCommand {
  getName(): string {
    return 'peerage';
  }

  getDisplayName(): string {
    return '서작';
  }

  getDescription(): string {
    return '귀족 작위를 수여합니다. 황제 전용 커맨드이며, 제국 소속 인물에게만 수여할 수 있습니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 제국 소속 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => ctx.commander.getFactionType() === 'empire',
        '작위는 제국에서만 수여할 수 있습니다.'
      )
    );

    // 황제 권한 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          return data.jobPosition === '황제' ||
            data.authorityCards?.includes('EMPEROR') ||
            data.authorityCards?.includes('PEERAGE_GRANT');
        },
        '작위를 수여할 권한이 없습니다. (황제 전용)'
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

    // 대상자 번호와 수여할 작위 확인
    const targetNo = env?.targetCommanderNo as number;
    const newRank = env?.newRank as NobilityRank;

    if (!targetNo) {
      return {
        success: false,
        message: '대상자를 지정해주세요. (targetCommanderNo)',
      };
    }

    if (!newRank || !NOBILITY_RANKS[newRank]) {
      return {
        success: false,
        message: `유효한 작위를 지정해주세요. (knight, baron, viscount, count, marquis, duke)`,
      };
    }

    // NobilityService를 통해 서작 실행
    const result = await nobilityService.ennoble(
      commander.session_id,
      commander.no,
      targetNo,
      newRank
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

    const rankInfo = NOBILITY_RANKS[newRank];

    return {
      success: true,
      message: result.message,
      effects: [
        {
          type: 'peerage',
          targetCommanderNo: targetNo,
          previousRank: result.previousRank,
          newRank: result.newRank,
          rankName: rankInfo.name,
          rankNameEn: rankInfo.nameEn,
        },
      ],
    };
  }

  /**
   * 사용 가능한 작위 목록 반환
   */
  static getAvailableRanks(): { rank: NobilityRank; name: string; nameEn: string; minMerit: number }[] {
    return Object.values(NOBILITY_RANKS).map(info => ({
      rank: info.rank,
      name: info.name,
      nameEn: info.nameEn,
      minMerit: info.minMerit,
    }));
  }
}
