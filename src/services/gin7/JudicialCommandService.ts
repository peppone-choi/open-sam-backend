/**
 * JudicialCommandService - 사법 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 사법 커맨드:
 * - JUDGMENT (処断): 처단 - 구금자에 대한 판결
 *   - EXECUTION: 처형
 *   - IMPRISONMENT: 구금 유지
 *   - EXILE: 추방
 *   - DEMOTION: 강등
 *   - FINE: 벌금
 *   - ACQUITTAL: 무죄 방면
 * - HOLD_TRIAL: 재판 개최
 * - GRANT_AMNESTY: 사면
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface JudicialRequest {
  sessionId: string;
  characterId: string;     // 실행자 (판사/황제/의장)
  commandId: string;       // 커맨드 ID
  targetId: string;        // 대상 캐릭터 (피고/구금자)
  params?: Record<string, any>; // 추가 파라미터
}

export interface JudicialResult {
  success: boolean;
  commandId: string;
  verdict?: JudgmentType;
  effects: {
    statusChange?: string;
    rankChange?: string;
    fineAmount?: number;
    exileDestination?: string;
  };
  cpCost: number;
  message?: string;
  error?: string;
}

export type JudgmentType =
  | 'EXECUTION'      // 처형 - 캐릭터 사망 처리
  | 'IMPRISONMENT'   // 구금 - 구금 상태 유지
  | 'EXILE'          // 추방 - 타 세력으로 추방
  | 'DEMOTION'       // 강등 - 계급 강등
  | 'FINE'           // 벌금 - 재산 몰수
  | 'ACQUITTAL';     // 무죄 방면 - 석방

export type CrimeType =
  | 'TREASON'        // 반역
  | 'COUP_ATTEMPT'   // 쿠데타 시도
  | 'DESERTION'      // 탈영
  | 'INSUBORDINATION'// 항명
  | 'CORRUPTION'     // 부패
  | 'ESPIONAGE'      // 첩보 활동
  | 'WAR_CRIMES'     // 전쟁 범죄
  | 'OTHER';         // 기타

export interface TrialRecord {
  trialId: string;
  sessionId: string;
  defendantId: string;
  defendantName: string;
  judgeId: string;
  judgeName: string;
  crime: CrimeType;
  crimeDescription: string;
  verdict: JudgmentType;
  sentenceDetails: string;
  timestamp: Date;
}

export interface AmnestyDecree {
  decreeId: string;
  sessionId: string;
  issuerId: string;
  issuerName: string;
  targetIds: string[];
  targetNames: string[];
  reason: string;
  scope: 'INDIVIDUAL' | 'CRIME_TYPE' | 'GENERAL';
  crimeType?: CrimeType;
  timestamp: Date;
}

// ============================================================
// JudicialCommandService Class
// ============================================================

export class JudicialCommandService extends EventEmitter {
  private static instance: JudicialCommandService;

  private constructor() {
    super();
    logger.info('[JudicialCommandService] Initialized');
  }

  public static getInstance(): JudicialCommandService {
    if (!JudicialCommandService.instance) {
      JudicialCommandService.instance = new JudicialCommandService();
    }
    return JudicialCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 사법 커맨드 라우터
   */
  public async executeJudicialCommand(request: JudicialRequest): Promise<JudicialResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'JUDGMENT':
        return this.executeJudgment(request);
      case 'HOLD_TRIAL':
        return this.holdTrial(request);
      case 'GRANT_AMNESTY':
        return this.grantAmnesty(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 사법 커맨드입니다.');
    }
  }

  // ============================================================
  // 사법 커맨드 구현
  // ============================================================

  /**
   * 처단 (処断) - 구금자에 대한 판결 집행
   * EXECUTION, IMPRISONMENT, EXILE, DEMOTION, FINE, ACQUITTAL
   * CP: 320
   */
  public async executeJudgment(request: JudicialRequest): Promise<JudicialResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('JUDGMENT');

    if (!targetId) {
      return this.errorResult('JUDGMENT', cpCost, '처단 대상이 필요합니다.');
    }

    const judgmentType = params?.type as JudgmentType;
    if (!judgmentType) {
      return this.errorResult('JUDGMENT', cpCost, '판결 유형이 필요합니다.');
    }

    // 유효한 판결 유형인지 확인
    const validJudgments: JudgmentType[] = [
      'EXECUTION', 'IMPRISONMENT', 'EXILE', 'DEMOTION', 'FINE', 'ACQUITTAL'
    ];
    if (!validJudgments.includes(judgmentType)) {
      return this.errorResult('JUDGMENT', cpCost, '유효하지 않은 판결 유형입니다.');
    }

    try {
      const judge = await Gin7Character.findOne({ sessionId, characterId });
      const defendant = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!judge) {
        return this.errorResult('JUDGMENT', cpCost, '판결자를 찾을 수 없습니다.');
      }
      if (!defendant) {
        return this.errorResult('JUDGMENT', cpCost, '피고를 찾을 수 없습니다.');
      }

      // 권한 체크 (황제/의장/사법부)
      const hasAuthority = await this.checkJudicialAuthority(judge, 'JUDGMENT');
      if (!hasAuthority) {
        return this.errorResult('JUDGMENT', cpCost, '판결 권한이 없습니다.');
      }

      // 구금 상태 확인 (재판 없는 즉결 처분의 경우)
      const requiresDetainedStatus = ['EXECUTION', 'EXILE', 'DEMOTION'];
      if (requiresDetainedStatus.includes(judgmentType) && defendant.status !== 'DETAINED') {
        // 비구금자에 대한 처분은 재판 선행 필요
        return this.errorResult('JUDGMENT', cpCost, '구금 상태인 캐릭터만 처단할 수 있습니다. 먼저 체포 또는 재판이 필요합니다.');
      }

      // 판결 집행
      const result = await this.applyJudgment(sessionId, defendant, judgmentType, params);

      // 재판 기록 생성
      const trialRecord: TrialRecord = {
        trialId: this.generateId(),
        sessionId,
        defendantId: targetId,
        defendantName: defendant.name,
        judgeId: characterId,
        judgeName: judge.name,
        crime: params?.crime || 'OTHER',
        crimeDescription: params?.crimeDescription || '상세 불명',
        verdict: judgmentType,
        sentenceDetails: result.message || '',
        timestamp: new Date(),
      };

      this.emit('judicial:judgmentExecuted', {
        sessionId,
        judge: { id: characterId, name: judge.name },
        defendant: { id: targetId, name: defendant.name },
        verdict: judgmentType,
        trialRecord,
        timestamp: new Date(),
      });

      logger.info(`[JudicialCommandService] Judgment executed: ${defendant.name} - ${judgmentType} by ${judge.name}`);

      return result;
    } catch (error) {
      logger.error('[JudicialCommandService] Execute judgment error:', error);
      return this.errorResult('JUDGMENT', cpCost, '판결 집행 중 오류 발생');
    }
  }

  /**
   * 재판 개최 (裁判)
   * 정식 재판 절차 진행
   * CP: 320
   */
  public async holdTrial(request: JudicialRequest): Promise<JudicialResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('HOLD_TRIAL') || 320;

    if (!targetId) {
      return this.errorResult('HOLD_TRIAL', cpCost, '피고가 필요합니다.');
    }

    const crime = params?.crime as CrimeType;
    if (!crime) {
      return this.errorResult('HOLD_TRIAL', cpCost, '혐의가 필요합니다.');
    }

    try {
      const judge = await Gin7Character.findOne({ sessionId, characterId });
      const defendant = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!judge) {
        return this.errorResult('HOLD_TRIAL', cpCost, '재판장을 찾을 수 없습니다.');
      }
      if (!defendant) {
        return this.errorResult('HOLD_TRIAL', cpCost, '피고를 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkJudicialAuthority(judge, 'TRIAL');
      if (!hasAuthority) {
        return this.errorResult('HOLD_TRIAL', cpCost, '재판 개최 권한이 없습니다.');
      }

      // 피고 상태를 재판 중(구금)으로 변경
      defendant.status = 'DETAINED';
      if (!defendant.data) defendant.data = {};
      defendant.data.trialInfo = {
        judgeId: characterId,
        judgeName: judge.name,
        crime,
        crimeDescription: params?.crimeDescription || '',
        trialStarted: new Date(),
      };
      await defendant.save();

      // 재판 결과 자동 산정 (선택적 - 또는 별도 판결 필요)
      let recommendedVerdict: JudgmentType = 'ACQUITTAL';
      const evidence = params?.evidence || 0; // 증거 강도 (0-100)

      if (crime === 'TREASON' || crime === 'COUP_ATTEMPT') {
        recommendedVerdict = evidence > 70 ? 'EXECUTION' : evidence > 40 ? 'IMPRISONMENT' : 'ACQUITTAL';
      } else if (crime === 'DESERTION' || crime === 'INSUBORDINATION') {
        recommendedVerdict = evidence > 60 ? 'DEMOTION' : evidence > 30 ? 'FINE' : 'ACQUITTAL';
      } else if (crime === 'CORRUPTION') {
        recommendedVerdict = evidence > 50 ? 'FINE' : 'ACQUITTAL';
      } else if (crime === 'ESPIONAGE') {
        recommendedVerdict = evidence > 70 ? 'EXECUTION' : evidence > 40 ? 'EXILE' : 'IMPRISONMENT';
      }

      this.emit('judicial:trialStarted', {
        sessionId,
        judge: { id: characterId, name: judge.name },
        defendant: { id: targetId, name: defendant.name },
        crime,
        evidence,
        recommendedVerdict,
        timestamp: new Date(),
      });

      logger.info(`[JudicialCommandService] Trial started: ${defendant.name} for ${crime}`);

      return {
        success: true,
        commandId: 'HOLD_TRIAL',
        effects: {
          statusChange: 'on_trial',
        },
        cpCost,
        message: `${defendant.name}에 대한 ${this.getCrimeDisplayName(crime)} 혐의 재판이 시작되었습니다. 권고 판결: ${this.getVerdictDisplayName(recommendedVerdict)}`,
      };
    } catch (error) {
      logger.error('[JudicialCommandService] Hold trial error:', error);
      return this.errorResult('HOLD_TRIAL', cpCost, '재판 개최 중 오류 발생');
    }
  }

  /**
   * 사면 (恩赦)
   * 구금자/유죄 판결자에 대한 사면
   * CP: 320
   */
  public async grantAmnesty(request: JudicialRequest): Promise<JudicialResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('GRANT_AMNESTY') || 320;

    if (!targetId) {
      return this.errorResult('GRANT_AMNESTY', cpCost, '사면 대상이 필요합니다.');
    }

    try {
      const issuer = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!issuer) {
        return this.errorResult('GRANT_AMNESTY', cpCost, '사면권자를 찾을 수 없습니다.');
      }
      if (!target) {
        return this.errorResult('GRANT_AMNESTY', cpCost, '사면 대상자를 찾을 수 없습니다.');
      }

      // 권한 체크 (황제/의장만 가능)
      const hasAuthority = await this.checkJudicialAuthority(issuer, 'AMNESTY');
      if (!hasAuthority) {
        return this.errorResult('GRANT_AMNESTY', cpCost, '사면 권한이 없습니다. 황제 또는 의장만 사면을 허가할 수 있습니다.');
      }

      // 사면 가능한 상태인지 확인
      const amnestableStatuses = ['DETAINED', 'CAPTURED', 'MISSING'];
      if (!amnestableStatuses.includes(target.status || '')) {
        return this.errorResult('GRANT_AMNESTY', cpCost, '사면 가능한 상태가 아닙니다.');
      }

      // 사면 처리
      const previousStatus = target.status;
      target.status = 'ACTIVE';
      if (!target.data) target.data = {};
      target.data.amnesty = {
        grantedBy: characterId,
        grantedByName: issuer.name,
        previousStatus,
        reason: params?.reason || '황은/의장의 결정',
        grantedAt: new Date(),
      };
      await target.save();

      // 사면령 기록
      const amnestyDecree: AmnestyDecree = {
        decreeId: this.generateId(),
        sessionId,
        issuerId: characterId,
        issuerName: issuer.name,
        targetIds: [targetId],
        targetNames: [target.name],
        reason: params?.reason || '황은/의장의 결정',
        scope: 'INDIVIDUAL',
        timestamp: new Date(),
      };

      this.emit('judicial:amnestyGranted', {
        sessionId,
        issuer: { id: characterId, name: issuer.name },
        target: { id: targetId, name: target.name },
        previousStatus,
        decree: amnestyDecree,
        timestamp: new Date(),
      });

      logger.info(`[JudicialCommandService] Amnesty granted to ${target.name} by ${issuer.name}`);

      return {
        success: true,
        commandId: 'GRANT_AMNESTY',
        verdict: 'ACQUITTAL',
        effects: {
          statusChange: 'active',
        },
        cpCost,
        message: `${target.name}에 대한 사면이 허가되었습니다.`,
      };
    } catch (error) {
      logger.error('[JudicialCommandService] Grant amnesty error:', error);
      return this.errorResult('GRANT_AMNESTY', cpCost, '사면 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 판결 집행 헬퍼
  // ============================================================

  /**
   * 판결 적용
   */
  private async applyJudgment(
    sessionId: string,
    defendant: IGin7Character,
    judgmentType: JudgmentType,
    params?: Record<string, any>
  ): Promise<JudicialResult> {
    const cpCost = this.getCommandCost('JUDGMENT');

    switch (judgmentType) {
      case 'EXECUTION':
        return this.applyExecution(sessionId, defendant, cpCost);
      case 'IMPRISONMENT':
        return this.applyImprisonment(sessionId, defendant, cpCost, params);
      case 'EXILE':
        return this.applyExile(sessionId, defendant, cpCost, params);
      case 'DEMOTION':
        return this.applyDemotion(sessionId, defendant, cpCost, params);
      case 'FINE':
        return this.applyFine(sessionId, defendant, cpCost, params);
      case 'ACQUITTAL':
        return this.applyAcquittal(sessionId, defendant, cpCost);
      default:
        return this.errorResult('JUDGMENT', cpCost, '알 수 없는 판결 유형');
    }
  }

  /**
   * 처형 (EXECUTION)
   */
  private async applyExecution(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number
  ): Promise<JudicialResult> {
    defendant.status = 'DEAD';
    if (!defendant.data) defendant.data = {};
    defendant.data.deathCause = 'execution';
    defendant.data.deathTime = new Date();
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'EXECUTION',
      effects: {
        statusChange: 'dead',
      },
      cpCost,
      message: `${defendant.name}이(가) 처형되었습니다.`,
    };
  }

  /**
   * 구금 (IMPRISONMENT)
   */
  private async applyImprisonment(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number,
    params?: Record<string, any>
  ): Promise<JudicialResult> {
    defendant.status = 'DETAINED';
    if (!defendant.data) defendant.data = {};
    defendant.data.imprisonmentInfo = {
      startDate: new Date(),
      duration: params?.duration || 'indefinite', // 무기한 또는 게임일 수
      facility: params?.facility || 'default',
    };
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'IMPRISONMENT',
      effects: {
        statusChange: 'imprisoned',
      },
      cpCost,
      message: `${defendant.name}이(가) 구금되었습니다.`,
    };
  }

  /**
   * 추방 (EXILE)
   */
  private async applyExile(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number,
    params?: Record<string, any>
  ): Promise<JudicialResult> {
    defendant.status = 'EXILED';
    const destination = params?.destination || 'neutral';
    if (!defendant.data) defendant.data = {};
    defendant.data.exileInfo = {
      exiledAt: new Date(),
      destination,
      originalFaction: defendant.factionId,
    };
    // 진영 변경 (중립 또는 지정 세력)
    // defendant.factionId = destination === 'neutral' ? 'neutral' : destination;
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'EXILE',
      effects: {
        statusChange: 'exiled',
        exileDestination: destination,
      },
      cpCost,
      message: `${defendant.name}이(가) 추방되었습니다.`,
    };
  }

  /**
   * 강등 (DEMOTION)
   */
  private async applyDemotion(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number,
    params?: Record<string, any>
  ): Promise<JudicialResult> {
    const previousRank = defendant.rank;
    const demotionLevels = params?.levels || 1;

    // 강등 처리 (MeritService 연동 필요)
    // TODO: 실제 계급 강등 로직 연동
    defendant.status = 'ACTIVE'; // 구금 해제
    if (!defendant.data) defendant.data = {};
    defendant.data.demotionRecord = {
      previousRank,
      demotedAt: new Date(),
      levels: demotionLevels,
    };
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'DEMOTION',
      effects: {
        statusChange: 'active',
        rankChange: `${demotionLevels}단계 강등`,
      },
      cpCost,
      message: `${defendant.name}이(가) ${demotionLevels}단계 강등되었습니다.`,
    };
  }

  /**
   * 벌금 (FINE)
   */
  private async applyFine(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number,
    params?: Record<string, any>
  ): Promise<JudicialResult> {
    const fineAmount = params?.amount || 10000;
    
    defendant.status = 'ACTIVE'; // 구금 해제
    if (!defendant.data) defendant.data = {};
    defendant.data.fineRecord = {
      amount: fineAmount,
      imposedAt: new Date(),
      paid: false,
    };
    // 재산 차감 (EconomyService 연동 필요)
    // TODO: 실제 재산 차감 로직
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'FINE',
      effects: {
        statusChange: 'active',
        fineAmount,
      },
      cpCost,
      message: `${defendant.name}에게 ${fineAmount} 크레딧의 벌금이 부과되었습니다.`,
    };
  }

  /**
   * 무죄 방면 (ACQUITTAL)
   */
  private async applyAcquittal(
    sessionId: string,
    defendant: IGin7Character,
    cpCost: number
  ): Promise<JudicialResult> {
    defendant.status = 'ACTIVE';
    if (!defendant.data) defendant.data = {};
    defendant.data.acquittalRecord = {
      acquittedAt: new Date(),
    };
    await defendant.save();

    return {
      success: true,
      commandId: 'JUDGMENT',
      verdict: 'ACQUITTAL',
      effects: {
        statusChange: 'active',
      },
      cpCost,
      message: `${defendant.name}이(가) 무죄로 방면되었습니다.`,
    };
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 320;
  }

  private errorResult(commandId: string, cpCost: number, error: string): JudicialResult {
    return {
      success: false,
      commandId,
      effects: {},
      cpCost,
      error,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 사법 권한 체크
   */
  private async checkJudicialAuthority(
    character: IGin7Character,
    authorityType: 'JUDGMENT' | 'TRIAL' | 'AMNESTY'
  ): Promise<boolean> {
    // TODO: JobCardService 연동
    // AMNESTY는 황제/의장만 가능
    if (authorityType === 'AMNESTY') {
      const topPositions = ['emperor', 'chairman', '황제', '의장'];
      return topPositions.some(p => 
        character.rank?.toLowerCase().includes(p) ||
        character.data?.position?.toLowerCase().includes(p)
      ) || true; // 개발 중 항상 통과
    }

    // JUDGMENT, TRIAL은 사법부/헌병 직책 필요
    return true; // 개발 중 항상 통과
  }

  /**
   * 범죄 유형 표시명
   */
  private getCrimeDisplayName(crime: CrimeType): string {
    const names: Record<CrimeType, string> = {
      'TREASON': '반역',
      'COUP_ATTEMPT': '쿠데타 시도',
      'DESERTION': '탈영',
      'INSUBORDINATION': '항명',
      'CORRUPTION': '부정부패',
      'ESPIONAGE': '첩보 활동',
      'WAR_CRIMES': '전쟁 범죄',
      'OTHER': '기타',
    };
    return names[crime] || crime;
  }

  /**
   * 판결 유형 표시명
   */
  private getVerdictDisplayName(verdict: JudgmentType): string {
    const names: Record<JudgmentType, string> = {
      'EXECUTION': '처형',
      'IMPRISONMENT': '구금',
      'EXILE': '추방',
      'DEMOTION': '강등',
      'FINE': '벌금',
      'ACQUITTAL': '무죄 방면',
    };
    return names[verdict] || verdict;
  }
}

export const judicialCommandService = JudicialCommandService.getInstance();
export default JudicialCommandService;





