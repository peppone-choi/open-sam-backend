/**
 * 정치가 처단 (政治家処断, Politician Punishment)
 * 구금된 정치가에 대한 처분 결정
 * 
 * 매뉴얼 기준:
 * - 제국: 司法尚書 (사법상서) - 정치가를 체포하고 처단할 권한
 * - 동맹: 法秩序委員長 (법질서위원장) - 정치가를 체포하고 처단할 권한
 * 
 * 소비: 320 PCP (정략 커맨드 포인트)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint, demote, getRankName } from '../../../utils/logh-rank-system';

// 정치가 처분 유형
export type PoliticianPunishmentType = 
  | 'release'           // 석방
  | 'demotion'          // 강등 (직위 박탈)
  | 'exile'             // 추방 (세력에서 제외)
  | 'execution';        // 처형

// 처단 권한이 있는 직책
const PUNISHMENT_AUTHORITY_POSITIONS: Record<string, string[]> = {
  empire: ['司法尚書', '사법상서', 'Minister of Justice'],
  alliance: ['法秩序委員長', '법질서위원장', 'Chairman of Law and Order Committee'],
};

export class PoliticianPunishmentCommand extends BaseLoghCommand {
  getName(): string {
    return 'politician_punishment';
  }

  getDisplayName(): string {
    return '정치가 처단';
  }

  getDescription(): string {
    return '구금된 정치가에 대한 처분 결정 (석방/강등/추방/처형)';
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
    return 'PCP'; // 정략 커맨드 포인트 사용
  }

  /**
   * 처단 권한 확인
   * 사법상서(제국) 또는 법질서위원장(동맹)만 가능
   */
  private hasAuthorityToPunish(commander: any): boolean {
    const faction = commander.getFactionType?.() || commander.faction;
    const jobPosition = commander.jobPosition || '';
    
    const authorizedPositions = PUNISHMENT_AUTHORITY_POSITIONS[faction] || [];
    return authorizedPositions.some(pos => 
      jobPosition.includes(pos) || jobPosition.toLowerCase().includes(pos.toLowerCase())
    );
  }

  getConstraints(): IConstraint[] {
    return [
      // 사법상서/법질서위원장 직책 필요
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => this.hasAuthorityToPunish(input.commander),
        '정치가 처단 권한이 있는 직책(사법상서/법질서위원장)이 필요합니다.'
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
    const punishmentType = env?.punishmentType as PoliticianPunishmentType | undefined;

    if (!targetCommanderNo) {
      return { success: false, message: '처분 대상을 지정해주세요.' };
    }

    if (!punishmentType) {
      return { success: false, message: '처분 유형을 지정해주세요. (release/demotion/exile/execution)' };
    }

    // 대상 캐릭터 조회
    const targetCommander = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: targetCommanderNo,
    });

    if (!targetCommander) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 정치가 타입 확인
    if (targetCommander.characterType !== 'politician') {
      return { success: false, message: '정치가만 이 커맨드로 처분할 수 있습니다. 군인은 군사재판/처단 커맨드를 사용하세요.' };
    }

    // 구금 상태 확인
    if (targetCommander.status !== 'imprisoned') {
      return { success: false, message: '구금된 정치가만 처분할 수 있습니다.' };
    }

    // 같은 세력인지 확인
    const commanderFaction = commander.getFactionType?.() || commander.faction;
    if (targetCommander.faction !== commanderFaction) {
      return { success: false, message: '같은 세력의 정치가만 처분할 수 있습니다.' };
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
          targetType: 'politician',
        });
        resultMessage = `정치가 ${targetCommander.name}을(를) 석방했습니다.`;
        break;

      case 'demotion':
        // 강등 (직위 박탈)
        const beforePosition = targetCommander.jobPosition || '(무직)';
        targetCommander.jobPosition = null;
        targetCommander.status = 'active';
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.wanted = false;
        targetCommander.customData.demotedAt = new Date();
        targetCommander.customData.demotedBy = commander.no;
        targetCommander.customData.previousPosition = beforePosition;
        
        // 명성 감소
        targetCommander.fame = Math.max(0, (targetCommander.fame || 0) - 20);
        
        effects.push({
          type: 'demotion',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
          targetType: 'politician',
          beforePosition,
          afterPosition: '(무직)',
        });
        resultMessage = `정치가 ${targetCommander.name}의 직위(${beforePosition})를 박탈하고 석방했습니다.`;
        break;

      case 'exile':
        // 추방 (세력에서 제외)
        targetCommander.status = 'defected';
        targetCommander.originalFaction = targetCommander.faction;
        targetCommander.faction = targetCommander.faction === 'empire' ? 'alliance' : 'empire'; // 반대 세력으로
        targetCommander.jobPosition = null;
        targetCommander.fleetId = null;
        targetCommander.isActive = false;
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.exiledAt = new Date();
        targetCommander.customData.exiledBy = commander.no;
        targetCommander.customData.exileReason = env?.reason || '정치적 처분';
        
        effects.push({
          type: 'exile',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
          targetType: 'politician',
          fromFaction: targetCommander.originalFaction,
        });
        resultMessage = `정치가 ${targetCommander.name}을(를) 추방했습니다.`;
        break;

      case 'execution':
        // 처형
        targetCommander.status = 'executed';
        targetCommander.isActive = false;
        targetCommander.fleetId = null;
        targetCommander.jobPosition = null;
        targetCommander.customData = targetCommander.customData || {};
        targetCommander.customData.executedAt = new Date();
        targetCommander.customData.executedBy = commander.no;
        targetCommander.customData.executionType = 'political';
        targetCommander.customData.executionReason = env?.reason || '정치적 처분';
        
        effects.push({
          type: 'execution',
          targetNo: targetCommander.no,
          targetName: targetCommander.name,
          targetType: 'politician',
          executedBy: commander.name,
        });
        resultMessage = `정치가 ${targetCommander.name}을(를) 처형했습니다.`;

        // 처형은 명성에 영향 (처형자)
        commander.fame = Math.max(0, (commander.fame || 0) - 10);
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
      executorPosition: commander.jobPosition,
      type: punishmentType,
      reason: env?.reason || '',
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















