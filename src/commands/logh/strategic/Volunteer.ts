/**
 * 지원 (Volunteer) - 일명 ENLIST
 * 정치가가 군에 입대하여 다시 군인이 되는 커맨드
 * 
 * - 퇴역 후 30G일 쿨타임 필요
 * - 계급: 소좌(11)로 시작
 * - 기함: 전함(battleship)으로 시작
 * - characterType: 'politician' → 'military'
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { getRankName, getRankIndex } from '../../../utils/logh-rank-system';

/** 지원 시 시작 계급 (소좌 = 11) */
const STARTING_RANK = 11;

/** 지원 시 시작 기함 */
const STARTING_FLAGSHIP = {
  name: '지원자 함선',
  type: 'battleship' as const,
  firepower: 50,
};

export class VolunteerCommand extends BaseLoghCommand {
  getName(): string {
    return 'volunteer';
  }

  getDisplayName(): string {
    return '지원';
  }

  getDescription(): string {
    return '정치가가 군에 입대합니다. 소좌 계급과 전함 기함으로 시작합니다. 퇴역 후 30G일 이후에만 가능합니다.';
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

    // 정치가/퇴역 상태 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          return data.characterType === 'politician' || data.customData?.retired === true;
        },
        '정치가 또는 퇴역 상태에서만 지원할 수 있습니다.'
      )
    );

    // 쿨타임 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          const cooldownUntil = data.customData?.volunteerCooldownUntil;
          if (!cooldownUntil) return true;
          return new Date(cooldownUntil) <= new Date();
        },
        '퇴역 후 30G일 쿨타임이 아직 남아있습니다.'
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

    // Commander 문서 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // 정치가/퇴역 상태 확인
    if (commanderDoc.characterType !== 'politician' && !commanderDoc.customData?.retired) {
      return { success: false, message: '정치가 또는 퇴역 상태에서만 지원할 수 있습니다.' };
    }

    // 쿨타임 확인
    const cooldownUntil = commanderDoc.customData?.volunteerCooldownUntil;
    if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
      const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      return {
        success: false,
        message: `퇴역 후 쿨타임이 아직 ${remainingDays}일 남아있습니다.`,
      };
    }

    // 이전 퇴역 정보 보존 (히스토리용)
    const previousRetirement = {
      retiredAt: commanderDoc.customData?.retiredAt,
      retiredRank: commanderDoc.customData?.retiredRank,
      retiredRankName: commanderDoc.customData?.retiredRankName,
    };

    // 군인 상태로 전환
    commanderDoc.characterType = 'military';
    commanderDoc.rank = STARTING_RANK;
    commanderDoc.jobPosition = null;

    // 기함 지급
    const customFlagshipName = env?.flagshipName as string;
    commanderDoc.flagship = {
      ...STARTING_FLAGSHIP,
      name: customFlagshipName || `${commanderDoc.name}호`,
    };

    // 퇴역 관련 데이터 정리
    if (!commanderDoc.customData) commanderDoc.customData = {};
    delete commanderDoc.customData.retired;
    delete commanderDoc.customData.retiredAt;
    delete commanderDoc.customData.volunteerCooldownUntil;

    // 복귀 히스토리 기록
    if (!commanderDoc.customData.volunteerHistory) {
      commanderDoc.customData.volunteerHistory = [];
    }
    commanderDoc.customData.volunteerHistory.push({
      volunteeredAt: new Date(),
      previousRetirement,
      startingRank: STARTING_RANK,
    });

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    const rankName = getRankName(STARTING_RANK, commanderDoc.faction);

    return {
      success: true,
      message: `군에 입대했습니다! 계급: ${rankName}, 기함: ${commanderDoc.flagship.name} (${commanderDoc.flagship.type})`,
      effects: [
        {
          type: 'volunteer',
          commanderNo: commander.no,
          newRank: STARTING_RANK,
          newRankName: rankName,
          flagship: commanderDoc.flagship,
        },
      ],
    };
  }

  /**
   * 지원 가능 여부 및 남은 쿨타임 확인
   */
  static async checkVolunteerEligibility(
    sessionId: string,
    commanderNo: number
  ): Promise<{
    canVolunteer: boolean;
    reason?: string;
    remainingCooldownDays?: number;
  }> {
    const commanderDoc = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commanderDoc) {
      return { canVolunteer: false, reason: '커맨더를 찾을 수 없습니다.' };
    }

    if (commanderDoc.characterType !== 'politician' && !commanderDoc.customData?.retired) {
      return { canVolunteer: false, reason: '정치가 또는 퇴역 상태에서만 지원할 수 있습니다.' };
    }

    const cooldownUntil = commanderDoc.customData?.volunteerCooldownUntil;
    if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
      const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      return {
        canVolunteer: false,
        reason: '퇴역 후 쿨타임이 아직 남아있습니다.',
        remainingCooldownDays: remainingDays,
      };
    }

    return { canVolunteer: true };
  }
}
