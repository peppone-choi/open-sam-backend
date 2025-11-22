/**
 * [전술] 대열 명령 (隊列命令)
 * 함선 그룹화 및 대열 변경
 * 
 * 진형 종류:
 * - standard: 표준 진형 (균형잡힌 공격/방어)
 * - offensive: 공격 진형 (공격력 +20%, 방어력 -10%)
 * - defensive: 방어 진형 (방어력 +20%, 공격력 -10%)
 * - encircle: 포위 진형 (측면 공격 +10%, 기동력 -20%)
 * - retreat: 후퇴 진형 (기동력 +30%, 공격력 -50%)
 * - wedge: 쐐기 진형 (돌파력 +30%, 측면 취약)
 * - crane: 학익진 (포위 유리, 중앙 취약)
 */

import { Fleet } from '../../../models/logh/Fleet.model';

type FormationType = 'standard' | 'offensive' | 'defensive' | 'encircle' | 'retreat' | 'wedge' | 'crane';

interface FormationStats {
  attackBonus: number; // 공격력 보정 (%)
  defenseBonus: number; // 방어력 보정 (%)
  mobilityBonus: number; // 기동력 보정 (%)
  moraleEffect: number; // 사기 영향
}

export class FormationTacticalCommand {
  getName(): string {
    return 'formation';
  }

  getDisplayName(): string {
    return '대열 명령';
  }

  getDescription(): string {
    return '함선 그룹화 및 대열 변경. 진형에 따라 전투력이 변화합니다.';
  }

  getShortcut(): string {
    return 'v';
  }

  getExecutionDelay(): number {
    return 5; // 5 게임시간 (약 12.5초 실시간)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 진형별 능력치 보정
   */
  private getFormationStats(formation: FormationType): FormationStats {
    const formationMap: Record<FormationType, FormationStats> = {
      standard: {
        attackBonus: 0,
        defenseBonus: 0,
        mobilityBonus: 0,
        moraleEffect: 0,
      },
      offensive: {
        attackBonus: 20,
        defenseBonus: -10,
        mobilityBonus: 0,
        moraleEffect: 5, // 공격 진형은 사기 상승
      },
      defensive: {
        attackBonus: -10,
        defenseBonus: 20,
        mobilityBonus: -10,
        moraleEffect: -3, // 방어 진형은 약간 사기 하락
      },
      encircle: {
        attackBonus: 10,
        defenseBonus: 0,
        mobilityBonus: -20,
        moraleEffect: 0,
      },
      retreat: {
        attackBonus: -50,
        defenseBonus: -20,
        mobilityBonus: 30,
        moraleEffect: -10, // 후퇴는 사기 크게 하락
      },
      wedge: {
        attackBonus: 30,
        defenseBonus: -15,
        mobilityBonus: 10,
        moraleEffect: 8, // 쐐기진은 사기 상승
      },
      crane: {
        attackBonus: 5,
        defenseBonus: -5,
        mobilityBonus: 5,
        moraleEffect: 3,
      },
    };

    return formationMap[formation];
  }

  /**
   * 진형 변경 가능 여부 체크
   */
  private canChangeFormation(fleet: any, targetFormation: FormationType): string | null {
    // 전투 중이 아니면 언제든 변경 가능
    if (!fleet.isInCombat) {
      return null;
    }

    // 전투 중에는 제약 조건 있음
    if (fleet.status === 'moving') {
      return '이동 중에는 진형을 변경할 수 없습니다.';
    }

    // 후퇴 진형으로 변경은 사기가 30 이상 필요
    if (targetFormation === 'retreat' && fleet.morale < 30) {
      return '사기가 너무 낮아 후퇴 진형을 취할 수 없습니다.';
    }

    // 쐐기진은 공격적인 진형이므로 사기 50 이상 필요
    if (targetFormation === 'wedge' && fleet.morale < 50) {
      return '사기가 부족하여 쐐기 진형을 취할 수 없습니다.';
    }

    return null;
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, formation } = params;

    if (!formation) {
      return {
        success: false,
        message: '사용할 진형을 선택해야 합니다. (표준·공격·방어 등)',
      };
    }

    // 함대 조회
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 진형 유효성 체크
    const validFormations: FormationType[] = ['standard', 'offensive', 'defensive', 'encircle', 'retreat', 'wedge', 'crane'];
    if (!validFormations.includes(formation)) {
      return {
        success: false,
        message: `유효하지 않은 진형입니다: ${formation}`,
      };
    }

    // 진형 변경 가능 여부 체크
    const canChange = this.canChangeFormation(fleet, formation);
    if (canChange) {
      return {
        success: false,
        message: canChange,
      };
    }

    // 이전 진형 저장
    const oldFormation = fleet.formation;

    // 진형 변경
    fleet.formation = formation;

    // 진형 보정 적용
    const stats = this.getFormationStats(formation);
    fleet.morale = Math.max(0, Math.min(100, fleet.morale + stats.moraleEffect));

    // 진형 변경 로그
    if (!fleet.customData) fleet.customData = {};
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'formation_change',
      from: oldFormation,
      to: formation,
      stats,
    });

    await fleet.save();

    // 진형 이름 한글화
    const formationNames: Record<FormationType, string> = {
      standard: '표준 진형',
      offensive: '공격 진형',
      defensive: '방어 진형',
      encircle: '포위 진형',
      retreat: '후퇴 진형',
      wedge: '쐐기 진형',
      crane: '학익진',
    };

    return {
      success: true,
      message: `${formationNames[formation]}으로 변경했습니다. (공격 ${stats.attackBonus > 0 ? '+' : ''}${stats.attackBonus}%, 방어 ${stats.defenseBonus > 0 ? '+' : ''}${stats.defenseBonus}%)`,
    };
  }
}
