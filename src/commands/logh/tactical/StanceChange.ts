/**
 * [전술] 자세 변경 (姿勢変更, Stance Change)
 * 공격/방어/대기 자세 변경
 * 
 * 자세 종류:
 * - aggressive: 공격적 (자동 추적 & 공격, 사정거리 확장)
 * - defensive: 방어적 (현위치 고수, 방어력 증가)
 * - balanced: 균형 (표준 자세)
 * - hold_fire: 사격 대기 (이동만, 공격 안함)
 * - evasive: 회피 기동 (기동력 증가, 명중률 감소)
 */

import { Fleet } from '../../../models/logh/Fleet.model';

type CombatStance = 'aggressive' | 'defensive' | 'balanced' | 'hold_fire' | 'evasive';

interface StanceModifiers {
  attackRange: number; // 사정거리 보정 (%)
  fireRate: number; // 사격 속도 보정 (%)
  evasion: number; // 회피율 보정 (%)
  mobility: number; // 기동력 보정 (%)
  accuracy: number; // 명중률 보정 (%)
}

export class StanceChangeTacticalCommand {
  getName(): string {
    return 'stance_change';
  }

  getDisplayName(): string {
    return '자세 변경';
  }

  getDescription(): string {
    return '전투 자세를 변경합니다. 공격적, 방어적, 균형, 사격대기, 회피 자세 선택 가능.';
  }

  getShortcut(): string {
    return 'c';
  }

  getExecutionDelay(): number {
    return 3; // 3 게임시간 (7.5초)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 자세별 능력치 보정
   */
  private getStanceModifiers(stance: CombatStance): StanceModifiers {
    const modifiers: Record<CombatStance, StanceModifiers> = {
      aggressive: {
        attackRange: 10, // 사정거리 +10%
        fireRate: 20, // 사격 속도 +20%
        evasion: -10, // 회피율 -10%
        mobility: 15, // 기동력 +15%
        accuracy: -5, // 명중률 -5% (무리한 공격)
      },
      defensive: {
        attackRange: -10, // 사정거리 -10%
        fireRate: -10, // 사격 속도 -10%
        evasion: 20, // 회피율 +20%
        mobility: -20, // 기동력 -20%
        accuracy: 10, // 명중률 +10% (신중한 사격)
      },
      balanced: {
        attackRange: 0,
        fireRate: 0,
        evasion: 0,
        mobility: 0,
        accuracy: 0,
      },
      hold_fire: {
        attackRange: 0,
        fireRate: -100, // 사격 안함
        evasion: 10, // 회피율 +10%
        mobility: 20, // 기동력 +20% (사격 안하고 이동만)
        accuracy: 0,
      },
      evasive: {
        attackRange: -20, // 사정거리 -20%
        fireRate: -30, // 사격 속도 -30%
        evasion: 40, // 회피율 +40%
        mobility: 50, // 기동력 +50%
        accuracy: -20, // 명중률 -20%
      },
    };

    return modifiers[stance];
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, stance } = params;

    if (!stance) {
      return {
        success: false,
        message: '전투 자세를 선택해야 합니다. (공격·방어·균형 등)',
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

    // 자세 유효성 체크
    const validStances: CombatStance[] = ['aggressive', 'defensive', 'balanced', 'hold_fire', 'evasive'];
    if (!validStances.includes(stance)) {
      return {
        success: false,
        message: `유효하지 않은 자세입니다: ${stance}`,
      };
    }

    // 현재 자세 저장
    const oldStance = fleet.customData?.combatStance || 'balanced';

    // 자세 변경
    if (!fleet.customData) fleet.customData = {};
    fleet.customData.combatStance = stance;

    // 자세 보정값 적용
    const modifiers = this.getStanceModifiers(stance);
    fleet.customData.stanceModifiers = modifiers;

    // 로그 기록
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'stance_change',
      from: oldStance,
      to: stance,
      modifiers,
    });

    await fleet.save();

    // 자세 이름 한글화
    const stanceNames: Record<CombatStance, string> = {
      aggressive: '공격적 자세',
      defensive: '방어적 자세',
      balanced: '균형 자세',
      hold_fire: '사격 대기',
      evasive: '회피 기동',
    };

    // 주요 변화 설명
    const changes: string[] = [];
    if (modifiers.attackRange !== 0) {
      changes.push(`사정거리 ${modifiers.attackRange > 0 ? '+' : ''}${modifiers.attackRange}%`);
    }
    if (modifiers.fireRate !== 0 && modifiers.fireRate !== -100) {
      changes.push(`사격속도 ${modifiers.fireRate > 0 ? '+' : ''}${modifiers.fireRate}%`);
    }
    if (modifiers.fireRate === -100) {
      changes.push('사격 중지');
    }
    if (modifiers.evasion !== 0) {
      changes.push(`회피 ${modifiers.evasion > 0 ? '+' : ''}${modifiers.evasion}%`);
    }
    if (modifiers.mobility !== 0) {
      changes.push(`기동력 ${modifiers.mobility > 0 ? '+' : ''}${modifiers.mobility}%`);
    }

    return {
      success: true,
      message: `${stanceNames[stance]}로 변경했습니다. ${changes.length > 0 ? `(${changes.join(', ')})` : ''}`,
    };
  }

  /**
   * 현재 자세의 보정값 가져오기 (전투 계산 시 사용)
   */
  static getFleetStanceModifiers(fleet: any): StanceModifiers {
    const stance = fleet.customData?.combatStance || 'balanced';
    const command = new StanceChangeTacticalCommand();
    return command.getStanceModifiers(stance as CombatStance);
  }
}
