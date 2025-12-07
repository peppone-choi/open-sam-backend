/**
 * 처단 (処断, Punishment)
 * 구금된 인물에 대한 즉결 처분 결정
 * 군사 재판 없이 즉시 처분 (높은 권한 필요)
 * 유형: 석방, 강등, 즉결처형
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint, demote, getRankName } from '../../../utils/logh-rank-system';

// 처분 유형
export type PunishmentType = 'release' | 'demotion' | 'summary_execution';

export class PunishmentCommand extends BaseLoghCommand {
  getName(): string {
    return 'punishment';
  }

  getDisplayName(): string {
    return '처단';
  }

  getDescription(): string {
    return '구금된 인물에 대한 즉결 처분 (석방/강등/즉결처형)';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 320;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [
      // 대장(상급대장) 이상만 즉결 처분 가능
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getRank() <= 3,
        '즉결 처분을 내리려면 대장 이상의 계급이 필요합니다.'
      ),
    ];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    const targetCommanderNo = env?.targetCommanderNo;
    const punishmentType = env?.punishmentType as PunishmentType | undefined;

    if (!targetCommanderNo) {
      return { success: false, message: '처분 대상을 지정해주세요.' };
    }

    if (!punishmentType) {
      return { success: false, message: '처분 유형을 지정해주세요. (release/demotion/summary_execution)' };
    }

    // 대상 캐릭터 조회
    const targetCommander = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: targetCommanderNo,
    });

    if (!targetCommander) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 구금 상태 확인
    if (targetCommander.status !== 'imprisoned') {
      return { success: false, message: '구금된 인물만 처분할 수 있습니다.' };
    }

    // 같은 세력인지 확인
    if (targetCommander.faction !== commander.getFactionType()) {
      return { success: false, message: '같은 세력의 인물만 처분할 수 있습니다.' };
    }

    // 상급자는 처분 불가
    if (!canAppoint(commander.getRank(), targetCommander.getRankName(), targetCommander.faction)) {
      return { success: false, message: '자신보다 계급이 높은 인물은 처분할 수 없습니다.' };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    const effects: any[] = [];
    let resultMessage = '';

    switch (punishmentType) {
      case 'release':
        // 석방
        targetCommander.status = 'active';
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.wanted = false;
        targetCommander.customData.releasedAt = new Date();
        targetCommander.customData.releasedBy = commander.no;
        effects.push({
          type: 'release',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
        });
        resultMessage = `${targetCommander.name}을(를) 석방했습니다.`;
        break;

      case 'demotion':
        // 강등 후 석방 (2단계 강등)
        const beforeRankName = getRankName(targetCommander.rank, targetCommander.faction);
        const afterRankName = demote(beforeRankName, targetCommander.faction, 2);
        targetCommander.rank = Math.min(20, targetCommander.rank + 2);
        targetCommander.status = 'active';
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.wanted = false;
        targetCommander.customData.demotedAt = new Date();
        targetCommander.customData.demotedBy = commander.no;
        effects.push({
          type: 'demotion',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
          beforeRank: beforeRankName,
          afterRank: afterRankName,
          levels: 2,
        });
        resultMessage = `${targetCommander.name}을(를) ${beforeRankName}에서 ${afterRankName}(으)로 강등 후 석방했습니다.`;
        break;

      case 'summary_execution':
        // 즉결 처형 (원수/상급대장만 가능)
        if (commander.getRank() > 2) {
          return { success: false, message: '즉결 처형은 원수 또는 상급대장만 명령할 수 있습니다.' };
        }
        targetCommander.status = 'executed';
        targetCommander.isActive = false;
        targetCommander.fleetId = null;
        targetCommander.jobPosition = null;
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.executedAt = new Date();
        targetCommander.customData.executedBy = commander.no;
        targetCommander.customData.executionType = 'summary';
        effects.push({
          type: 'summary_execution',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
          executedBy: commander.name,
        });
        resultMessage = `${targetCommander.name}을(를) 즉결 처형했습니다.`;

        // 즉결 처형은 명성에 영향
        commander.fame = Math.max(0, (commander.fame || 0) - 5);
        break;

      default:
        return { success: false, message: '올바른 처분 유형을 지정해주세요.' };
    }

    // 처분 기록 저장
    targetCommander.customData.punishmentHistory = targetCommander.customData.punishmentHistory || [];
    targetCommander.customData.punishmentHistory.push({
      date: new Date(),
      executorNo: commander.no,
      executorName: commander.name,
      type: punishmentType,
    });

    targetCommander.markModified('customData');
    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: resultMessage,
      effects,
    };
  }
}
