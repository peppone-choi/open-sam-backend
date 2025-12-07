/**
 * 군사 재판 (Court Martial)
 * 구금된 인물에 대한 군사 재판 진행
 * 판결: 강등(Demotion), 정직(Suspension), 수감(Imprisonment), 사형(Execution)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint, demote, getRankName } from '../../../utils/logh-rank-system';

// 판결 유형
export type VerdictType = 'acquittal' | 'demotion' | 'suspension' | 'imprisonment' | 'execution';

// 판결 결과 인터페이스
export interface IVerdictResult {
  verdict: VerdictType;
  verdictName: string;
  description: string;
  duration?: number; // 정직/수감 기간 (턴)
  demotionLevels?: number; // 강등 단계
}

export class CourtMartialCommand extends BaseLoghCommand {
  getName(): string {
    return 'court_martial';
  }

  getDisplayName(): string {
    return '군사 재판';
  }

  getDescription(): string {
    return '구금된 인물에 대한 군사 재판 진행';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 200;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    return [
      // 최소 중령 이상만 재판관 역할 가능
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getRank() <= 8,
        '재판을 주재하려면 최소 중령 이상의 계급이 필요합니다.'
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
    const requestedVerdict = env?.verdict as VerdictType | undefined;

    if (!targetCommanderNo) {
      return { success: false, message: '재판 대상을 지정해주세요.' };
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
      return { success: false, message: '구금된 인물만 재판할 수 있습니다.' };
    }

    // 같은 세력인지 확인
    if (targetCommander.faction !== commander.getFactionType()) {
      return { success: false, message: '같은 세력의 인물만 재판할 수 있습니다.' };
    }

    // 재판관보다 높은 계급은 재판 불가
    if (!canAppoint(commander.getRank(), targetCommander.getRankName(), targetCommander.faction)) {
      return { success: false, message: '자신보다 계급이 높은 인물은 재판할 수 없습니다.' };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 판결 결정 (지정된 판결 또는 자동 결정)
    const verdict = requestedVerdict
      ? this.getVerdictResult(requestedVerdict)
      : this.determineVerdict(targetCommander);

    // 판결 적용
    const effects = await this.applyVerdict(targetCommander, verdict, commander);

    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}에 대한 군사 재판 결과: ${verdict.verdictName}`,
      effects,
    };
  }

  /**
   * 판결 유형에 따른 결과 정보 반환
   */
  private getVerdictResult(verdict: VerdictType): IVerdictResult {
    switch (verdict) {
      case 'acquittal':
        return {
          verdict: 'acquittal',
          verdictName: '무죄',
          description: '혐의 없음으로 석방',
        };
      case 'demotion':
        return {
          verdict: 'demotion',
          verdictName: '강등',
          description: '계급 1단계 강등',
          demotionLevels: 1,
        };
      case 'suspension':
        return {
          verdict: 'suspension',
          verdictName: '정직',
          description: '30턴간 직무 정지',
          duration: 30,
        };
      case 'imprisonment':
        return {
          verdict: 'imprisonment',
          verdictName: '수감',
          description: '100턴간 구금 지속',
          duration: 100,
        };
      case 'execution':
        return {
          verdict: 'execution',
          verdictName: '사형',
          description: '즉시 처형',
        };
      default:
        return {
          verdict: 'acquittal',
          verdictName: '무죄',
          description: '혐의 없음으로 석방',
        };
    }
  }

  /**
   * 자동 판결 결정 (범죄 심각도에 따라)
   */
  private determineVerdict(target: any): IVerdictResult {
    const crime = target.customData?.wantedReason || target.customData?.crime || 'minor';
    const crimeWeight = target.customData?.crimeWeight || 1;

    // 범죄 심각도에 따른 판결
    if (crimeWeight >= 5 || crime === 'treason' || crime === '반역') {
      return this.getVerdictResult('execution');
    } else if (crimeWeight >= 4 || crime === 'desertion' || crime === '탈영') {
      return this.getVerdictResult('imprisonment');
    } else if (crimeWeight >= 3 || crime === 'insubordination' || crime === '항명') {
      return this.getVerdictResult('suspension');
    } else if (crimeWeight >= 2 || crime === 'misconduct' || crime === '비위') {
      return this.getVerdictResult('demotion');
    } else {
      // 경미한 범죄는 50% 확률로 무죄 또는 강등
      return Math.random() < 0.5
        ? this.getVerdictResult('acquittal')
        : this.getVerdictResult('demotion');
    }
  }

  /**
   * 판결 적용
   */
  private async applyVerdict(
    target: any,
    verdict: IVerdictResult,
    judge: any
  ): Promise<any[]> {
    const effects: any[] = [];

    switch (verdict.verdict) {
      case 'acquittal':
        // 무죄: 석방
        target.status = 'active';
        target.customData = target.customData || {};
        target.customData.wanted = false;
        target.customData.wantedReason = null;
        target.customData.acquittedAt = new Date();
        effects.push({
          type: 'acquittal',
          targetNo: target.no,
          targetName: target.name,
        });
        break;

      case 'demotion':
        // 강등: 계급 하락 후 석방
        const beforeRank = target.rank;
        const beforeRankName = getRankName(target.rank, target.faction);
        const afterRankName = demote(beforeRankName, target.faction, verdict.demotionLevels || 1);
        // rank index를 계산 (높을수록 낮은 계급)
        target.rank = Math.min(20, target.rank + (verdict.demotionLevels || 1));
        target.status = 'active';
        target.customData = target.customData || {};
        target.customData.wanted = false;
        target.customData.demotedAt = new Date();
        effects.push({
          type: 'demotion',
          targetNo: target.no,
          targetName: target.name,
          beforeRank: beforeRankName,
          afterRank: afterRankName,
        });
        break;

      case 'suspension':
        // 정직: 일정 기간 직무 정지
        target.status = 'active';
        target.fleetId = null; // 함대에서 제외
        target.jobPosition = null; // 직책 박탈
        target.customData = target.customData || {};
        target.customData.suspended = true;
        target.customData.suspendedUntil = Date.now() + (verdict.duration || 30) * 2500;
        target.customData.wanted = false;
        effects.push({
          type: 'suspension',
          targetNo: target.no,
          targetName: target.name,
          duration: verdict.duration,
        });
        break;

      case 'imprisonment':
        // 수감: 구금 상태 유지
        target.status = 'imprisoned';
        target.customData = target.customData || {};
        target.customData.imprisonedUntil = Date.now() + (verdict.duration || 100) * 2500;
        target.customData.wanted = false;
        effects.push({
          type: 'imprisonment',
          targetNo: target.no,
          targetName: target.name,
          duration: verdict.duration,
        });
        break;

      case 'execution':
        // 사형: 캐릭터 사망 처리
        target.status = 'executed';
        target.isActive = false;
        target.fleetId = null;
        target.jobPosition = null;
        target.customData = target.customData || {};
        target.customData.executedAt = new Date();
        target.customData.executedBy = judge.no;
        effects.push({
          type: 'execution',
          targetNo: target.no,
          targetName: target.name,
          executedBy: judge.name,
        });
        break;
    }

    // 재판 기록 저장
    target.customData.trialHistory = target.customData.trialHistory || [];
    target.customData.trialHistory.push({
      date: new Date(),
      judgeNo: judge.no,
      judgeName: judge.name,
      verdict: verdict.verdict,
      verdictName: verdict.verdictName,
    });

    target.markModified('customData');
    await target.save();

    return effects;
  }
}

