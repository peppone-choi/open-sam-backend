/**
 * GroundUnitTypeService - 육전대 유형 시스템
 * 
 * 기능:
 * - 육전대 분류 (INFANTRY, ARMORED, SPECIAL_FORCES, MARINES, MILITIA)
 * - 육전대 생성 (createGroundUnit)
 * - 장비 지급 (equipUnit)
 * - 지상전 전투력 계산 (calculateGroundCombatPower)
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Enums & Types
// ============================================================

/**
 * 육전대 분류
 */
export enum GroundUnitClass {
  INFANTRY = 'INFANTRY',             // 보병
  ARMORED = 'ARMORED',               // 장갑병
  SPECIAL_FORCES = 'SPECIAL_FORCES', // 특수부대
  MARINES = 'MARINES',               // 해병대 (함선 강습)
  MILITIA = 'MILITIA',               // 민병대
}

/**
 * 장비 등급
 */
export enum EquipmentGrade {
  LIGHT = 'LIGHT',                   // 경장
  STANDARD = 'STANDARD',             // 표준
  HEAVY = 'HEAVY',                   // 중장
  ELITE = 'ELITE',                   // 정예
}

/**
 * 지형 유형
 */
export enum TerrainType {
  URBAN = 'URBAN',                   // 도시
  OPEN = 'OPEN',                     // 평지
  FOREST = 'FOREST',                 // 산림
  MOUNTAIN = 'MOUNTAIN',             // 산악
  FORTRESS = 'FORTRESS',             // 요새
  SPACE_STATION = 'SPACE_STATION',   // 우주정거장
}

/**
 * 육전대 유닛 상세
 */
export interface GroundUnitDetail {
  unitId: string;
  sessionId: string;
  factionId: string;
  name: string;
  unitClass: GroundUnitClass;
  
  // 병력
  strength: number;              // 현재 병력
  maxStrength: number;           // 최대 병력
  casualties: number;            // 누적 사상자
  
  // 상태
  morale: number;                // 사기 (0-100)
  experience: number;            // 경험 (0-100)
  fatigue: number;               // 피로도 (0-100)
  readiness: number;             // 전투 준비도 (0-100)
  
  // 장비
  equipment: {
    weapons: EquipmentGrade;
    armor: EquipmentGrade;
    vehicles: number;
    specialItems: string[];
  };
  
  // 위치
  location: {
    type: 'PLANET' | 'FLEET' | 'FORTRESS';
    id: string;
    planetId?: string;
    coordinates?: { x: number; y: number };
  };
  
  // 스킬
  skills: string[];
  
  // 메타데이터
  createdAt: Date;
  lastCombatAt?: Date;
  commanderId?: string;
}

/**
 * 유형별 정의
 */
interface UnitClassDefinition {
  name: string;
  nameKo: string;
  baseStats: {
    attackPower: number;
    defensePower: number;
    mobility: number;
    siegePower: number;          // 공성력
    antiArmor: number;           // 대장갑
  };
  terrainModifiers: Partial<Record<TerrainType, number>>;
  costPerSoldier: number;
  maintenanceCost: number;
  minSize: number;
  maxSize: number;
  requiredFacility?: string;
  specialAbilities: string[];
}

// ============================================================
// 유형별 정의
// ============================================================

const UNIT_CLASS_DEFINITIONS: Record<GroundUnitClass, UnitClassDefinition> = {
  [GroundUnitClass.INFANTRY]: {
    name: 'Infantry',
    nameKo: '보병',
    baseStats: {
      attackPower: 10,
      defensePower: 8,
      mobility: 10,
      siegePower: 5,
      antiArmor: 3,
    },
    terrainModifiers: {
      [TerrainType.URBAN]: 1.2,
      [TerrainType.FOREST]: 1.1,
      [TerrainType.MOUNTAIN]: 0.9,
      [TerrainType.OPEN]: 0.8,
    },
    costPerSoldier: 50,
    maintenanceCost: 5,
    minSize: 100,
    maxSize: 5000,
    specialAbilities: ['URBAN_COMBAT', 'GARRISON'],
  },
  [GroundUnitClass.ARMORED]: {
    name: 'Armored',
    nameKo: '장갑병',
    baseStats: {
      attackPower: 25,
      defensePower: 20,
      mobility: 6,
      siegePower: 15,
      antiArmor: 20,
    },
    terrainModifiers: {
      [TerrainType.OPEN]: 1.5,
      [TerrainType.URBAN]: 0.8,
      [TerrainType.FOREST]: 0.6,
      [TerrainType.MOUNTAIN]: 0.4,
    },
    costPerSoldier: 200,
    maintenanceCost: 25,
    minSize: 50,
    maxSize: 2000,
    requiredFacility: 'armored_factory',
    specialAbilities: ['BREAKTHROUGH', 'ANTI_ARMOR', 'MOBILE_ASSAULT'],
  },
  [GroundUnitClass.SPECIAL_FORCES]: {
    name: 'Special Forces',
    nameKo: '특수부대',
    baseStats: {
      attackPower: 18,
      defensePower: 12,
      mobility: 20,
      siegePower: 10,
      antiArmor: 8,
    },
    terrainModifiers: {
      [TerrainType.URBAN]: 1.3,
      [TerrainType.FOREST]: 1.4,
      [TerrainType.MOUNTAIN]: 1.2,
      [TerrainType.FORTRESS]: 1.2,
    },
    costPerSoldier: 500,
    maintenanceCost: 50,
    minSize: 20,
    maxSize: 500,
    requiredFacility: 'special_ops_academy',
    specialAbilities: ['STEALTH', 'SABOTAGE', 'RAPID_DEPLOYMENT', 'INFILTRATION'],
  },
  [GroundUnitClass.MARINES]: {
    name: 'Marines',
    nameKo: '해병대',
    baseStats: {
      attackPower: 15,
      defensePower: 14,
      mobility: 12,
      siegePower: 8,
      antiArmor: 6,
    },
    terrainModifiers: {
      [TerrainType.SPACE_STATION]: 1.5,
      [TerrainType.FORTRESS]: 1.3,
      [TerrainType.URBAN]: 1.1,
    },
    costPerSoldier: 150,
    maintenanceCost: 15,
    minSize: 50,
    maxSize: 3000,
    requiredFacility: 'marine_barracks',
    specialAbilities: ['BOARDING_ACTION', 'ZERO_G_COMBAT', 'AMPHIBIOUS'],
  },
  [GroundUnitClass.MILITIA]: {
    name: 'Militia',
    nameKo: '민병대',
    baseStats: {
      attackPower: 5,
      defensePower: 6,
      mobility: 8,
      siegePower: 2,
      antiArmor: 1,
    },
    terrainModifiers: {
      [TerrainType.URBAN]: 1.1,
      [TerrainType.OPEN]: 0.7,
      [TerrainType.FORTRESS]: 1.2,
    },
    costPerSoldier: 20,
    maintenanceCost: 2,
    minSize: 200,
    maxSize: 10000,
    specialAbilities: ['HOME_DEFENSE', 'GUERRILLA'],
  },
};

// 장비 등급별 배율
const EQUIPMENT_GRADE_MULTIPLIERS: Record<EquipmentGrade, {
  attack: number;
  defense: number;
  cost: number;
}> = {
  [EquipmentGrade.LIGHT]: { attack: 0.8, defense: 0.8, cost: 0.5 },
  [EquipmentGrade.STANDARD]: { attack: 1.0, defense: 1.0, cost: 1.0 },
  [EquipmentGrade.HEAVY]: { attack: 1.3, defense: 1.5, cost: 2.0 },
  [EquipmentGrade.ELITE]: { attack: 1.5, defense: 1.8, cost: 3.5 },
};

// 경험치에 따른 전투력 배율
const EXPERIENCE_MULTIPLIERS: Record<string, number> = {
  novice: 0.7,      // 0-20
  trained: 0.85,    // 21-40
  regular: 1.0,     // 41-60
  veteran: 1.2,     // 61-80
  elite: 1.5,       // 81-100
};

// ============================================================
// Request/Response Types
// ============================================================

export interface CreateGroundUnitRequest {
  sessionId: string;
  factionId: string;
  planetId: string;
  name: string;
  unitClass: GroundUnitClass;
  strength: number;
  equipmentGrade?: EquipmentGrade;
  commanderId?: string;
}

export interface CreateGroundUnitResult {
  success: boolean;
  unit?: GroundUnitDetail;
  totalCost: number;
  error?: string;
}

export interface EquipUnitRequest {
  sessionId: string;
  unitId: string;
  weaponGrade: EquipmentGrade;
  armorGrade: EquipmentGrade;
  vehicles?: number;
  specialItems?: string[];
}

export interface EquipUnitResult {
  success: boolean;
  upgradeCost: number;
  newCombatPower: number;
  error?: string;
}

export interface CombatPowerCalculation {
  basePower: number;
  attackPower: number;
  defensePower: number;
  mobility: number;
  siegePower: number;
  totalPower: number;
  modifiers: {
    equipment: number;
    experience: number;
    morale: number;
    fatigue: number;
    terrain?: number;
  };
}

// ============================================================
// GroundUnitTypeService Class
// ============================================================

export class GroundUnitTypeService extends EventEmitter {
  private static instance: GroundUnitTypeService;
  
  // 육전대 유닛 저장소
  private groundUnits: Map<string, GroundUnitDetail> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[GroundUnitTypeService] Initialized');
  }

  public static getInstance(): GroundUnitTypeService {
    if (!GroundUnitTypeService.instance) {
      GroundUnitTypeService.instance = new GroundUnitTypeService();
    }
    return GroundUnitTypeService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyMaintenance(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[GroundUnitTypeService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 육전대 생성 (createGroundUnit)
  // ============================================================

  /**
   * 육전대 생성
   */
  public async createGroundUnit(request: CreateGroundUnitRequest): Promise<CreateGroundUnitResult> {
    const { sessionId, factionId, planetId, name, unitClass, strength, equipmentGrade, commanderId } = request;

    // 1. 행성 확인
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return {
        success: false,
        totalCost: 0,
        error: '행성을 찾을 수 없습니다.',
      };
    }

    if (planet.ownerId !== factionId) {
      return {
        success: false,
        totalCost: 0,
        error: '해당 행성을 소유하고 있지 않습니다.',
      };
    }

    // 2. 유형 정의 확인
    const classDef = UNIT_CLASS_DEFINITIONS[unitClass];
    
    // 3. 크기 검증
    if (strength < classDef.minSize || strength > classDef.maxSize) {
      return {
        success: false,
        totalCost: 0,
        error: `병력 수가 범위를 벗어남 (${classDef.minSize} ~ ${classDef.maxSize})`,
      };
    }

    // 4. 필요 시설 확인
    if (classDef.requiredFacility) {
      const hasFacility = planet.facilities?.some(f => 
        f.type === classDef.requiredFacility && f.isOperational
      );
      if (!hasFacility) {
        return {
          success: false,
          totalCost: 0,
          error: `필요 시설이 없습니다: ${classDef.requiredFacility}`,
        };
      }
    }

    // 5. 인구 확인
    const maxRecruit = Math.floor(planet.population * 0.005); // 인구의 0.5%
    if (strength > maxRecruit) {
      return {
        success: false,
        totalCost: 0,
        error: `징집 가능 인원 초과 (최대: ${maxRecruit})`,
      };
    }

    // 6. 비용 계산
    const grade = equipmentGrade || EquipmentGrade.STANDARD;
    const gradeMultiplier = EQUIPMENT_GRADE_MULTIPLIERS[grade].cost;
    const totalCost = Math.floor(classDef.costPerSoldier * strength * gradeMultiplier);

    // 7. 자원 확인
    if (planet.resources.credits < totalCost) {
      return {
        success: false,
        totalCost,
        error: `자금 부족 (필요: ${totalCost}, 보유: ${planet.resources.credits})`,
      };
    }

    // 8. 육전대 생성
    const unitId = `GU-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const groundUnit: GroundUnitDetail = {
      unitId,
      sessionId,
      factionId,
      name,
      unitClass,
      strength,
      maxStrength: strength,
      casualties: 0,
      morale: 70,
      experience: unitClass === GroundUnitClass.MILITIA ? 10 : 30,
      fatigue: 0,
      readiness: 100,
      equipment: {
        weapons: grade,
        armor: grade,
        vehicles: unitClass === GroundUnitClass.ARMORED ? Math.floor(strength / 5) : 0,
        specialItems: [],
      },
      location: {
        type: 'PLANET',
        id: planetId,
        planetId,
      },
      skills: [...classDef.specialAbilities],
      createdAt: new Date(),
      commanderId,
    };

    // 9. 자원 차감 및 인구 감소
    planet.resources.credits -= totalCost;
    planet.population -= strength;
    await planet.save();

    // 10. 저장
    const key = `${sessionId}-${unitId}`;
    this.groundUnits.set(key, groundUnit);

    // 행성 수비대에 추가
    if (!planet.garrisonIds) planet.garrisonIds = [];
    planet.garrisonIds.push(unitId);
    await planet.save();

    // 11. 이벤트 발생
    this.emit('groundUnit:created', {
      sessionId,
      factionId,
      planetId,
      unit: groundUnit,
      totalCost,
    });

    logger.info(`[GroundUnitTypeService] Created ${unitClass} unit "${name}" with ${strength} troops on ${planetId}`);

    return {
      success: true,
      unit: groundUnit,
      totalCost,
    };
  }

  // ============================================================
  // 장비 지급 (equipUnit)
  // ============================================================

  /**
   * 육전대 장비 업그레이드
   */
  public async equipUnit(request: EquipUnitRequest): Promise<EquipUnitResult> {
    const { sessionId, unitId, weaponGrade, armorGrade, vehicles, specialItems } = request;

    // 1. 유닛 조회
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) {
      return { success: false, upgradeCost: 0, newCombatPower: 0, error: '육전대를 찾을 수 없습니다.' };
    }

    // 2. 비용 계산
    const classDef = UNIT_CLASS_DEFINITIONS[unit.unitClass];
    
    const oldWeaponMult = EQUIPMENT_GRADE_MULTIPLIERS[unit.equipment.weapons].cost;
    const newWeaponMult = EQUIPMENT_GRADE_MULTIPLIERS[weaponGrade].cost;
    const weaponCost = Math.max(0, (newWeaponMult - oldWeaponMult) * classDef.costPerSoldier * unit.strength * 0.5);

    const oldArmorMult = EQUIPMENT_GRADE_MULTIPLIERS[unit.equipment.armor].cost;
    const newArmorMult = EQUIPMENT_GRADE_MULTIPLIERS[armorGrade].cost;
    const armorCost = Math.max(0, (newArmorMult - oldArmorMult) * classDef.costPerSoldier * unit.strength * 0.3);

    const vehicleCost = vehicles ? Math.max(0, vehicles - unit.equipment.vehicles) * 500 : 0;
    
    const totalCost = Math.floor(weaponCost + armorCost + vehicleCost);

    // 3. 장비 업데이트
    unit.equipment.weapons = weaponGrade;
    unit.equipment.armor = armorGrade;
    if (vehicles !== undefined && unit.unitClass === GroundUnitClass.ARMORED) {
      unit.equipment.vehicles = vehicles;
    }
    if (specialItems) {
      unit.equipment.specialItems = [...new Set([...unit.equipment.specialItems, ...specialItems])];
    }

    this.groundUnits.set(key, unit);

    // 4. 새 전투력 계산
    const combatPower = this.calculateGroundCombatPower(sessionId, unitId);

    // 5. 이벤트 발생
    this.emit('groundUnit:equipped', {
      sessionId,
      unitId,
      equipment: unit.equipment,
      upgradeCost: totalCost,
      newCombatPower: combatPower?.totalPower || 0,
    });

    logger.info(`[GroundUnitTypeService] Equipped unit ${unitId} with ${weaponGrade} weapons, ${armorGrade} armor`);

    return {
      success: true,
      upgradeCost: totalCost,
      newCombatPower: combatPower?.totalPower || 0,
    };
  }

  // ============================================================
  // 지상전 전투력 계산 (calculateGroundCombatPower)
  // ============================================================

  /**
   * 육전대 전투력 계산
   */
  public calculateGroundCombatPower(
    sessionId: string,
    unitId: string,
    terrain?: TerrainType,
  ): CombatPowerCalculation | null {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) return null;

    const classDef = UNIT_CLASS_DEFINITIONS[unit.unitClass];
    const weaponMult = EQUIPMENT_GRADE_MULTIPLIERS[unit.equipment.weapons];
    const armorMult = EQUIPMENT_GRADE_MULTIPLIERS[unit.equipment.armor];

    // 1. 기본 스탯
    const baseAttack = classDef.baseStats.attackPower;
    const baseDefense = classDef.baseStats.defensePower;
    const baseMobility = classDef.baseStats.mobility;
    const baseSiege = classDef.baseStats.siegePower;

    // 2. 장비 배율
    const equipmentAttackMod = weaponMult.attack;
    const equipmentDefenseMod = armorMult.defense;

    // 3. 경험 배율
    let experienceMod = 1.0;
    if (unit.experience <= 20) experienceMod = EXPERIENCE_MULTIPLIERS.novice;
    else if (unit.experience <= 40) experienceMod = EXPERIENCE_MULTIPLIERS.trained;
    else if (unit.experience <= 60) experienceMod = EXPERIENCE_MULTIPLIERS.regular;
    else if (unit.experience <= 80) experienceMod = EXPERIENCE_MULTIPLIERS.veteran;
    else experienceMod = EXPERIENCE_MULTIPLIERS.elite;

    // 4. 사기 배율
    const moraleMod = 0.5 + (unit.morale / 100) * 0.5; // 0.5 ~ 1.0

    // 5. 피로도 배율
    const fatigueMod = 1.0 - (unit.fatigue / 200); // 1.0 ~ 0.5

    // 6. 지형 배율
    let terrainMod = 1.0;
    if (terrain && classDef.terrainModifiers[terrain]) {
      terrainMod = classDef.terrainModifiers[terrain]!;
    }

    // 7. 병력 규모 배율
    const strengthRatio = unit.strength / unit.maxStrength;
    const strengthMod = 0.5 + strengthRatio * 0.5;

    // 8. 차량 보너스 (장갑병)
    const vehicleBonus = unit.unitClass === GroundUnitClass.ARMORED 
      ? (unit.equipment.vehicles / (unit.strength / 5)) * 0.2 
      : 0;

    // 9. 최종 계산
    const attackPower = baseAttack * equipmentAttackMod * experienceMod * moraleMod * fatigueMod * (1 + vehicleBonus) * strengthMod;
    const defensePower = baseDefense * equipmentDefenseMod * experienceMod * moraleMod * fatigueMod * (1 + vehicleBonus) * strengthMod;
    const mobility = baseMobility * fatigueMod * (1 - (unit.unitClass === GroundUnitClass.ARMORED ? 0.2 : 0));
    const siegePower = baseSiege * equipmentAttackMod * experienceMod * strengthMod;

    // 10. 지형 적용 후 공격력
    const terrainAdjustedAttack = attackPower * terrainMod;

    // 11. 총 전투력
    const totalPower = (terrainAdjustedAttack * 2 + defensePower + siegePower + mobility) / 5 * unit.strength / 100;

    return {
      basePower: (baseAttack + baseDefense + baseMobility + baseSiege) / 4,
      attackPower: Math.round(terrainAdjustedAttack * 10) / 10,
      defensePower: Math.round(defensePower * 10) / 10,
      mobility: Math.round(mobility * 10) / 10,
      siegePower: Math.round(siegePower * 10) / 10,
      totalPower: Math.round(totalPower),
      modifiers: {
        equipment: (equipmentAttackMod + equipmentDefenseMod) / 2,
        experience: experienceMod,
        morale: moraleMod,
        fatigue: fatigueMod,
        terrain: terrainMod,
      },
    };
  }

  /**
   * 다수 유닛의 총 전투력 계산
   */
  public calculateTotalCombatPower(
    sessionId: string,
    unitIds: string[],
    terrain?: TerrainType,
  ): { total: number; breakdown: Array<{ unitId: string; power: number }> } {
    let total = 0;
    const breakdown: Array<{ unitId: string; power: number }> = [];

    for (const unitId of unitIds) {
      const power = this.calculateGroundCombatPower(sessionId, unitId, terrain);
      if (power) {
        total += power.totalPower;
        breakdown.push({ unitId, power: power.totalPower });
      }
    }

    return { total, breakdown };
  }

  // ============================================================
  // 유지/월간 처리
  // ============================================================

  /**
   * 월간 유지비 처리
   */
  private async processMonthlyMaintenance(sessionId: string): Promise<void> {
    for (const [key, unit] of this.groundUnits) {
      if (!key.startsWith(sessionId)) continue;

      const classDef = UNIT_CLASS_DEFINITIONS[unit.unitClass];
      
      // 1. 유지비 계산
      const maintenanceCost = classDef.maintenanceCost * unit.strength;

      // 2. 사기 자연 변화
      if (unit.morale > 60) {
        unit.morale = Math.max(60, unit.morale - 2); // 서서히 60으로 수렴
      } else if (unit.morale < 60) {
        unit.morale = Math.min(60, unit.morale + 1); // 서서히 60으로 수렴
      }

      // 3. 피로도 회복
      unit.fatigue = Math.max(0, unit.fatigue - 10);

      // 4. 전투 준비도 회복
      unit.readiness = Math.min(100, unit.readiness + 5);

      // 5. 경험치 소량 증가 (주둔)
      if (unit.location.type === 'PLANET') {
        unit.experience = Math.min(100, unit.experience + 0.5);
      }

      this.groundUnits.set(key, unit);

      // 이벤트 발생
      this.emit('groundUnit:maintenance', {
        sessionId,
        unitId: unit.unitId,
        maintenanceCost,
      });
    }

    logger.debug(`[GroundUnitTypeService] Monthly maintenance processed for session ${sessionId}`);
  }

  // ============================================================
  // 유닛 상태 변경
  // ============================================================

  /**
   * 손실 적용
   */
  public applyCasualties(sessionId: string, unitId: string, casualties: number): {
    remaining: number;
    destroyed: boolean;
  } {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) return { remaining: 0, destroyed: true };

    unit.strength = Math.max(0, unit.strength - casualties);
    unit.casualties += casualties;
    unit.morale = Math.max(0, unit.morale - Math.floor(casualties / unit.maxStrength * 30));

    const destroyed = unit.strength === 0;
    
    if (destroyed) {
      this.groundUnits.delete(key);
      this.emit('groundUnit:destroyed', {
        sessionId,
        unitId,
        totalCasualties: unit.casualties,
      });
    } else {
      this.groundUnits.set(key, unit);
    }

    return { remaining: unit.strength, destroyed };
  }

  /**
   * 경험치 부여
   */
  public grantExperience(sessionId: string, unitId: string, amount: number): void {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) return;

    unit.experience = Math.min(100, unit.experience + amount);
    unit.lastCombatAt = new Date();
    this.groundUnits.set(key, unit);
  }

  /**
   * 사기 변경
   */
  public changeMorale(sessionId: string, unitId: string, change: number): void {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) return;

    unit.morale = Math.max(0, Math.min(100, unit.morale + change));
    this.groundUnits.set(key, unit);
  }

  /**
   * 함대 탑승
   */
  public async embarkonFleet(sessionId: string, unitId: string, fleetId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) return { success: false, error: '육전대를 찾을 수 없습니다.' };

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return { success: false, error: '함대를 찾을 수 없습니다.' };

    // 수송함 용량 확인
    const transportUnits = fleet.units.filter(u => u.shipClass === 'transport' || u.shipClass === 'landing');
    const totalCapacity = transportUnits.reduce((sum, u) => sum + (u.crewCount || 0) * 10, 0);
    
    if (unit.strength > totalCapacity) {
      return { success: false, error: '수송 용량이 부족합니다.' };
    }

    // 위치 업데이트
    const oldLocation = unit.location;
    unit.location = {
      type: 'FLEET',
      id: fleetId,
      planetId: unit.location.planetId,
    };
    this.groundUnits.set(key, unit);

    // 원래 행성에서 제거
    if (oldLocation.type === 'PLANET' && oldLocation.planetId) {
      const planet = await Planet.findOne({ sessionId, planetId: oldLocation.planetId });
      if (planet && planet.garrisonIds) {
        planet.garrisonIds = planet.garrisonIds.filter(id => id !== unitId);
        await planet.save();
      }
    }

    this.emit('groundUnit:embarked', { sessionId, unitId, fleetId });

    return { success: true };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 유닛 클래스 정의 조회
   */
  public getUnitClassDefinition(unitClass: GroundUnitClass): UnitClassDefinition {
    return UNIT_CLASS_DEFINITIONS[unitClass];
  }

  /**
   * 전체 유닛 클래스 목록
   */
  public getAllUnitClasses(): typeof UNIT_CLASS_DEFINITIONS {
    return UNIT_CLASS_DEFINITIONS;
  }

  /**
   * 육전대 조회
   */
  public getGroundUnit(sessionId: string, unitId: string): GroundUnitDetail | undefined {
    const key = `${sessionId}-${unitId}`;
    return this.groundUnits.get(key);
  }

  /**
   * 행성의 육전대 목록
   */
  public getUnitsOnPlanet(sessionId: string, planetId: string): GroundUnitDetail[] {
    const units: GroundUnitDetail[] = [];
    
    for (const [key, unit] of this.groundUnits) {
      if (key.startsWith(sessionId) && 
          unit.location.type === 'PLANET' && 
          unit.location.planetId === planetId) {
        units.push(unit);
      }
    }
    
    return units;
  }

  /**
   * 함대의 육전대 목록
   */
  public getUnitsOnFleet(sessionId: string, fleetId: string): GroundUnitDetail[] {
    const units: GroundUnitDetail[] = [];
    
    for (const [key, unit] of this.groundUnits) {
      if (key.startsWith(sessionId) && 
          unit.location.type === 'FLEET' && 
          unit.location.id === fleetId) {
        units.push(unit);
      }
    }
    
    return units;
  }

  /**
   * 세력의 전체 육전대 목록
   */
  public getFactionUnits(sessionId: string, factionId: string): GroundUnitDetail[] {
    const units: GroundUnitDetail[] = [];
    
    for (const [key, unit] of this.groundUnits) {
      if (key.startsWith(sessionId) && unit.factionId === factionId) {
        units.push(unit);
      }
    }
    
    return units;
  }

  /**
   * 장비 등급 정보
   */
  public getEquipmentGradeInfo(grade: EquipmentGrade): typeof EQUIPMENT_GRADE_MULTIPLIERS[EquipmentGrade] {
    return EQUIPMENT_GRADE_MULTIPLIERS[grade];
  }
}

export const groundUnitTypeService = GroundUnitTypeService.getInstance();
export default GroundUnitTypeService;







