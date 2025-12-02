/**
 * SiegeEngine - 공성전 시스템
 * 
 * PHP WarUnitCity.php의 공성전 로직을 TypeScript로 변환
 * Agent D, G가 이 모듈을 사용합니다.
 * 
 * @module core/battle/SiegeEngine
 */

import { BattleUnit3D, UnitType, TerrainType, BattleState, Building } from './types';
import { DamageCalculator, DamageResult, CombatContext, BATTLE_CONSTANTS } from './DamageCalculator';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 성벽 유닛 인터페이스 (도시 방어)
 */
export interface CityDefense {
  cityId: number;
  cityName: string;
  nationId: number;
  
  // 방어 수치
  defense: number;          // 수비 (def)
  wall: number;             // 성벽 내구도
  maxWall: number;
  
  // 계산된 HP (PHP: def * 10)
  hp: number;
  maxHp: number;
  
  // 시설 효과
  facilities: CityFacility[];
  
  // 훈련/사기 (도시 레벨 기반)
  cityTrainMorale: number;  // 도시 훈련사기 (연도 기반)
  trainBonus: number;
  moraleBonus: number;
  
  // 전투 상태
  isSiege: boolean;
  conflict: Map<number, number>; // nationId -> 피해량
}

/**
 * 도시 시설
 */
export interface CityFacility {
  type: FacilityType;
  level: number;
  hp: number;
  maxHp: number;
  effect: FacilityEffect;
}

/**
 * 시설 타입
 */
export enum FacilityType {
  WALL = 'wall',           // 성벽
  GATE = 'gate',           // 성문
  TOWER = 'tower',         // 망루/화살탑
  MOAT = 'moat',           // 해자
  BARRACKS = 'barracks',   // 병영
  ARMORY = 'armory',       // 무기고
}

/**
 * 시설 효과
 */
export interface FacilityEffect {
  defenseBonus: number;
  attackBonus: number;
  rangeBonus: number;
  damageReduction: number;
}

/**
 * 공성 무기
 */
export interface SiegeWeapon {
  type: SiegeWeaponType;
  name: string;
  damage: number;
  range: number;
  accuracy: number;
  wallDamageMultiplier: number;
  facilityDamageMultiplier: number;
}

/**
 * 공성 무기 타입
 */
export enum SiegeWeaponType {
  BATTERING_RAM = 'battering_ram',     // 충차
  CATAPULT = 'catapult',               // 투석기
  SIEGE_TOWER = 'siege_tower',         // 공성탑
  TREBUCHET = 'trebuchet',             // 트레뷰셋
  FIRE_ARROW = 'fire_arrow',           // 화전
  LADDER = 'ladder',                   // 운제 (사다리)
}

/**
 * 공성전 결과
 */
export interface SiegeResult {
  attackerDamage: number;
  defenderDamage: number;
  wallDamage: number;
  facilityDamage: Map<FacilityType, number>;
  isBreach: boolean;
  isCapture: boolean;
  events: SiegeEvent[];
}

/**
 * 공성 이벤트
 */
export interface SiegeEvent {
  type: 'wall_damage' | 'wall_breach' | 'facility_damage' | 'facility_destroy' | 
        'gate_open' | 'tower_destroy' | 'siege_progress' | 'capture';
  message: string;
  value?: number;
}

/**
 * 공성전 설정
 */
export interface SiegeConfig {
  baseWallDamageMultiplier: number;
  siegeUnitBonusMultiplier: number;
  minSiegeDamage: number;
  breachThreshold: number;        // 성벽 파괴 임계값 (%)
  captureWallThreshold: number;   // 점령 가능 성벽 임계값 (%)
  facilityDestroyThreshold: number;
  wealthDamagePerKill: number;    // 살상당 경제 피해
}

// ============================================================================
// 상수 정의
// ============================================================================

export const DEFAULT_SIEGE_CONFIG: SiegeConfig = {
  baseWallDamageMultiplier: 0.8,
  siegeUnitBonusMultiplier: 2.0,
  minSiegeDamage: 10,
  breachThreshold: 0.3,           // 성벽 30% 이하면 돌파
  captureWallThreshold: 0.1,      // 성벽 10% 이하면 점령 가능
  facilityDestroyThreshold: 0.0,  // HP 0이면 파괴
  wealthDamagePerKill: 0.05,      // 킬당 5% 경제 피해
};

/**
 * 공성 무기 데이터
 */
export const SIEGE_WEAPONS: Record<SiegeWeaponType, SiegeWeapon> = {
  [SiegeWeaponType.BATTERING_RAM]: {
    type: SiegeWeaponType.BATTERING_RAM,
    name: '충차',
    damage: 100,
    range: 1,
    accuracy: 0.9,
    wallDamageMultiplier: 3.0,
    facilityDamageMultiplier: 1.5,
  },
  [SiegeWeaponType.CATAPULT]: {
    type: SiegeWeaponType.CATAPULT,
    name: '투석기',
    damage: 80,
    range: 5,
    accuracy: 0.6,
    wallDamageMultiplier: 2.0,
    facilityDamageMultiplier: 2.5,
  },
  [SiegeWeaponType.SIEGE_TOWER]: {
    type: SiegeWeaponType.SIEGE_TOWER,
    name: '공성탑',
    damage: 50,
    range: 1,
    accuracy: 0.8,
    wallDamageMultiplier: 0.5,
    facilityDamageMultiplier: 1.0,
  },
  [SiegeWeaponType.TREBUCHET]: {
    type: SiegeWeaponType.TREBUCHET,
    name: '트레뷰셋',
    damage: 120,
    range: 8,
    accuracy: 0.5,
    wallDamageMultiplier: 2.5,
    facilityDamageMultiplier: 3.0,
  },
  [SiegeWeaponType.FIRE_ARROW]: {
    type: SiegeWeaponType.FIRE_ARROW,
    name: '화전',
    damage: 40,
    range: 4,
    accuracy: 0.7,
    wallDamageMultiplier: 1.2,
    facilityDamageMultiplier: 2.0,
  },
  [SiegeWeaponType.LADDER]: {
    type: SiegeWeaponType.LADDER,
    name: '운제',
    damage: 20,
    range: 1,
    accuracy: 0.95,
    wallDamageMultiplier: 0.1,
    facilityDamageMultiplier: 0.5,
  },
};

/**
 * 도시 레벨별 보정
 */
export const CITY_LEVEL_BONUS = {
  1: { trainBonus: 5, moraleBonus: 0 },    // 관
  2: { trainBonus: 0, moraleBonus: 5 },    // 주
  3: { trainBonus: 5, moraleBonus: 0 },    // 대도시
};

// ============================================================================
// SiegeEngine 클래스
// ============================================================================

/**
 * 공성전 엔진
 * PHP WarUnitCity의 공성전 로직 구현
 */
export class SiegeEngine {
  private damageCalculator: DamageCalculator;
  private config: SiegeConfig;

  constructor(config: Partial<SiegeConfig> = {}) {
    this.damageCalculator = new DamageCalculator();
    this.config = { ...DEFAULT_SIEGE_CONFIG, ...config };
  }

  /**
   * 도시 방어 유닛 생성
   * PHP WarUnitCity 생성자 참조
   */
  createCityDefense(
    cityData: {
      cityId: number;
      name: string;
      nationId: number;
      defense: number;
      wall: number;
      level: number;
    },
    gameYear: number,
    startYear: number
  ): CityDefense {
    // 도시 훈련/사기 계산 (PHP: year - startYear + 59, clamp 60-110)
    const relativeYear = gameYear - startYear;
    const cityTrainMorale = Math.min(110, Math.max(60, relativeYear + 59));
    
    // 도시 레벨 보너스
    const levelBonus = CITY_LEVEL_BONUS[cityData.level as keyof typeof CITY_LEVEL_BONUS] 
      ?? { trainBonus: 0, moraleBonus: 0 };
    
    // HP = def × 10 (PHP 로직)
    const hp = cityData.defense * 10;
    
    return {
      cityId: cityData.cityId,
      cityName: cityData.name,
      nationId: cityData.nationId,
      defense: cityData.defense,
      wall: cityData.wall,
      maxWall: cityData.wall,
      hp,
      maxHp: hp,
      facilities: this.createDefaultFacilities(cityData.wall),
      cityTrainMorale,
      trainBonus: levelBonus.trainBonus,
      moraleBonus: levelBonus.moraleBonus,
      isSiege: false,
      conflict: new Map(),
    };
  }

  /**
   * 기본 시설 생성
   */
  private createDefaultFacilities(wallLevel: number): CityFacility[] {
    return [
      {
        type: FacilityType.WALL,
        level: Math.floor(wallLevel / 100),
        hp: wallLevel,
        maxHp: wallLevel,
        effect: {
          defenseBonus: wallLevel * 0.09,
          attackBonus: 0,
          rangeBonus: 0,
          damageReduction: wallLevel * 0.001,
        },
      },
      {
        type: FacilityType.GATE,
        level: 1,
        hp: wallLevel * 0.5,
        maxHp: wallLevel * 0.5,
        effect: {
          defenseBonus: wallLevel * 0.02,
          attackBonus: 0,
          rangeBonus: 0,
          damageReduction: 0,
        },
      },
      {
        type: FacilityType.TOWER,
        level: 1,
        hp: wallLevel * 0.3,
        maxHp: wallLevel * 0.3,
        effect: {
          defenseBonus: 0,
          attackBonus: 20,
          rangeBonus: 2,
          damageReduction: 0,
        },
      },
    ];
  }

  /**
   * 공성전 공격력 계산
   * PHP WarUnitCity::getComputedAttack 참조
   * 공격력 = (def + wall × 9) / 500 + 200
   */
  computeCityAttack(city: CityDefense): number {
    return (city.defense + city.wall * 9) / 500 + 200;
  }

  /**
   * 공성전 방어력 계산
   * PHP WarUnitCity::getComputedDefence 참조
   */
  computeCityDefense(city: CityDefense): number {
    return (city.defense + city.wall * 9) / 500 + 200;
  }

  /**
   * 도시 훈련도 계산
   */
  getCityTrain(city: CityDefense): number {
    return city.cityTrainMorale + city.trainBonus;
  }

  /**
   * 도시 사기 계산
   */
  getCityMorale(city: CityDefense): number {
    return city.cityTrainMorale + city.moraleBonus;
  }

  /**
   * 도시 숙련도 계산
   * PHP getDex 참조: (cityTrainAtmos - 60) × 7200
   */
  getCityDex(city: CityDefense): number {
    return (city.cityTrainMorale - 60) * 7200;
  }

  /**
   * 공성 데미지 계산
   */
  calculateSiegeDamage(
    attacker: BattleUnit3D,
    city: CityDefense,
    siegeWeapon?: SiegeWeaponType
  ): {
    troopDamage: number;
    wallDamage: number;
    facilityDamage: number;
  } {
    // 기본 공격력 계산
    const attackPower = this.damageCalculator.computeAttackPower(attacker);
    const cityDefense = this.computeCityDefense(city);
    
    // 기본 데미지 = 공격력 - 방어력
    let baseDamage = BATTLE_CONSTANTS.BASE_WAR_POWER + attackPower - cityDefense;
    baseDamage = Math.max(this.config.minSiegeDamage, baseDamage);
    
    // 공성 유닛 보너스
    let siegeBonus = 1.0;
    if (attacker.unitType === UnitType.SIEGE) {
      siegeBonus = this.config.siegeUnitBonusMultiplier;
    }
    
    // 공성 무기 보너스
    let weaponBonus = 1.0;
    let wallDamageMultiplier = this.config.baseWallDamageMultiplier;
    let facilityDamageMultiplier = 0.5;
    
    if (siegeWeapon) {
      const weapon = SIEGE_WEAPONS[siegeWeapon];
      weaponBonus = weapon.damage / 100;
      wallDamageMultiplier *= weapon.wallDamageMultiplier;
      facilityDamageMultiplier *= weapon.facilityDamageMultiplier;
    }
    
    // 사기/훈련도 보정
    const moraleBonus = attacker.morale / BATTLE_CONSTANTS.MAX_MORALE;
    const trainPenalty = this.getCityTrain(city) / BATTLE_CONSTANTS.MAX_TRAIN;
    
    // 최종 데미지 계산
    const troopDamage = Math.round(
      baseDamage * siegeBonus * weaponBonus * moraleBonus / trainPenalty
    );
    
    // 성벽 데미지 (PHP: wall -= damage/20)
    const wallDamage = Math.round(troopDamage * wallDamageMultiplier / 20);
    
    // 시설 데미지
    const facilityDamage = Math.round(troopDamage * facilityDamageMultiplier / 10);
    
    return {
      troopDamage,
      wallDamage,
      facilityDamage,
    };
  }

  /**
   * 도시 반격 데미지 계산
   */
  calculateCityCounterDamage(
    city: CityDefense,
    attacker: BattleUnit3D
  ): number {
    const cityAttack = this.computeCityAttack(city);
    const defenderDefense = this.damageCalculator.computeDefensePower(attacker);
    
    // 기본 데미지
    let damage = BATTLE_CONSTANTS.BASE_WAR_POWER + cityAttack - defenderDefense;
    damage = Math.max(this.config.minSiegeDamage, damage);
    
    // 사기/훈련도 보정
    const moraleBonus = this.getCityMorale(city) / BATTLE_CONSTANTS.MAX_MORALE;
    const trainBonus = this.getCityTrain(city) / BATTLE_CONSTANTS.MAX_TRAIN;
    
    return Math.round(damage * moraleBonus * trainBonus);
  }

  /**
   * 공성전 실행
   */
  executeSiege(
    attacker: BattleUnit3D,
    city: CityDefense,
    siegeWeapon?: SiegeWeaponType
  ): SiegeResult {
    const events: SiegeEvent[] = [];
    
    // 공성 상태로 전환
    if (!city.isSiege) {
      city.isSiege = true;
      events.push({
        type: 'siege_progress',
        message: `${city.cityName} 공성 시작`,
      });
    }
    
    // 공격 데미지 계산
    const {
      troopDamage,
      wallDamage,
      facilityDamage,
    } = this.calculateSiegeDamage(attacker, city, siegeWeapon);
    
    // 반격 데미지 계산
    const counterDamage = this.calculateCityCounterDamage(city, attacker);
    
    // 성벽 피해 적용
    city.hp -= troopDamage;
    const oldWall = city.wall;
    city.wall = Math.max(0, city.wall - wallDamage);
    
    events.push({
      type: 'wall_damage',
      message: `성벽 피해: ${wallDamage}`,
      value: wallDamage,
    });
    
    // 시설 피해 적용
    const facilityDamageMap = new Map<FacilityType, number>();
    for (const facility of city.facilities) {
      const dmg = Math.floor(facilityDamage * this.getFacilityDamageWeight(facility.type));
      facility.hp = Math.max(0, facility.hp - dmg);
      facilityDamageMap.set(facility.type, dmg);
      
      if (facility.hp <= 0 && dmg > 0) {
        events.push({
          type: 'facility_destroy',
          message: `${this.getFacilityName(facility.type)} 파괴!`,
        });
      } else if (dmg > 0) {
        events.push({
          type: 'facility_damage',
          message: `${this.getFacilityName(facility.type)} 피해: ${dmg}`,
          value: dmg,
        });
      }
    }
    
    // 성벽 돌파 판정
    const wallRatio = city.wall / city.maxWall;
    const isBreach = wallRatio <= this.config.breachThreshold;
    
    if (isBreach && oldWall / city.maxWall > this.config.breachThreshold) {
      events.push({
        type: 'wall_breach',
        message: `${city.cityName} 성벽 돌파!`,
      });
    }
    
    // 점령 판정
    const isCapture = city.hp <= 0 || wallRatio <= this.config.captureWallThreshold;
    
    if (isCapture) {
      events.push({
        type: 'capture',
        message: `${city.cityName} 점령!`,
      });
    }
    
    // 분쟁 기록 (PHP addConflict 참조)
    this.recordConflict(city, attacker, troopDamage);
    
    return {
      attackerDamage: counterDamage,
      defenderDamage: troopDamage,
      wallDamage,
      facilityDamage: facilityDamageMap,
      isBreach,
      isCapture,
      events,
    };
  }

  /**
   * 분쟁 기록
   * PHP addConflict 참조
   */
  private recordConflict(
    city: CityDefense,
    attacker: BattleUnit3D,
    damage: number
  ): boolean {
    const nationId = attacker.playerId; // 실제로는 국가 ID 사용
    const currentDamage = city.conflict.get(nationId) ?? 0;
    
    // 선타/막타 보너스
    let bonusDamage = damage;
    if (city.conflict.size === 0 || city.hp <= 0) {
      bonusDamage *= 1.05;
    }
    
    const isNewConflict = !city.conflict.has(nationId);
    city.conflict.set(nationId, currentDamage + bonusDamage);
    
    return isNewConflict;
  }

  /**
   * 경제 피해 계산
   * PHP finishBattle의 경제 피해 로직 참조
   */
  calculateEconomicDamage(city: CityDefense, killedCount: number): {
    agricultureDamage: number;
    commerceDamage: number;
    securityDamage: number;
  } {
    const baseDamage = killedCount * this.config.wealthDamagePerKill;
    
    return {
      agricultureDamage: baseDamage,
      commerceDamage: baseDamage,
      securityDamage: baseDamage,
    };
  }

  /**
   * 공성 함락 시 경제 피해 (PHP heavyDecreaseWealth 참조)
   */
  calculateCaptureEconomicDamage(): {
    agricultureMultiplier: number;
    commerceMultiplier: number;
    securityMultiplier: number;
  } {
    return {
      agricultureMultiplier: 0.5, // 50%로 감소
      commerceMultiplier: 0.5,
      securityMultiplier: 0.5,
    };
  }

  /**
   * 전투 지속 가능 여부
   * PHP continueWar 참조
   */
  canContinueSiege(city: CityDefense): { canContinue: boolean; reason?: string } {
    // 공성 상태가 아니면 한 번만 맞음
    if (!city.isSiege) {
      return { canContinue: false, reason: '공성 상태 아님' };
    }
    
    // HP 0 이하면 종료
    if (city.hp <= 0) {
      return { canContinue: false, reason: '성벽 붕괴' };
    }
    
    // 도시 성벽은 군량 소모로 항복하지 않음
    return { canContinue: true };
  }

  /**
   * 공성전 종료 처리
   * PHP finishBattle 참조
   */
  finishSiege(city: CityDefense): void {
    // 방어력 업데이트 (PHP: def = round(hp / 10))
    city.defense = Math.round(city.hp / 10);
    city.wall = Math.round(city.wall);
    city.isSiege = false;
  }

  /**
   * 시설 데미지 가중치
   */
  private getFacilityDamageWeight(type: FacilityType): number {
    switch (type) {
      case FacilityType.WALL: return 1.0;
      case FacilityType.GATE: return 1.5;
      case FacilityType.TOWER: return 2.0;
      case FacilityType.MOAT: return 0.3;
      case FacilityType.BARRACKS: return 1.2;
      case FacilityType.ARMORY: return 1.2;
      default: return 1.0;
    }
  }

  /**
   * 시설 이름 조회
   */
  private getFacilityName(type: FacilityType): string {
    switch (type) {
      case FacilityType.WALL: return '성벽';
      case FacilityType.GATE: return '성문';
      case FacilityType.TOWER: return '망루';
      case FacilityType.MOAT: return '해자';
      case FacilityType.BARRACKS: return '병영';
      case FacilityType.ARMORY: return '무기고';
      default: return '시설';
    }
  }

  /**
   * 공성 무기 정보 조회
   */
  getSiegeWeaponInfo(type: SiegeWeaponType): SiegeWeapon {
    return SIEGE_WEAPONS[type];
  }

  /**
   * 모든 공성 무기 목록 조회
   */
  getAllSiegeWeapons(): SiegeWeapon[] {
    return Object.values(SIEGE_WEAPONS);
  }

  /**
   * 공성전 승자 결정
   */
  determineWinner(city: CityDefense): number | null {
    if (city.conflict.size === 0) {
      return null;
    }
    
    // 가장 많은 피해를 입힌 국가가 승자
    let maxDamage = 0;
    let winner: number | null = null;
    
    city.conflict.forEach((damage, nationId) => {
      if (damage > maxDamage) {
        maxDamage = damage;
        winner = nationId;
      }
    });
    
    return winner;
  }

  /**
   * Building 객체를 CityFacility로 변환
   */
  buildingToFacility(building: Building): CityFacility {
    const typeMap: Record<string, FacilityType> = {
      wall: FacilityType.WALL,
      gate: FacilityType.GATE,
      tower: FacilityType.TOWER,
    };
    
    const facilityType = typeMap[building.type] ?? FacilityType.WALL;
    
    return {
      type: facilityType,
      level: Math.floor(building.maxHp / 100),
      hp: building.hp,
      maxHp: building.maxHp,
      effect: this.getDefaultFacilityEffect(facilityType),
    };
  }

  /**
   * 기본 시설 효과
   */
  private getDefaultFacilityEffect(type: FacilityType): FacilityEffect {
    switch (type) {
      case FacilityType.WALL:
        return { defenseBonus: 50, attackBonus: 0, rangeBonus: 0, damageReduction: 0.1 };
      case FacilityType.GATE:
        return { defenseBonus: 20, attackBonus: 0, rangeBonus: 0, damageReduction: 0 };
      case FacilityType.TOWER:
        return { defenseBonus: 0, attackBonus: 30, rangeBonus: 3, damageReduction: 0 };
      case FacilityType.MOAT:
        return { defenseBonus: 30, attackBonus: 0, rangeBonus: 0, damageReduction: 0.15 };
      case FacilityType.BARRACKS:
        return { defenseBonus: 10, attackBonus: 10, rangeBonus: 0, damageReduction: 0 };
      case FacilityType.ARMORY:
        return { defenseBonus: 5, attackBonus: 20, rangeBonus: 1, damageReduction: 0 };
      default:
        return { defenseBonus: 0, attackBonus: 0, rangeBonus: 0, damageReduction: 0 };
    }
  }
}

// 싱글톤 인스턴스 export
export const siegeEngine = new SiegeEngine();

