/**
 * CrewType - 병종 시스템
 * PHP GameUnitDetail.php 포팅
 * 
 * 병종 계통:
 * - 보병: 창병, 극병, 도부, 모병
 * - 기병: 기병, 돌기병, 연노기병
 * - 궁병: 노병, 강궁병, 연노병
 * - 차병: 충차, 정란차, 발석거
 * - 기타: 수군, 상선, 전투선, 맹수
 */

export enum ArmType {
  INFANTRY = 1,   // 보병
  CAVALRY = 2,    // 기병
  ARCHER = 3,     // 궁병
  SIEGE = 4,      // 차병
  WIZARD = 5,     // 요술사 (노병 계열)
  CASTLE = 6,     // 성벽
  MISC = 7,       // 기타 (수군 등)
}

export interface CrewTypeStats {
  id: number;
  armType: ArmType;
  name: string;
  shortName: string;
  
  // 기본 능력치
  attack: number;       // 공격력
  defence: number;      // 방어력
  speed: number;        // 기동력
  avoid: number;        // 회피율
  magicCoef: number;    // 계략 계수
  
  // 비용
  cost: number;         // 금 비용
  rice: number;         // 군량 비용
  
  // 병종 상성 (attackCoef, defenceCoef)
  attackCoef: Record<number, number>;   // 공격 시 상대 병종에 대한 계수
  defenceCoef: Record<number, number>;  // 방어 시 상대 병종에 대한 계수
}

/**
 * 기본 병종 정의
 */
export const CREW_TYPES: Record<number, CrewTypeStats> = {
  // === 보병 계통 ===
  1: {
    id: 1,
    armType: ArmType.INFANTRY,
    name: '창병',
    shortName: '창병',
    attack: 50,
    defence: 50,
    speed: 5,
    avoid: 5,
    magicCoef: 1.0,
    cost: 50,
    rice: 25,
    attackCoef: {
      [ArmType.INFANTRY]: 1.0,
      [ArmType.CAVALRY]: 1.2,  // 창병 > 기병
      [ArmType.ARCHER]: 0.8,   // 창병 < 궁병
      [ArmType.SIEGE]: 1.0,
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 1.0,
      [ArmType.CAVALRY]: 1.1,
      [ArmType.ARCHER]: 0.9,
      [ArmType.SIEGE]: 1.0,
    },
  },
  
  2: {
    id: 2,
    armType: ArmType.INFANTRY,
    name: '극병',
    shortName: '극병',
    attack: 55,
    defence: 45,
    speed: 6,
    avoid: 5,
    magicCoef: 1.0,
    cost: 60,
    rice: 30,
    attackCoef: {
      [ArmType.INFANTRY]: 1.0,
      [ArmType.CAVALRY]: 1.3,  // 극병 >> 기병
      [ArmType.ARCHER]: 0.8,
      [ArmType.SIEGE]: 1.1,
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 1.0,
      [ArmType.CAVALRY]: 1.2,
      [ArmType.ARCHER]: 0.9,
      [ArmType.SIEGE]: 1.0,
    },
  },
  
  // === 기병 계통 ===
  4: {
    id: 4,
    armType: ArmType.CAVALRY,
    name: '기병',
    shortName: '기병',
    attack: 70,
    defence: 40,
    speed: 10,
    avoid: 10,
    magicCoef: 0.8,
    cost: 100,
    rice: 50,
    attackCoef: {
      [ArmType.INFANTRY]: 0.8,  // 기병 < 창병
      [ArmType.CAVALRY]: 1.0,
      [ArmType.ARCHER]: 1.3,    // 기병 >> 궁병
      [ArmType.SIEGE]: 0.9,
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 0.9,
      [ArmType.CAVALRY]: 1.0,
      [ArmType.ARCHER]: 1.2,
      [ArmType.SIEGE]: 1.0,
    },
  },
  
  // === 궁병 계통 ===
  3: {
    id: 3,
    armType: ArmType.ARCHER,
    name: '노병',
    shortName: '노병',
    attack: 45,
    defence: 35,
    speed: 5,
    avoid: 15,
    magicCoef: 1.2,
    cost: 70,
    rice: 35,
    attackCoef: {
      [ArmType.INFANTRY]: 1.2,  // 궁병 > 창병
      [ArmType.CAVALRY]: 0.7,   // 궁병 << 기병
      [ArmType.ARCHER]: 1.0,
      [ArmType.SIEGE]: 1.1,
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 1.1,
      [ArmType.CAVALRY]: 0.8,
      [ArmType.ARCHER]: 1.0,
      [ArmType.SIEGE]: 1.0,
    },
  },
  
  // === 차병 계통 ===
  5: {
    id: 5,
    armType: ArmType.SIEGE,
    name: '충차',
    shortName: '충차',
    attack: 80,
    defence: 30,
    speed: 3,
    avoid: 0,
    magicCoef: 0.5,
    cost: 150,
    rice: 75,
    attackCoef: {
      [ArmType.INFANTRY]: 0.9,
      [ArmType.CAVALRY]: 1.1,
      [ArmType.ARCHER]: 0.9,
      [ArmType.SIEGE]: 1.0,
      [ArmType.CASTLE]: 2.0,  // 충차 >> 성벽
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 0.8,
      [ArmType.CAVALRY]: 0.9,
      [ArmType.ARCHER]: 0.8,
      [ArmType.SIEGE]: 1.0,
    },
  },
  
  // === 성문 (방어 시설) ===
  100: {
    id: 100,
    armType: ArmType.CASTLE,
    name: '성문',
    shortName: '성문',
    attack: 40,
    defence: 100,
    speed: 0,
    avoid: 0,
    magicCoef: 0.0,
    cost: 0,
    rice: 0,
    attackCoef: {
      [ArmType.INFANTRY]: 1.0,
      [ArmType.CAVALRY]: 1.0,
      [ArmType.ARCHER]: 1.0,
      [ArmType.SIEGE]: 0.5,  // 성문 << 충차 (공성 무기에 약함)
    },
    defenceCoef: {
      [ArmType.INFANTRY]: 1.2,  // 일반 병종의 공격을 잘 막음
      [ArmType.CAVALRY]: 1.2,
      [ArmType.ARCHER]: 1.2,
      [ArmType.SIEGE]: 0.6,     // 충차 공격은 피해 증가
    },
  },
};

/**
 * CrewType 유틸리티 클래스
 */
export class CrewType {
  /**
   * 병종 ID로 병종 정보 가져오기
   */
  static getById(id: number): CrewTypeStats | null {
    return CREW_TYPES[id] || null;
  }

  /**
   * 공격 계수 가져오기
   * @param attackerId 공격자 병종 ID
   * @param defenderId 방어자 병종 ID
   * @returns 공격 계수 (1.0 = 대등, >1.0 = 유리, <1.0 = 불리)
   */
  static getAttackCoef(attackerId: number, defenderId: number): number {
    const attacker = CREW_TYPES[attackerId];
    const defender = CREW_TYPES[defenderId];
    
    if (!attacker || !defender) return 1.0;

    // 상대 병종 ID로 먼저 검색
    if (attacker.attackCoef[defenderId] !== undefined) {
      return attacker.attackCoef[defenderId];
    }

    // 상대 계통(armType)으로 검색
    if (attacker.attackCoef[defender.armType] !== undefined) {
      return attacker.attackCoef[defender.armType];
    }

    return 1.0; // 기본값
  }

  /**
   * 방어 계수 가져오기
   */
  static getDefenceCoef(defenderId: number, attackerId: number): number {
    const defender = CREW_TYPES[defenderId];
    const attacker = CREW_TYPES[attackerId];
    
    if (!defender || !attacker) return 1.0;

    if (defender.defenceCoef[attackerId] !== undefined) {
      return defender.defenceCoef[attackerId];
    }

    if (defender.defenceCoef[attacker.armType] !== undefined) {
      return defender.defenceCoef[attacker.armType];
    }

    return 1.0;
  }

  /**
   * 병종 상성 설명
   */
  static getAdvantageText(attackerId: number, defenderId: number): string {
    const coef = this.getAttackCoef(attackerId, defenderId);
    
    if (coef >= 1.3) return '매우 유리';
    if (coef >= 1.1) return '유리';
    if (coef <= 0.7) return '매우 불리';
    if (coef <= 0.9) return '불리';
    return '대등';
  }

  /**
   * 기술 레벨에 따른 비용 계산
   */
  static getCostWithTech(crewTypeId: number, tech: number, crew: number = 100): number {
    const crewType = CREW_TYPES[crewTypeId];
    if (!crewType) return 0;

    const techCoef = this.getTechCost(tech);
    return Math.round(crewType.cost * techCoef * crew / 100);
  }

  /**
   * 기술 레벨에 따른 군량 계산
   */
  static getRiceWithTech(crewTypeId: number, tech: number, crew: number = 100): number {
    const crewType = CREW_TYPES[crewTypeId];
    if (!crewType) return 0;

    const techCoef = this.getTechCost(tech);
    return Math.round(crewType.rice * techCoef * crew / 100);
  }

  /**
   * 기술 레벨에 따른 비용 계수
   * 기술이 높을수록 비용 감소
   */
  private static getTechCost(tech: number): number {
    // tech: 0~10000
    // 0: 1.0배, 1000: 0.95배, 5000: 0.75배, 10000: 0.5배
    return Math.max(0.5, 1.0 - (tech / 20000));
  }

  /**
   * 계산된 공격력 (장수 능력치 + 병종)
   */
  static getComputedAttack(
    crewTypeId: number,
    leadership: number,
    strength: number,
    intel: number,
    tech: number
  ): number {
    const crewType = CREW_TYPES[crewTypeId];
    if (!crewType) return 0;

    let ratio: number;

    // 병종 계통별 주 능력치
    if (crewType.armType === ArmType.WIZARD) {
      ratio = intel * 2 - 40; // 노병: 지력 기반
    } else if (crewType.armType === ArmType.SIEGE) {
      ratio = leadership * 2 - 40; // 충차: 통솔 기반
    } else if (crewType.armType === ArmType.MISC) {
      ratio = (intel + leadership + strength) * 2 / 3 - 40; // 기타: 평균
    } else {
      ratio = strength * 2 - 40; // 기본: 무력 기반
    }

    // 최소/최대 제한
    if (ratio < 10) ratio = 10;
    if (ratio > 100) ratio = 50 + ratio / 2;

    const techAbil = this.getTechAbil(tech);
    const attack = crewType.attack + techAbil;
    
    return Math.round(attack * ratio / 100);
  }

  /**
   * 계산된 방어력 (장수 병사 수 + 병종)
   */
  static getComputedDefence(
    crewTypeId: number,
    crew: number,
    tech: number
  ): number {
    const crewType = CREW_TYPES[crewTypeId];
    if (!crewType) return 0;

    const techAbil = this.getTechAbil(tech);
    const defence = crewType.defence + techAbil;
    
    // 병사 수에 따른 계수 (7000명 = 100%, 0명 = 70%)
    const crewCoef = (crew / (7000 / 30)) + 70;
    
    return Math.round(defence * crewCoef / 100);
  }

  /**
   * 기술 레벨에 따른 능력치 보너스
   */
  private static getTechAbil(tech: number): number {
    // tech: 0~10000
    // 0: +0, 1000: +5, 5000: +25, 10000: +50
    return Math.round(tech / 200);
  }
}
