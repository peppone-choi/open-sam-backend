/**
 * 퇴역 (Retirement)
 * 군인이 군을 떠나 정치가가 되는 커맨드
 * 
 * - 퇴역 후 30G일간 지원(Volunteer) 커맨드 사용 불가
 * - 최종 계급에 따른 연금/명성 계산
 * - 함대 지휘권 자동 해제
 * - characterType: 'military' → 'politician'
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Fleet } from '../../../models/logh/Fleet.model';
import { getRankName } from '../../../utils/logh-rank-system';

/** 퇴역 후 지원 쿨타임 (게임 일 기준) */
const VOLUNTEER_COOLDOWN_DAYS = 30;

/** 계급별 퇴역 연금 테이블 (1회성 지급) */
const RETIREMENT_PENSION: Record<number, number> = {
  0: 100,      // 이등병
  1: 150,      // 일등병
  2: 200,      // 상등병
  3: 300,      // 병장
  4: 400,      // 하사
  5: 500,      // 중사
  6: 600,      // 상사
  7: 800,      // 준위
  8: 1000,     // 소위
  9: 1500,     // 중위
  10: 2000,    // 대위
  11: 3000,    // 소좌
  12: 5000,    // 중좌
  13: 8000,    // 대좌
  14: 12000,   // 준장
  15: 20000,   // 소장
  16: 35000,   // 중장
  17: 60000,   // 상급대장
  18: 100000,  // 원수
};

/** 계급별 퇴역 명성 보너스 */
const RETIREMENT_FAME_BONUS: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 5,
  5: 10,
  6: 15,
  7: 20,
  8: 30,
  9: 40,
  10: 50,
  11: 75,
  12: 100,
  13: 150,
  14: 200,
  15: 300,
  16: 500,
  17: 800,
  18: 1500,
};

export class RetirementCommand extends BaseLoghCommand {
  getName(): string {
    return 'retirement';
  }

  getDisplayName(): string {
    return '퇴역';
  }

  getDescription(): string {
    return `군을 물러나 정치가가 됩니다. 퇴역 후 ${VOLUNTEER_COOLDOWN_DAYS}G일간 지원 커맨드 사용 불가. 최종 계급에 따라 연금과 명성 보너스를 받습니다.`;
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

    // 군인 상태 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          return data.characterType === 'military' || !data.customData?.retired;
        },
        '이미 퇴역한 상태입니다.'
      )
    );

    // 전투 중이 아닌지 체크
    constraints.push(
      ConstraintHelper.createCustom(
        (ctx) => {
          const data = ctx.commander.data;
          return !data.activeCommands?.some((cmd: any) => 
            cmd.commandType.startsWith('tactical_') || cmd.commandType === 'combat'
          );
        },
        '전투 중에는 퇴역할 수 없습니다.'
      )
    );

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

    // Commander 문서 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc) {
      return { success: false, message: '커맨더를 찾을 수 없습니다.' };
    }

    // 이미 퇴역 상태인지 확인
    if (commanderDoc.characterType === 'politician' || commanderDoc.customData?.retired) {
      return { success: false, message: '이미 퇴역한 상태입니다.' };
    }

    const oldRank = commanderDoc.rank;
    const oldRankName = getRankName(oldRank, commanderDoc.faction);

    // 함대 지휘권 해제
    let fleetReleased = false;
    if (commanderDoc.fleetId) {
      const fleet = await Fleet.findOne({
        session_id: commander.session_id,
        fleetId: commanderDoc.fleetId,
      });

      if (fleet) {
        fleet.commanderId = undefined;
        fleet.commanderName = '무소속';
        await fleet.save();
        fleetReleased = true;
      }
      commanderDoc.fleetId = null;
    }

    // 퇴역 연금 계산
    const pension = RETIREMENT_PENSION[oldRank] || RETIREMENT_PENSION[0];
    const fameBonus = RETIREMENT_FAME_BONUS[oldRank] || 0;

    // 개인 자금에 연금 추가
    if (!commanderDoc.customData) commanderDoc.customData = {};
    const currentFunds = commanderDoc.customData.personalFunds || 0;
    commanderDoc.customData.personalFunds = currentFunds + pension;

    // 명성 보너스 추가
    commanderDoc.fame += fameBonus;

    // 퇴역 상태 설정
    commanderDoc.characterType = 'politician';
    commanderDoc.customData.retired = true;
    commanderDoc.customData.retiredAt = new Date();
    commanderDoc.customData.retiredRank = oldRank;
    commanderDoc.customData.retiredRankName = oldRankName;
    commanderDoc.customData.volunteerCooldownUntil = new Date(
      Date.now() + VOLUNTEER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    // 직책 변경
    commanderDoc.jobPosition = '정치가';

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    commanderDoc.markModified('customData');
    await commanderDoc.save();
    await commander.save();

    return {
      success: true,
      message: `군을 퇴역하고 정치가가 되었습니다. (${oldRankName} → 정치가)\n연금: ${pension}, 명성 보너스: +${fameBonus}${fleetReleased ? '\n함대 지휘권이 해제되었습니다.' : ''}`,
      effects: [
        {
          type: 'retirement',
          commanderNo: commander.no,
          oldRank,
          oldRankName,
          pension,
          fameBonus,
          fleetReleased,
          cooldownDays: VOLUNTEER_COOLDOWN_DAYS,
        },
      ],
    };
  }

  /**
   * 퇴역 시뮬레이션 (예상 연금/명성 확인)
   */
  static simulateRetirement(rank: number): {
    pension: number;
    fameBonus: number;
    cooldownDays: number;
  } {
    return {
      pension: RETIREMENT_PENSION[rank] || RETIREMENT_PENSION[0],
      fameBonus: RETIREMENT_FAME_BONUS[rank] || 0,
      cooldownDays: VOLUNTEER_COOLDOWN_DAYS,
    };
  }
}
