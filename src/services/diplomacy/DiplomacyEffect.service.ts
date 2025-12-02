/**
 * DiplomacyEffect.service.ts - 외교 효과 서비스
 *
 * 외교 상태에 따른 게임 내 효과 적용
 * - 동맹국 영토 통과
 * - 불가침 시 공격 불가
 * - 선전포고/전쟁 시 보너스/페널티
 */

import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { DiplomacyState, DiplomacyStateService } from './DiplomacyState.service';

/**
 * 전투 수정치
 */
export interface CombatModifier {
  attackBonus: number;      // 공격력 보너스 (%)
  defenseBonus: number;     // 방어력 보너스 (%)
  moraleBonus: number;      // 사기 보너스
  description: string;      // 설명
}

/**
 * 이동 권한
 */
export interface MovementPermission {
  canEnter: boolean;        // 영토 진입 가능 여부
  canAttack: boolean;       // 공격 가능 여부
  reason?: string;          // 불가 사유
}

/**
 * 외교 보너스/페널티 설정
 */
export const DiplomacyEffectConfig = {
  // 선전포고 상태
  DECLARATION: {
    attackBonus: 0,
    defenseBonus: 0,
    moraleBonus: 0,
    description: '선전포고 상태'
  },
  
  // 교전 중
  WAR: {
    attackBonus: 5,           // 전쟁 시 공격력 5% 증가
    defenseBonus: 0,
    moraleBonus: 1,           // 사기 +1
    description: '교전 보너스'
  },
  
  // 기습 공격 (불가침 파기 후 공격)
  SURPRISE_ATTACK: {
    attackBonus: 15,          // 기습 시 공격력 15% 증가
    defenseBonus: -10,        // 방어력 10% 감소
    moraleBonus: 3,           // 사기 +3
    description: '기습 공격 보너스'
  },
  
  // 방어 측 (기습 당함)
  SURPRISE_DEFENSE: {
    attackBonus: 0,
    defenseBonus: -15,        // 방어력 15% 감소
    moraleBonus: -2,          // 사기 -2
    description: '기습 방어 페널티'
  },
  
  // 동맹국 지원
  ALLIED_SUPPORT: {
    attackBonus: 10,          // 동맹 지원 시 공격력 10% 증가
    defenseBonus: 10,         // 방어력 10% 증가
    moraleBonus: 2,           // 사기 +2
    description: '동맹 지원 보너스'
  }
};

/**
 * DiplomacyEffectService - 외교 효과 서비스
 */
export class DiplomacyEffectService {
  // ============================================
  // 이동/공격 권한
  // ============================================

  /**
   * 영토 진입 가능 여부 확인
   * 
   * @param sessionId - 세션 ID
   * @param myNationId - 내 국가 ID
   * @param targetNationId - 대상 영토의 국가 ID
   * @returns 이동 권한 정보
   */
  static async canEnterTerritory(
    sessionId: string,
    myNationId: number,
    targetNationId: number
  ): Promise<MovementPermission> {
    // 같은 국가면 당연히 가능
    if (myNationId === targetNationId) {
      return { canEnter: true, canAttack: false };
    }

    // 재야는 어디든 갈 수 있음 (공격은 불가)
    if (myNationId === 0) {
      return { canEnter: true, canAttack: false };
    }

    // 대상이 재야 영토면 진입 가능
    if (targetNationId === 0) {
      return { canEnter: true, canAttack: false };
    }

    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      myNationId,
      targetNationId
    );

    const state = relation?.state ?? DiplomacyState.PEACE;

    switch (state) {
      case DiplomacyState.ALLIANCE:
        // 동맹국: 영토 통과 가능, 공격 불가
        return {
          canEnter: true,
          canAttack: false,
          reason: '동맹국입니다'
        };

      case DiplomacyState.NO_AGGRESSION:
        // 불가침: 영토 통과 불가, 공격 불가
        return {
          canEnter: false,
          canAttack: false,
          reason: '불가침 조약 중입니다'
        };

      case DiplomacyState.PEACE:
        // 평화: 영토 통과 불가, 공격 불가 (선전포고 필요)
        return {
          canEnter: false,
          canAttack: false,
          reason: '선전포고가 필요합니다'
        };

      case DiplomacyState.DECLARATION:
        // 선전포고: 영토 진입 가능, 공격 가능
        return {
          canEnter: true,
          canAttack: true,
          reason: '선전포고 중'
        };

      case DiplomacyState.WAR:
        // 교전: 영토 진입 가능, 공격 가능
        return {
          canEnter: true,
          canAttack: true,
          reason: '교전 중'
        };

      default:
        return {
          canEnter: false,
          canAttack: false,
          reason: '알 수 없는 외교 상태'
        };
    }
  }

  /**
   * 공격 가능 여부 확인
   */
  static async canAttack(
    sessionId: string,
    attackerNationId: number,
    defenderNationId: number
  ): Promise<{ canAttack: boolean; reason?: string }> {
    if (attackerNationId === defenderNationId) {
      return { canAttack: false, reason: '같은 국가입니다' };
    }

    if (attackerNationId === 0) {
      return { canAttack: false, reason: '재야는 공격할 수 없습니다' };
    }

    if (defenderNationId === 0) {
      return { canAttack: false, reason: '재야 도시는 공격할 수 없습니다' };
    }

    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      attackerNationId,
      defenderNationId
    );

    const state = relation?.state ?? DiplomacyState.PEACE;

    switch (state) {
      case DiplomacyState.ALLIANCE:
        return { canAttack: false, reason: '동맹국은 공격할 수 없습니다' };

      case DiplomacyState.NO_AGGRESSION:
        return { canAttack: false, reason: '불가침 조약 중입니다' };

      case DiplomacyState.PEACE:
        return { canAttack: false, reason: '선전포고가 필요합니다' };

      case DiplomacyState.DECLARATION:
      case DiplomacyState.WAR:
        return { canAttack: true };

      default:
        return { canAttack: false, reason: '알 수 없는 외교 상태' };
    }
  }

  // ============================================
  // 전투 수정치
  // ============================================

  /**
   * 전투 수정치 계산
   * 
   * @param sessionId - 세션 ID
   * @param attackerNationId - 공격 국가 ID
   * @param defenderNationId - 방어 국가 ID
   * @returns 공격자/방어자 수정치
   */
  static async getCombatModifiers(
    sessionId: string,
    attackerNationId: number,
    defenderNationId: number
  ): Promise<{
    attacker: CombatModifier;
    defender: CombatModifier;
  }> {
    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      attackerNationId,
      defenderNationId
    );

    const state = relation?.state ?? DiplomacyState.PEACE;

    // 기본 수정치 (없음)
    const defaultModifier: CombatModifier = {
      attackBonus: 0,
      defenseBonus: 0,
      moraleBonus: 0,
      description: '기본'
    };

    let attackerMod: CombatModifier = { ...defaultModifier };
    let defenderMod: CombatModifier = { ...defaultModifier };

    switch (state) {
      case DiplomacyState.WAR:
        // 교전 중: 공격자에게 약간의 보너스
        attackerMod = {
          ...DiplomacyEffectConfig.WAR,
          description: '교전 보너스'
        };
        break;

      case DiplomacyState.DECLARATION:
        // 선전포고 중: 첫 공격에 기습 보너스 (간략화)
        attackerMod = {
          attackBonus: 3,
          defenseBonus: 0,
          moraleBonus: 1,
          description: '선전포고 공격'
        };
        break;

      default:
        // 그 외 상태에서는 기본 수정치
        break;
    }

    return {
      attacker: attackerMod,
      defender: defenderMod
    };
  }

  /**
   * 동맹 지원 보너스 확인
   * 
   * @param sessionId - 세션 ID
   * @param myNationId - 내 국가 ID
   * @param battleLocation - 전투 위치의 국가 ID
   * @returns 동맹 지원 보너스 여부 및 수정치
   */
  static async getAlliedSupportBonus(
    sessionId: string,
    myNationId: number,
    battleLocation: number
  ): Promise<CombatModifier | null> {
    // 같은 국가면 지원 보너스 없음
    if (myNationId === battleLocation) {
      return null;
    }

    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      myNationId,
      battleLocation
    );

    // 동맹국 영토에서 싸울 때만 보너스
    if (relation?.state === DiplomacyState.ALLIANCE) {
      return {
        ...DiplomacyEffectConfig.ALLIED_SUPPORT,
        description: '동맹국 영토 지원 보너스'
      };
    }

    return null;
  }

  // ============================================
  // 외교 효과 적용
  // ============================================

  /**
   * 공격력에 외교 보너스 적용
   */
  static applyAttackBonus(baseAttack: number, modifier: CombatModifier): number {
    const bonus = baseAttack * (modifier.attackBonus / 100);
    return Math.round(baseAttack + bonus);
  }

  /**
   * 방어력에 외교 보너스 적용
   */
  static applyDefenseBonus(baseDefense: number, modifier: CombatModifier): number {
    const bonus = baseDefense * (modifier.defenseBonus / 100);
    return Math.round(baseDefense + bonus);
  }

  /**
   * 사기에 외교 보너스 적용
   */
  static applyMoraleBonus(baseMorale: number, modifier: CombatModifier): number {
    return Math.max(0, Math.min(100, baseMorale + modifier.moraleBonus));
  }

  // ============================================
  // 동맹 관련 유틸리티
  // ============================================

  /**
   * 동맹국 목록 조회
   */
  static async getAllies(
    sessionId: string,
    nationId: number
  ): Promise<number[]> {
    return DiplomacyStateService.getNationsWithState(
      sessionId,
      nationId,
      DiplomacyState.ALLIANCE
    );
  }

  /**
   * 불가침국 목록 조회
   */
  static async getNonAggressionPacts(
    sessionId: string,
    nationId: number
  ): Promise<number[]> {
    return DiplomacyStateService.getNationsWithState(
      sessionId,
      nationId,
      DiplomacyState.NO_AGGRESSION
    );
  }

  /**
   * 교전국 목록 조회
   */
  static async getEnemies(
    sessionId: string,
    nationId: number
  ): Promise<number[]> {
    return DiplomacyStateService.getEnemyNations(sessionId, nationId);
  }

  /**
   * 동맹국인지 확인
   */
  static async isAlly(
    sessionId: string,
    nationId1: number,
    nationId2: number
  ): Promise<boolean> {
    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      nationId1,
      nationId2
    );
    return relation?.state === DiplomacyState.ALLIANCE;
  }

  /**
   * 적국인지 확인 (교전 또는 선전포고)
   */
  static async isEnemy(
    sessionId: string,
    nationId1: number,
    nationId2: number
  ): Promise<boolean> {
    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      nationId1,
      nationId2
    );
    return relation?.state === DiplomacyState.WAR || 
           relation?.state === DiplomacyState.DECLARATION;
  }

  /**
   * 불가침 중인지 확인
   */
  static async hasNonAggressionPact(
    sessionId: string,
    nationId1: number,
    nationId2: number
  ): Promise<boolean> {
    const relation = await DiplomacyStateService.getRelation(
      sessionId,
      nationId1,
      nationId2
    );
    return relation?.state === DiplomacyState.NO_AGGRESSION;
  }
}


