/**
 * ShipSpecService - GIN7 함선 스펙 조회 및 계산 서비스
 * 
 * 기능:
 * - 함선 스펙 조회 (getSpec)
 * - 진영별 함선 목록 (getByFaction)
 * - 전투력 계산 (calculateCombatPower)
 * - 함선 비교 (compareShips)
 */

import {
  DetailedShipSpec,
  FighterSpec,
  ShipTypeCode,
  ALL_SHIPS,
  ALL_EMPIRE_SHIPS,
  ALL_ALLIANCE_SHIPS,
  ALL_FIGHTERS,
  SHIP_BY_TYPE_CODE,
  VALKYRIE_FIGHTER,
  TORPEDO_BOAT,
  SPARTANIAN_FIGHTER,
} from '../../constants/gin7/ship_spec_database';
import { ShipClass, ShipVariant } from '../../constants/gin7/ship_definitions';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 승조원 품질 등급
 */
export type ShipCrewQuality = 
  | 'CONSCRIPT'   // 징집병 (0.7)
  | 'RECRUIT'     // 신병 (0.85)
  | 'REGULAR'     // 일반 (1.0)
  | 'VETERAN'     // 숙련 (1.15)
  | 'ELITE';      // 정예 (1.3)

/**
 * 전투력 계산 결과
 */
export interface CombatPowerResult {
  shipId: string;
  shipName: string;
  
  // 총 전투력
  totalPower: number;
  
  // 세부 전투력
  offensivePower: number;   // 공격력
  defensivePower: number;   // 방어력
  mobilityPower: number;    // 기동력
  supportPower: number;     // 지원력
  
  // 보정 계수
  crewMultiplier: number;
  
  // 세부 수치
  breakdown: {
    beamDps: number;
    gunDps: number;
    missileDps: number;
    aaDps: number;
    armorValue: number;
    shieldValue: number;
    speedValue: number;
    sensorValue: number;
    cargoValue: number;
    fighterValue: number;
  };
}

/**
 * 함선 비교 결과
 */
export interface ShipComparisonResult {
  shipA: {
    id: string;
    name: string;
    spec: DetailedShipSpec;
    combatPower: CombatPowerResult;
  };
  shipB: {
    id: string;
    name: string;
    spec: DetailedShipSpec;
    combatPower: CombatPowerResult;
  };
  
  // 비교 결과
  comparison: {
    totalPowerDiff: number;      // + A 우세, - B 우세
    offensiveDiff: number;
    defensiveDiff: number;
    mobilityDiff: number;
    
    advantages: {
      shipA: string[];
      shipB: string[];
    };
    
    recommendation: string;
  };
}

/**
 * 함선 필터 옵션
 */
export interface ShipFilterOptions {
  faction?: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  shipClass?: ShipClass;
  typeCode?: ShipTypeCode;
  minTechLevel?: number;
  maxTechLevel?: number;
  minBuildTime?: number;
  maxBuildTime?: number;
  hasFighterCapacity?: boolean;
  hasTroopCapacity?: boolean;
}

// ============================================================
// 승조원 품질 배율
// ============================================================

const CREW_QUALITY_MULTIPLIERS: Record<ShipCrewQuality, number> = {
  CONSCRIPT: 0.7,
  RECRUIT: 0.85,
  REGULAR: 1.0,
  VETERAN: 1.15,
  ELITE: 1.3,
};

// ============================================================
// ShipSpecService 클래스
// ============================================================

export class ShipSpecService {
  
  // ============================================================
  // 스펙 조회 메서드
  // ============================================================
  
  /**
   * 함선 ID로 스펙 조회
   * @param shipId - 조회할 함선의 고유 ID (예: "SS75_I", "ACH_II")
   */
  getSpec(shipId: string): DetailedShipSpec | undefined {
    // 직접 ID 매칭 시도
    const directMatch = ALL_SHIPS.find(ship => 
      `${ship.typeCode}_${ship.variant}` === shipId ||
      ship.modelName === shipId
    );
    
    if (directMatch) {
      return directMatch;
    }
    
    // 부분 매칭 시도 (이름으로)
    return ALL_SHIPS.find(ship => 
      ship.nameKo.includes(shipId) ||
      ship.nameEn.toLowerCase().includes(shipId.toLowerCase())
    );
  }
  
  /**
   * 함선 클래스와 바리에이션으로 스펙 조회
   */
  getSpecByClassVariant(
    shipClass: ShipClass,
    variant: ShipVariant,
    faction: 'EMPIRE' | 'ALLIANCE' = 'EMPIRE'
  ): DetailedShipSpec | undefined {
    const ships = faction === 'EMPIRE' ? ALL_EMPIRE_SHIPS : ALL_ALLIANCE_SHIPS;
    
    return ships.find(ship => 
      ship.class === shipClass && 
      ship.variant === variant
    );
  }
  
  /**
   * 타입 코드로 함선 목록 조회
   */
  getByTypeCode(typeCode: ShipTypeCode): DetailedShipSpec[] {
    return SHIP_BY_TYPE_CODE.get(typeCode) || [];
  }
  
  /**
   * 진영별 함선 목록 조회
   */
  getByFaction(faction: 'EMPIRE' | 'ALLIANCE' | 'ALL'): DetailedShipSpec[] {
    switch (faction) {
      case 'EMPIRE':
        return [...ALL_EMPIRE_SHIPS];
      case 'ALLIANCE':
        return [...ALL_ALLIANCE_SHIPS];
      case 'ALL':
      default:
        return [...ALL_SHIPS];
    }
  }
  
  /**
   * 함선 클래스별 목록 조회
   */
  getByShipClass(shipClass: ShipClass): DetailedShipSpec[] {
    return ALL_SHIPS.filter(ship => ship.class === shipClass);
  }
  
  /**
   * 필터 옵션으로 함선 검색
   */
  searchShips(options: ShipFilterOptions): DetailedShipSpec[] {
    let result = [...ALL_SHIPS];
    
    if (options.faction && options.faction !== 'BOTH') {
      result = result.filter(ship => ship.faction === options.faction);
    }
    
    if (options.shipClass) {
      result = result.filter(ship => ship.class === options.shipClass);
    }
    
    if (options.typeCode) {
      result = result.filter(ship => ship.typeCode === options.typeCode);
    }
    
    if (options.minTechLevel !== undefined) {
      result = result.filter(ship => ship.techLevel >= options.minTechLevel!);
    }
    
    if (options.maxTechLevel !== undefined) {
      result = result.filter(ship => ship.techLevel <= options.maxTechLevel!);
    }
    
    if (options.minBuildTime !== undefined) {
      result = result.filter(ship => ship.buildTime >= options.minBuildTime!);
    }
    
    if (options.maxBuildTime !== undefined) {
      result = result.filter(ship => ship.buildTime <= options.maxBuildTime!);
    }
    
    if (options.hasFighterCapacity) {
      result = result.filter(ship => ship.fighterCapacity > 0);
    }
    
    if (options.hasTroopCapacity) {
      result = result.filter(ship => ship.troopCapacity > 0);
    }
    
    return result;
  }
  
  // ============================================================
  // 전투정 관련 메서드
  // ============================================================
  
  /**
   * 전투정 스펙 조회
   */
  getFighterSpec(fighterId: string): FighterSpec | undefined {
    return ALL_FIGHTERS.find(fighter => 
      fighter.id === fighterId ||
      fighter.nameKo === fighterId ||
      fighter.nameEn.toLowerCase() === fighterId.toLowerCase()
    );
  }
  
  /**
   * 진영별 전투정 목록
   */
  getFightersByFaction(faction: 'EMPIRE' | 'ALLIANCE'): FighterSpec[] {
    return ALL_FIGHTERS.filter(fighter => fighter.faction === faction);
  }
  
  /**
   * 모든 전투정 목록
   */
  getAllFighters(): FighterSpec[] {
    return [...ALL_FIGHTERS];
  }
  
  // ============================================================
  // 전투력 계산 메서드
  // ============================================================
  
  /**
   * 함선 전투력 계산
   * @param shipId - 함선 ID 또는 스펙
   * @param crewQuality - 승조원 품질 (기본: REGULAR)
   */
  calculateCombatPower(
    shipIdOrSpec: string | DetailedShipSpec,
    crewQuality: ShipCrewQuality = 'REGULAR'
  ): CombatPowerResult | null {
    // 스펙 가져오기
    const spec = typeof shipIdOrSpec === 'string' 
      ? this.getSpec(shipIdOrSpec)
      : shipIdOrSpec;
    
    if (!spec) {
      return null;
    }
    
    const crewMultiplier = CREW_QUALITY_MULTIPLIERS[crewQuality];
    
    // 세부 수치 계산
    const beamDps = spec.beamPower * 3; // 빔은 연속 공격이므로 가중치
    const gunDps = spec.gunPower;
    const missileDps = spec.missilePower * 1.2; // 미사일은 범위 공격이므로 가중치
    const aaDps = spec.aaPower * 0.8; // 대공은 방어적이므로 낮은 가중치
    
    const armorValue = (spec.frontArmor * 1.5 + spec.sideArmor + spec.rearArmor * 0.5) / 3;
    const shieldValue = (spec.shieldProtection + spec.shieldCapacity / 1000) * 2;
    
    const speedValue = spec.maxSpeed / 1000;
    const sensorValue = spec.sensorRange * 0.5;
    
    const cargoValue = spec.cargoCapacity / 5000;
    const fighterValue = spec.fighterCapacity * 5;
    
    // 공격력 계산
    const offensivePower = Math.round(
      (beamDps + gunDps + missileDps + aaDps) * crewMultiplier
    );
    
    // 방어력 계산
    const defensivePower = Math.round(
      (armorValue + shieldValue + spec.hullStrength / 500) * crewMultiplier
    );
    
    // 기동력 계산
    const mobilityPower = Math.round(
      (speedValue + sensorValue + spec.evasionBonus) * crewMultiplier
    );
    
    // 지원력 계산
    const supportPower = Math.round(
      (cargoValue + fighterValue + spec.troopCapacity / 100)
    );
    
    // 총 전투력
    const totalPower = Math.round(
      offensivePower * 0.4 + 
      defensivePower * 0.35 + 
      mobilityPower * 0.15 + 
      supportPower * 0.1
    );
    
    return {
      shipId: `${spec.typeCode}_${spec.variant}`,
      shipName: spec.nameKo,
      totalPower,
      offensivePower,
      defensivePower,
      mobilityPower,
      supportPower,
      crewMultiplier,
      breakdown: {
        beamDps: Math.round(beamDps),
        gunDps: Math.round(gunDps),
        missileDps: Math.round(missileDps),
        aaDps: Math.round(aaDps),
        armorValue: Math.round(armorValue),
        shieldValue: Math.round(shieldValue),
        speedValue: Math.round(speedValue * 10) / 10,
        sensorValue: Math.round(sensorValue * 10) / 10,
        cargoValue: Math.round(cargoValue * 10) / 10,
        fighterValue: Math.round(fighterValue),
      },
    };
  }
  
  /**
   * 함대 총 전투력 계산
   * @param ships - 함선 ID 배열 또는 {shipId, count, crewQuality}[] 배열
   */
  calculateFleetPower(
    ships: Array<{ shipId: string; count: number; crewQuality?: ShipCrewQuality }>
  ): {
    totalPower: number;
    breakdown: CombatPowerResult[];
    summary: {
      totalShips: number;
      offensiveTotal: number;
      defensiveTotal: number;
      mobilityAvg: number;
    };
  } {
    const breakdown: CombatPowerResult[] = [];
    let totalPower = 0;
    let totalShips = 0;
    let offensiveTotal = 0;
    let defensiveTotal = 0;
    let mobilitySum = 0;
    
    for (const entry of ships) {
      const power = this.calculateCombatPower(entry.shipId, entry.crewQuality || 'REGULAR');
      if (power) {
        const scaledPower = {
          ...power,
          totalPower: power.totalPower * entry.count,
          offensivePower: power.offensivePower * entry.count,
          defensivePower: power.defensivePower * entry.count,
        };
        
        breakdown.push(scaledPower);
        totalPower += scaledPower.totalPower;
        totalShips += entry.count;
        offensiveTotal += scaledPower.offensivePower;
        defensiveTotal += scaledPower.defensivePower;
        mobilitySum += power.mobilityPower * entry.count;
      }
    }
    
    return {
      totalPower,
      breakdown,
      summary: {
        totalShips,
        offensiveTotal,
        defensiveTotal,
        mobilityAvg: totalShips > 0 ? Math.round(mobilitySum / totalShips) : 0,
      },
    };
  }
  
  // ============================================================
  // 함선 비교 메서드
  // ============================================================
  
  /**
   * 두 함선 비교
   */
  compareShips(
    shipIdA: string | DetailedShipSpec,
    shipIdB: string | DetailedShipSpec,
    crewQuality: ShipCrewQuality = 'REGULAR'
  ): ShipComparisonResult | null {
    const specA = typeof shipIdA === 'string' ? this.getSpec(shipIdA) : shipIdA;
    const specB = typeof shipIdB === 'string' ? this.getSpec(shipIdB) : shipIdB;
    
    if (!specA || !specB) {
      return null;
    }
    
    const powerA = this.calculateCombatPower(specA, crewQuality);
    const powerB = this.calculateCombatPower(specB, crewQuality);
    
    if (!powerA || !powerB) {
      return null;
    }
    
    // 비교 수치 계산
    const totalPowerDiff = powerA.totalPower - powerB.totalPower;
    const offensiveDiff = powerA.offensivePower - powerB.offensivePower;
    const defensiveDiff = powerA.defensivePower - powerB.defensivePower;
    const mobilityDiff = powerA.mobilityPower - powerB.mobilityPower;
    
    // 장점 분석
    const advantagesA: string[] = [];
    const advantagesB: string[] = [];
    
    // 속도 비교
    if (specA.maxSpeed > specB.maxSpeed * 1.1) {
      advantagesA.push(`속도 우위 (${specA.maxSpeed} vs ${specB.maxSpeed})`);
    } else if (specB.maxSpeed > specA.maxSpeed * 1.1) {
      advantagesB.push(`속도 우위 (${specB.maxSpeed} vs ${specA.maxSpeed})`);
    }
    
    // 장갑 비교
    if (specA.frontArmor > specB.frontArmor * 1.1) {
      advantagesA.push(`전면 장갑 우위 (${specA.frontArmor} vs ${specB.frontArmor})`);
    } else if (specB.frontArmor > specA.frontArmor * 1.1) {
      advantagesB.push(`전면 장갑 우위 (${specB.frontArmor} vs ${specA.frontArmor})`);
    }
    
    // 화력 비교
    const totalFirepowerA = specA.gunPower + specA.beamPower + specA.missilePower;
    const totalFirepowerB = specB.gunPower + specB.beamPower + specB.missilePower;
    
    if (totalFirepowerA > totalFirepowerB * 1.1) {
      advantagesA.push(`화력 우위 (${totalFirepowerA} vs ${totalFirepowerB})`);
    } else if (totalFirepowerB > totalFirepowerA * 1.1) {
      advantagesB.push(`화력 우위 (${totalFirepowerB} vs ${totalFirepowerA})`);
    }
    
    // 대공 비교
    if (specA.aaPower > specB.aaPower * 1.2) {
      advantagesA.push(`대공 우위 (${specA.aaPower} vs ${specB.aaPower})`);
    } else if (specB.aaPower > specA.aaPower * 1.2) {
      advantagesB.push(`대공 우위 (${specB.aaPower} vs ${specA.aaPower})`);
    }
    
    // 탑재량 비교
    if (specA.fighterCapacity > specB.fighterCapacity) {
      advantagesA.push(`전투정 탑재량 우위 (${specA.fighterCapacity} vs ${specB.fighterCapacity})`);
    } else if (specB.fighterCapacity > specA.fighterCapacity) {
      advantagesB.push(`전투정 탑재량 우위 (${specB.fighterCapacity} vs ${specA.fighterCapacity})`);
    }
    
    // 생산 비용 비교
    if (specA.creditCost < specB.creditCost * 0.9) {
      advantagesA.push(`생산 비용 효율 (${specA.creditCost} vs ${specB.creditCost})`);
    } else if (specB.creditCost < specA.creditCost * 0.9) {
      advantagesB.push(`생산 비용 효율 (${specB.creditCost} vs ${specA.creditCost})`);
    }
    
    // 건조 시간 비교
    if (specA.buildTime < specB.buildTime * 0.8) {
      advantagesA.push(`건조 시간 우위 (${specA.buildTime}일 vs ${specB.buildTime}일)`);
    } else if (specB.buildTime < specA.buildTime * 0.8) {
      advantagesB.push(`건조 시간 우위 (${specB.buildTime}일 vs ${specA.buildTime}일)`);
    }
    
    // 추천 생성
    let recommendation: string;
    
    if (Math.abs(totalPowerDiff) < powerA.totalPower * 0.05) {
      recommendation = '두 함선은 비슷한 전투력을 가지고 있습니다. 임무에 따라 선택하세요.';
    } else if (totalPowerDiff > 0) {
      recommendation = `${specA.nameKo}가 전투력에서 ${Math.abs(totalPowerDiff)} 우세합니다.`;
      if (advantagesB.length > advantagesA.length) {
        recommendation += ` 단, ${specB.nameKo}는 특정 상황에서 유리할 수 있습니다.`;
      }
    } else {
      recommendation = `${specB.nameKo}가 전투력에서 ${Math.abs(totalPowerDiff)} 우세합니다.`;
      if (advantagesA.length > advantagesB.length) {
        recommendation += ` 단, ${specA.nameKo}는 특정 상황에서 유리할 수 있습니다.`;
      }
    }
    
    return {
      shipA: {
        id: `${specA.typeCode}_${specA.variant}`,
        name: specA.nameKo,
        spec: specA,
        combatPower: powerA,
      },
      shipB: {
        id: `${specB.typeCode}_${specB.variant}`,
        name: specB.nameKo,
        spec: specB,
        combatPower: powerB,
      },
      comparison: {
        totalPowerDiff,
        offensiveDiff,
        defensiveDiff,
        mobilityDiff,
        advantages: {
          shipA: advantagesA,
          shipB: advantagesB,
        },
        recommendation,
      },
    };
  }
  
  // ============================================================
  // 유틸리티 메서드
  // ============================================================
  
  /**
   * 함선 클래스 한글 이름 반환
   */
  getShipClassName(shipClass: ShipClass): string {
    const names: Record<ShipClass, string> = {
      [ShipClass.BATTLESHIP]: '전함',
      [ShipClass.FAST_BATTLESHIP]: '고속전함',
      [ShipClass.CRUISER]: '순양함',
      [ShipClass.STRIKE_CRUISER]: '타격순양함',
      [ShipClass.DESTROYER]: '구축함',
      [ShipClass.FIGHTER_CARRIER]: '전투정모함',
      [ShipClass.TORPEDO_CARRIER]: '뇌격정모함',
      [ShipClass.LANDING_SHIP]: '양륙함',
      [ShipClass.TRANSPORT]: '수송함',
      [ShipClass.TROOP_TRANSPORT]: '병원수송함',
      [ShipClass.REPAIR_SHIP]: '공작함',
    };
    
    return names[shipClass] || shipClass;
  }
  
  /**
   * 타입 코드 설명 반환
   */
  getTypeCodeDescription(typeCode: ShipTypeCode): string {
    const descriptions: Record<ShipTypeCode, string> = {
      // 제국 함선
      SS75: '제국 전함 계열 (SS75형)',
      PK86: '제국 고속전함 계열 (PK86형, 제국 전용)',
      SK80: '제국 순양함 계열 (SK80형)',
      Z82: '제국 구축함 계열 (Z82형)',
      K86: '제국 고속정 (K86형)',
      FR88: '제국 전투정모함 (FR88형)',
      TR88: '제국 뇌격정모함 (TR88형, 제국 전용)',
      A76: '제국 공작함 (A76형)',
      A74: '제국 수송함 (A74형)',
      A72: '제국 병원수송함 (A72형)',
      A78: '제국 양륙함 (A78형)',
      // 동맹 함선 (매뉴얼 기준 연도형)
      Y787: '동맹 전함 (787년형)',
      Y795: '동맹 순양함 (795년형)',
      Y794: '동맹 타격순양함 (794년형, 동맹 전용)',
      Y796D: '동맹 구축함 (796년형)',
      Y796C: '동맹 전투정모함 (796년형)',
      Y793: '동맹 공작함 (793년형)',
      Y792: '동맹 수송함 (792년형)',
      Y788: '동맹 병원수송함 (788년형)',
      Y786: '동맹 양륙함 (786년형)',
      // 공통
      CIVILIAN: '민간선',
      // 레거시 코드 (기존 데이터 호환용)
      LN60: '양륙함 (레거시)',
      TP90: '수송함 (레거시)',
      HT90: '병원수송함 (레거시)',
      ACH: '동맹 전함 (레거시 - 아킬레우스급)',
      AIA: '동맹 순양함 (레거시 - 아이아스급)',
      SCA: '동맹 타격순양함 (레거시)',
      PAT: '동맹 구축함 (레거시 - 파트로클로스급)',
      SPA: '스파르타니안/발큐레 전투정',
    };
    
    return descriptions[typeCode] || typeCode;
  }
  
  /**
   * 함선 스펙 요약 생성
   */
  getShipSummary(shipIdOrSpec: string | DetailedShipSpec): string | null {
    const spec = typeof shipIdOrSpec === 'string' 
      ? this.getSpec(shipIdOrSpec)
      : shipIdOrSpec;
    
    if (!spec) {
      return null;
    }
    
    const power = this.calculateCombatPower(spec);
    if (!power) {
      return null;
    }
    
    return `
${spec.nameKo} (${spec.typeCode} ${spec.variant}형)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
진영: ${spec.faction === 'EMPIRE' ? '제국' : '동맹'}
분류: ${this.getShipClassName(spec.class)}

【전투력】
총 전투력: ${power.totalPower}
공격력: ${power.offensivePower} | 방어력: ${power.defensivePower}
기동력: ${power.mobilityPower} | 지원력: ${power.supportPower}

【주요 스펙】
속도: ${spec.maxSpeed} km/G초
장갑: 전 ${spec.frontArmor} / 측 ${spec.sideArmor} / 후 ${spec.rearArmor}
화력: 빔 ${spec.beamPower} / 포 ${spec.gunPower} / 미사일 ${spec.missilePower}
대공: ${spec.aaPower}

【생산 정보】
건조 시간: ${spec.buildTime}일
비용: ${spec.creditCost.toLocaleString()} 크레딧
기술 레벨: ${spec.techLevel}

【특수 능력】
${spec.specialAbilities.join(', ') || '없음'}

${spec.lore}
`.trim();
  }
  
  /**
   * 모든 함선 클래스 목록
   */
  getAllShipClasses(): ShipClass[] {
    return Object.values(ShipClass);
  }
  
  /**
   * 모든 타입 코드 목록
   */
  getAllTypeCodes(): ShipTypeCode[] {
    return Array.from(SHIP_BY_TYPE_CODE.keys());
  }
  
  /**
   * 전투정 전투력 계산
   */
  calculateFighterPower(fighterId: string | FighterSpec): number | null {
    const spec = typeof fighterId === 'string'
      ? this.getFighterSpec(fighterId)
      : fighterId;
    
    if (!spec) {
      return null;
    }
    
    return Math.round(
      spec.attackPower * 0.4 +
      spec.defensePower * 0.2 +
      spec.speed / 10 * 0.3 +
      spec.hp / 10 * 0.1
    );
  }
}

// ============================================================
// 싱글톤 인스턴스
// ============================================================

export const shipSpecService = new ShipSpecService();

export default ShipSpecService;
