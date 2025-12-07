/**
 * Prisoner.service.ts - 포로 시스템 서비스
 *
 * 전투에서 패배한 장수를 포로로 잡아서 등용/해방/처형할 수 있습니다.
 *
 * 참조: SAMGUKJI_AGENT_PROMPTS.md의 포로 시스템 요구사항
 */

import { IGeneral } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { ActionLogger } from '../logger/ActionLogger';
import { JosaUtil } from '../../utils/JosaUtil';

/**
 * 포로 시스템 설정값
 */
export const PRISONER_CONFIG = {
  /** 기본 등용 성공률 (0.0 ~ 1.0) */
  BASE_RECRUIT_RATE: 0.3,

  /** 최대 등용 성공률 */
  MAX_RECRUIT_RATE: 0.8,

  /** 최소 등용 성공률 */
  MIN_RECRUIT_RATE: 0.1,

  /** 충성도 1당 등용 성공률 감소 */
  LOYALTY_PENALTY_RATE: 0.005,

  /** 매력 1당 등용 성공률 증가 */
  CHARM_BONUS_RATE: 0.003,

  /** 기본 탈출 성공률 */
  BASE_ESCAPE_RATE: 0.1,

  /** 최대 탈출 성공률 */
  MAX_ESCAPE_RATE: 0.5,

  /** 지력 1당 탈출 성공률 증가 */
  INTEL_ESCAPE_BONUS_RATE: 0.002,

  /** 처형 시 외교 관계 악화 정도 */
  EXECUTION_DIPLOMACY_PENALTY: 10,
};

/**
 * 포로 등용/해방/처형 결과
 */
export interface PrisonerActionResult {
  success: boolean;
  message: string;
  generalId: number;
  generalName: string;
}

/**
 * 포로 서비스 클래스
 */
export class PrisonerService {
  /**
   * 장수를 포로로 전환
   *
   * @param sessionId 세션 ID
   * @param general 포로가 될 장수
   * @param captorNationId 포로를 잡은 국가 ID
   * @param capturedAt 포로가 된 시간 (옵션)
   */
  static async capturePrisoner(
    sessionId: string,
    general: IGeneral,
    captorNationId: number,
    capturedAt?: Date
  ): Promise<void> {
    const generalName = general.getName();
    const originalNationId = general.getNationID();

    // 포로 상태로 전환
    general.setVar('prisoner_of', captorNationId);
    general.setVar('captured_at', capturedAt || new Date());
    general.setVar('original_nation', originalNationId);

    // 병력 해산
    general.setVar('crew', 0);
    // 부대에서 제외
    general.setVar('troop', 0);
    // 관직 해제
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);

    // 로그 기록
    const logger = general.getLogger();
    if (logger) {
      const josaYi = JosaUtil.pick(generalName, '이');
      logger.pushGeneralActionLog(
        `<R>포로</>가 되었습니다.`
      );
    }

    await general.save();

    // 원래 국가 장수 수 감소
    if (originalNationId > 0) {
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, nation: originalNationId },
        { $inc: { gennum: -1 } }
      );
    }
  }

  /**
   * 포로 등용 시도
   *
   * @param sessionId 세션 ID
   * @param recruiterId 등용 시도하는 장수 ID
   * @param prisonerId 포로 장수 ID
   * @param rng 난수 생성기
   * @returns 등용 결과
   */
  static async recruitPrisoner(
    sessionId: string,
    recruiterId: number,
    prisonerId: number,
    rng: any
  ): Promise<PrisonerActionResult> {
    // 장수 조회
    const recruiter = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: recruiterId,
    });
    if (!recruiter) {
      return {
        success: false,
        message: '등용 시도 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisoner = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: prisonerId,
    });
    if (!prisoner) {
      return {
        success: false,
        message: '포로 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisonerName = prisoner.getName();
    const recruiterNationId = recruiter.getNationID();

    // 포로 상태 검증
    if (!prisoner.isPrisoner()) {
      return {
        success: false,
        message: `${prisonerName}은(는) 포로가 아닙니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 자국 포로인지 확인
    if (prisoner.getPrisonerOf() !== recruiterNationId) {
      return {
        success: false,
        message: '자국의 포로만 등용할 수 있습니다.',
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 등용 성공률 계산
    const recruiterCharm = recruiter.getCharm?.() ?? recruiter.getVar('charm') ?? 50;
    const prisonerLoyalty = prisoner.getVar('loyalty') ?? 70;

    let recruitRate = PRISONER_CONFIG.BASE_RECRUIT_RATE;
    // 매력에 따른 보너스
    recruitRate += recruiterCharm * PRISONER_CONFIG.CHARM_BONUS_RATE;
    // 충성도에 따른 패널티
    recruitRate -= prisonerLoyalty * PRISONER_CONFIG.LOYALTY_PENALTY_RATE;
    // 범위 제한
    recruitRate = Math.max(
      PRISONER_CONFIG.MIN_RECRUIT_RATE,
      Math.min(PRISONER_CONFIG.MAX_RECRUIT_RATE, recruitRate)
    );

    const success = rng.nextBool(recruitRate);

    const recruiterLogger = recruiter.getLogger();
    const prisonerLogger = prisoner.getLogger();

    if (success) {
      // 등용 성공 - 국가 이적
      prisoner.setVar('prisoner_of', 0);
      prisoner.setVar('captured_at', null);
      prisoner.setVar('nation', recruiterNationId);
      prisoner.setVar('city', recruiter.getCityID());
      prisoner.setVar('loyalty', 50); // 초기 충성도

      await prisoner.save();

      // 국가 장수 수 증가
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, nation: recruiterNationId },
        { $inc: { gennum: 1 } }
      );

      // 로그 기록
      const josaUl = JosaUtil.pick(prisonerName, '을');
      recruiterLogger?.pushGeneralActionLog(
        `포로 <Y>${prisonerName}</>${josaUl} <S>등용</>하는데 <S>성공</>했습니다.`
      );
      recruiterLogger?.pushGeneralHistoryLog(`포로 ${prisonerName} 등용 성공`);

      prisonerLogger?.pushGeneralActionLog(
        `등용 제안을 <S>수락</>하여 새 국가에 합류했습니다.`
      );

      await recruiter.save();

      return {
        success: true,
        message: `${prisonerName}을(를) 등용하는데 성공했습니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    } else {
      // 등용 실패
      const josaUl = JosaUtil.pick(prisonerName, '을');
      recruiterLogger?.pushGeneralActionLog(
        `포로 <Y>${prisonerName}</>${josaUl} 등용하려 했으나 <R>거절</>당했습니다.`
      );

      prisonerLogger?.pushGeneralActionLog(
        `등용 제안을 <R>거절</>했습니다.`
      );

      await recruiter.save();
      await prisoner.save();

      return {
        success: false,
        message: `${prisonerName}이(가) 등용을 거절했습니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }
  }

  /**
   * 포로 해방
   *
   * @param sessionId 세션 ID
   * @param releaserId 해방하는 장수 ID
   * @param prisonerId 포로 장수 ID
   * @returns 해방 결과
   */
  static async releasePrisoner(
    sessionId: string,
    releaserId: number,
    prisonerId: number
  ): Promise<PrisonerActionResult> {
    // 장수 조회
    const releaser = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: releaserId,
    });
    if (!releaser) {
      return {
        success: false,
        message: '해방 시도 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisoner = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: prisonerId,
    });
    if (!prisoner) {
      return {
        success: false,
        message: '포로 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisonerName = prisoner.getName();
    const releaserNationId = releaser.getNationID();

    // 포로 상태 검증
    if (!prisoner.isPrisoner()) {
      return {
        success: false,
        message: `${prisonerName}은(는) 포로가 아닙니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 자국 포로인지 확인
    if (prisoner.getPrisonerOf() !== releaserNationId) {
      return {
        success: false,
        message: '자국의 포로만 해방할 수 있습니다.',
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 권한 확인 (태수 이상)
    const officerLevel = releaser.getVar('officer_level') ?? 1;
    if (officerLevel < 4) {
      return {
        success: false,
        message: '포로 해방은 태수 이상만 가능합니다.',
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 해방 처리 - 재야로 전환
    prisoner.releasePrisoner();
    prisoner.setVar('captured_at', null);

    await prisoner.save();

    // 로그 기록
    const releaserLogger = releaser.getLogger();
    const prisonerLogger = prisoner.getLogger();

    const josaUl = JosaUtil.pick(prisonerName, '을');
    releaserLogger?.pushGeneralActionLog(
      `포로 <Y>${prisonerName}</>${josaUl} <S>해방</>했습니다.`
    );
    releaserLogger?.pushGeneralHistoryLog(`포로 ${prisonerName} 해방`);

    prisonerLogger?.pushGeneralActionLog(
      `<S>해방</>되어 재야가 되었습니다.`
    );

    await releaser.save();

    return {
      success: true,
      message: `${prisonerName}을(를) 해방했습니다.`,
      generalId: prisonerId,
      generalName: prisonerName,
    };
  }

  /**
   * 포로 처형
   *
   * @param sessionId 세션 ID
   * @param executorId 처형하는 장수 ID
   * @param prisonerId 포로 장수 ID
   * @returns 처형 결과
   */
  static async executePrisoner(
    sessionId: string,
    executorId: number,
    prisonerId: number
  ): Promise<PrisonerActionResult> {
    // 장수 조회
    const executor = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: executorId,
    });
    if (!executor) {
      return {
        success: false,
        message: '처형 시도 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisoner = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: prisonerId,
    });
    if (!prisoner) {
      return {
        success: false,
        message: '포로 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisonerName = prisoner.getName();
    const executorNationId = executor.getNationID();

    // 포로 상태 검증
    if (!prisoner.isPrisoner()) {
      return {
        success: false,
        message: `${prisonerName}은(는) 포로가 아닙니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 자국 포로인지 확인
    if (prisoner.getPrisonerOf() !== executorNationId) {
      return {
        success: false,
        message: '자국의 포로만 처형할 수 있습니다.',
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 권한 확인 (군주만 가능)
    const officerLevel = executor.getVar('officer_level') ?? 1;
    if (officerLevel !== 12) {
      return {
        success: false,
        message: '포로 처형은 군주만 가능합니다.',
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 처형 처리
    const originalNationId = prisoner.getVar('original_nation') ?? 0;

    // 로그 기록
    const executorLogger = executor.getLogger();

    const josaUl = JosaUtil.pick(prisonerName, '을');
    const josaYi = JosaUtil.pick(prisonerName, '이');
    executorLogger?.pushGeneralActionLog(
      `포로 <Y>${prisonerName}</>${josaUl} <R>처형</>했습니다.`
    );
    executorLogger?.pushGeneralHistoryLog(`포로 ${prisonerName} 처형`);
    executorLogger?.pushGlobalHistoryLog(
      `<R><b>【처형】</b></><Y>${prisonerName}</>${josaYi} 처형되었습니다.`
    );

    // 장수 사망 처리
    await prisoner.kill({
      sendDyingMessage: true,
      dyingMessage: `${prisonerName}이(가) 처형되었습니다.`,
    });

    // NPC가 아닌 경우 DB에서 삭제하지 않음 (사망 처리만)
    const npcType = prisoner.getNPCType();
    if (npcType >= 2) {
      // NPC인 경우 DB에서 삭제
      await generalRepository.deleteByFilter({
        session_id: sessionId,
        no: prisonerId,
      });
    } else {
      await prisoner.save();
    }

    await executor.save();

    return {
      success: true,
      message: `${prisonerName}을(를) 처형했습니다.`,
      generalId: prisonerId,
      generalName: prisonerName,
    };
  }

  /**
   * 포로 탈출 시도 (턴 처리 시 자동 실행)
   *
   * @param sessionId 세션 ID
   * @param prisonerId 포로 장수 ID
   * @param rng 난수 생성기
   * @returns 탈출 결과
   */
  static async attemptEscape(
    sessionId: string,
    prisonerId: number,
    rng: any
  ): Promise<PrisonerActionResult> {
    const prisoner = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: prisonerId,
    });
    if (!prisoner) {
      return {
        success: false,
        message: '포로 장수를 찾을 수 없습니다.',
        generalId: prisonerId,
        generalName: '',
      };
    }

    const prisonerName = prisoner.getName();

    // 포로 상태 검증
    if (!prisoner.isPrisoner()) {
      return {
        success: false,
        message: `${prisonerName}은(는) 포로가 아닙니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }

    // 탈출 성공률 계산
    const intel = prisoner.getIntel?.() ?? prisoner.getVar('intel') ?? 50;

    let escapeRate = PRISONER_CONFIG.BASE_ESCAPE_RATE;
    // 지력에 따른 보너스
    escapeRate += intel * PRISONER_CONFIG.INTEL_ESCAPE_BONUS_RATE;
    // 범위 제한
    escapeRate = Math.min(PRISONER_CONFIG.MAX_ESCAPE_RATE, escapeRate);

    const success = rng.nextBool(escapeRate);

    const prisonerLogger = prisoner.getLogger();

    if (success) {
      // 탈출 성공 - 재야로 전환
      prisoner.releasePrisoner();
      prisoner.setVar('captured_at', null);

      await prisoner.save();

      const josaYi = JosaUtil.pick(prisonerName, '이');
      prisonerLogger?.pushGeneralActionLog(
        `감옥에서 <S>탈출</>에 성공했습니다!`
      );
      prisonerLogger?.pushGlobalActionLog(
        `<Y>${prisonerName}</>${josaYi} 감옥에서 <S>탈출</>했습니다!`
      );

      return {
        success: true,
        message: `${prisonerName}이(가) 탈출에 성공했습니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    } else {
      // 탈출 실패
      prisonerLogger?.pushGeneralActionLog(
        `탈출을 시도했으나 <R>실패</>했습니다.`
      );

      await prisoner.save();

      return {
        success: false,
        message: `${prisonerName}의 탈출 시도가 실패했습니다.`,
        generalId: prisonerId,
        generalName: prisonerName,
      };
    }
  }

  /**
   * 특정 국가의 포로 목록 조회
   *
   * @param sessionId 세션 ID
   * @param nationId 국가 ID
   * @returns 포로 장수 목록
   */
  static async getPrisonersByNation(
    sessionId: string,
    nationId: number
  ): Promise<IGeneral[]> {
    const prisoners = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.prisoner_of': nationId,
    });
    return prisoners;
  }

  /**
   * 장수가 포로인지 확인
   *
   * @param general 장수
   * @returns 포로 여부
   */
  static isPrisoner(general: IGeneral): boolean {
    return general.isPrisoner();
  }
}

export default PrisonerService;






