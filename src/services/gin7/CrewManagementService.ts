/**
 * CrewManagementService - 승조원 및 육전대 관리 시스템
 * 
 * 기능:
 * - 승조원 유형 관리 (일반/정비/의료/통신)
 * - 승조원 배치 및 이동
 * - 경험치 획득 및 승급
 * - 육전대 편성 및 장비 지급
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet, IShipUnit } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Enums & Types
// ============================================================

/**
 * 승조원 유형
 */
export enum CrewType {
  GENERAL = 'GENERAL',             // 일반 승조원
  ENGINEERING = 'ENGINEERING',     // 정비 (기관/수리)
  MEDICAL = 'MEDICAL',             // 의료
  COMMUNICATIONS = 'COMMUNICATIONS', // 통신
}

/**
 * 육전대 유형
 */
export enum GroundUnitType {
  INFANTRY = 'INFANTRY',           // 보병
  ARMORED = 'ARMORED',             // 장갑병
  SPECIAL_FORCES = 'SPECIAL_FORCES', // 특수부대
}

/**
 * 승조원 등급
 */
export enum CrewRank {
  TRAINEE = 'TRAINEE',             // 훈련병
  CREWMAN = 'CREWMAN',             // 병사
  PETTY_OFFICER = 'PETTY_OFFICER', // 부사관
  WARRANT_OFFICER = 'WARRANT_OFFICER', // 준위
  OFFICER = 'OFFICER',             // 사관
}

/**
 * 승조원 상세 정보
 */
export interface CrewMember {
  crewId: string;
  type: CrewType;
  rank: CrewRank;
  experience: number;       // 0-1000
  efficiency: number;       // 0-100 (작업 효율)
  health: number;           // 0-100
  morale: number;           // 0-100
  assignedTo?: {
    fleetId?: string;
    unitId?: string;
    facilityId?: string;
  };
}

/**
 * 육전대 유닛
 */
export interface GroundUnit {
  unitId: string;
  name: string;
  type: GroundUnitType;
  strength: number;         // 현재 병력
  maxStrength: number;      // 최대 병력
  experience: number;       // 0-100
  morale: number;           // 0-100
  equipment: {
    weapons: string;        // 무기 등급 (light/medium/heavy)
    armor: string;          // 방어구 등급
    vehicles?: number;      // 장갑 차량 수 (ARMORED만)
  };
  locationId: string;       // 배치된 행성/함대
  locationType: 'PLANET' | 'FLEET';
}

// ============================================================
// 승조원 유형별 스탯
// ============================================================

const CREW_TYPE_STATS: Record<CrewType, {
  primarySkill: string;
  efficiencyBonus: Record<string, number>;
  trainingCost: number;
}> = {
  [CrewType.GENERAL]: {
    primarySkill: 'combat',
    efficiencyBonus: {
      combat: 1.0,
      repair: 0.5,
      medical: 0.3,
      communication: 0.5,
    },
    trainingCost: 100,
  },
  [CrewType.ENGINEERING]: {
    primarySkill: 'repair',
    efficiencyBonus: {
      combat: 0.5,
      repair: 1.5,
      medical: 0.3,
      communication: 0.5,
    },
    trainingCost: 150,
  },
  [CrewType.MEDICAL]: {
    primarySkill: 'medical',
    efficiencyBonus: {
      combat: 0.3,
      repair: 0.5,
      medical: 1.5,
      communication: 0.5,
    },
    trainingCost: 200,
  },
  [CrewType.COMMUNICATIONS]: {
    primarySkill: 'communication',
    efficiencyBonus: {
      combat: 0.5,
      repair: 0.5,
      medical: 0.3,
      communication: 1.5,
    },
    trainingCost: 180,
  },
};

// 등급별 경험치 요구량
const RANK_EXPERIENCE: Record<CrewRank, number> = {
  [CrewRank.TRAINEE]: 0,
  [CrewRank.CREWMAN]: 100,
  [CrewRank.PETTY_OFFICER]: 300,
  [CrewRank.WARRANT_OFFICER]: 600,
  [CrewRank.OFFICER]: 1000,
};

// 육전대 유형별 스탯
const GROUND_UNIT_STATS: Record<GroundUnitType, {
  attackPower: number;
  defensePower: number;
  mobility: number;
  costPerSoldier: number;
  maintenanceCost: number;
}> = {
  [GroundUnitType.INFANTRY]: {
    attackPower: 10,
    defensePower: 8,
    mobility: 10,
    costPerSoldier: 50,
    maintenanceCost: 5,
  },
  [GroundUnitType.ARMORED]: {
    attackPower: 25,
    defensePower: 20,
    mobility: 6,
    costPerSoldier: 200,
    maintenanceCost: 25,
  },
  [GroundUnitType.SPECIAL_FORCES]: {
    attackPower: 18,
    defensePower: 12,
    mobility: 15,
    costPerSoldier: 300,
    maintenanceCost: 30,
  },
};

// ============================================================
// Request/Response Types
// ============================================================

export interface AssignCrewRequest {
  sessionId: string;
  sourceId: string;         // 출발지 (행성ID 또는 함대ID)
  sourceType: 'PLANET' | 'FLEET';
  targetFleetId: string;
  targetUnitId?: string;
  crewType: CrewType;
  quantity: number;
}

export interface AssignCrewResult {
  success: boolean;
  assigned: number;
  crewType: CrewType;
  averageExperience: number;
  error?: string;
}

export interface TransferCrewRequest {
  sessionId: string;
  sourceFleetId: string;
  targetFleetId: string;
  sourceUnitId?: string;
  targetUnitId?: string;
  crewType: CrewType;
  quantity: number;
}

export interface TransferCrewResult {
  success: boolean;
  transferred: number;
  crewType: CrewType;
  error?: string;
}

export interface FormGroundUnitRequest {
  sessionId: string;
  factionId: string;
  planetId: string;
  name: string;
  type: GroundUnitType;
  strength: number;
  equipmentLevel?: 'light' | 'medium' | 'heavy';
}

export interface FormGroundUnitResult {
  success: boolean;
  unit?: GroundUnit;
  totalCost: number;
  error?: string;
}

export interface EquipGroundUnitRequest {
  sessionId: string;
  unitId: string;
  weaponGrade: 'light' | 'medium' | 'heavy';
  armorGrade: 'light' | 'medium' | 'heavy';
  vehicles?: number;
}

// ============================================================
// CrewManagementService Class
// ============================================================

export class CrewManagementService extends EventEmitter {
  private static instance: CrewManagementService;
  
  // 세션별 승조원 풀 (planetId/fleetId -> CrewMember[])
  private crewPools: Map<string, Map<CrewType, number>> = new Map();
  
  // 육전대 유닛 저장
  private groundUnits: Map<string, GroundUnit> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[CrewManagementService] Initialized');
  }

  public static getInstance(): CrewManagementService {
    if (!CrewManagementService.instance) {
      CrewManagementService.instance = new CrewManagementService();
    }
    return CrewManagementService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 월 시작 시 경험치 및 사기 갱신
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyUpdate(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[CrewManagementService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 승조원 배치
  // ============================================================

  /**
   * 승조원 배치
   */
  public async assignCrew(request: AssignCrewRequest): Promise<AssignCrewResult> {
    const { sessionId, sourceId, sourceType, targetFleetId, targetUnitId, crewType, quantity } = request;

    // 1. 대상 함대 확인
    const targetFleet = await Fleet.findOne({ sessionId, fleetId: targetFleetId });
    if (!targetFleet) {
      return {
        success: false,
        assigned: 0,
        crewType,
        averageExperience: 0,
        error: '대상 함대를 찾을 수 없습니다.',
      };
    }

    // 2. 출발지 승조원 풀 확인
    let availableCrew = 0;
    if (sourceType === 'PLANET') {
      const planet = await Planet.findOne({ sessionId, planetId: sourceId });
      if (!planet) {
        return {
          success: false,
          assigned: 0,
          crewType,
          averageExperience: 0,
          error: '출발 행성을 찾을 수 없습니다.',
        };
      }
      availableCrew = this.getAvailableCrewFromPlanet(planet, crewType);
    } else {
      const sourceFleet = await Fleet.findOne({ sessionId, fleetId: sourceId });
      if (!sourceFleet) {
        return {
          success: false,
          assigned: 0,
          crewType,
          averageExperience: 0,
          error: '출발 함대를 찾을 수 없습니다.',
        };
      }
      availableCrew = this.getAvailableCrewFromFleet(sourceFleet, crewType);
    }

    if (availableCrew < quantity) {
      return {
        success: false,
        assigned: 0,
        crewType,
        averageExperience: 0,
        error: `가용 승조원 부족 (필요: ${quantity}, 가용: ${availableCrew})`,
      };
    }

    // 3. 승조원 배치
    const toAssign = Math.min(quantity, availableCrew);
    
    if (targetUnitId) {
      // 특정 유닛에 배치
      const unit = targetFleet.units?.find(u => u.unitId === targetUnitId);
      if (unit) {
        const canAdd = unit.maxCrew - unit.crewCount;
        const actualAssigned = Math.min(toAssign, canAdd);
        unit.crewCount += actualAssigned;
        
        // 승조원 유형별 보너스 적용
        this.applyCrewTypeBonus(unit, crewType, actualAssigned);
      }
    } else {
      // 함대 전체에 분배
      for (const unit of targetFleet.units) {
        const shortage = unit.maxCrew - unit.crewCount;
        if (shortage > 0) {
          const addAmount = Math.min(shortage, toAssign);
          unit.crewCount += addAmount;
        }
      }
    }

    // 4. 출발지 승조원 감소
    if (sourceType === 'PLANET') {
      await this.reduceCrewFromPlanet(sessionId, sourceId, crewType, toAssign);
    } else {
      await this.reduceCrewFromFleet(sessionId, sourceId, crewType, toAssign);
    }

    await targetFleet.save();

    // 5. 이벤트 발생
    this.emit('crew:assigned', {
      sessionId,
      sourceId,
      sourceType,
      targetFleetId,
      targetUnitId,
      crewType,
      quantity: toAssign,
    });

    logger.info(`[CrewManagementService] Assigned ${toAssign} ${crewType} crew to fleet ${targetFleetId}`);

    return {
      success: true,
      assigned: toAssign,
      crewType,
      averageExperience: this.calculateAverageExperience(crewType),
    };
  }

  /**
   * 승조원 이동
   */
  public async transferCrew(request: TransferCrewRequest): Promise<TransferCrewResult> {
    const { sessionId, sourceFleetId, targetFleetId, sourceUnitId, targetUnitId, crewType, quantity } = request;

    // 1. 양측 함대 확인
    const [sourceFleet, targetFleet] = await Promise.all([
      Fleet.findOne({ sessionId, fleetId: sourceFleetId }),
      Fleet.findOne({ sessionId, fleetId: targetFleetId }),
    ]);

    if (!sourceFleet || !targetFleet) {
      return {
        success: false,
        transferred: 0,
        crewType,
        error: '함대를 찾을 수 없습니다.',
      };
    }

    // 2. 같은 위치인지 확인
    if (sourceFleet.location.systemId !== targetFleet.location.systemId) {
      return {
        success: false,
        transferred: 0,
        crewType,
        error: '같은 성계에 있어야 승조원 이동이 가능합니다.',
      };
    }

    // 3. 출발 함대 승조원 확인
    const availableCrew = this.getAvailableCrewFromFleet(sourceFleet, crewType);
    if (availableCrew < quantity) {
      return {
        success: false,
        transferred: 0,
        crewType,
        error: `가용 승조원 부족 (필요: ${quantity}, 가용: ${availableCrew})`,
      };
    }

    // 4. 이동 실행
    const toTransfer = Math.min(quantity, availableCrew);

    // 출발지에서 감소
    if (sourceUnitId) {
      const unit = sourceFleet.units?.find(u => u.unitId === sourceUnitId);
      if (unit) {
        unit.crewCount = Math.max(0, unit.crewCount - toTransfer);
      }
    } else {
      // 전체에서 균등 감소
      this.distributeCrewReduction(sourceFleet, toTransfer);
    }

    // 목적지에 추가
    if (targetUnitId) {
      const unit = targetFleet.units?.find(u => u.unitId === targetUnitId);
      if (unit) {
        unit.crewCount = Math.min(unit.maxCrew, unit.crewCount + toTransfer);
      }
    } else {
      // 부족한 곳에 우선 배치
      this.distributeCrewAddition(targetFleet, toTransfer);
    }

    await Promise.all([sourceFleet.save(), targetFleet.save()]);

    // 5. 이벤트 발생
    this.emit('crew:transferred', {
      sessionId,
      sourceFleetId,
      targetFleetId,
      crewType,
      quantity: toTransfer,
    });

    logger.info(`[CrewManagementService] Transferred ${toTransfer} ${crewType} crew from ${sourceFleetId} to ${targetFleetId}`);

    return {
      success: true,
      transferred: toTransfer,
      crewType,
    };
  }

  // ============================================================
  // 경험치 및 승급
  // ============================================================

  /**
   * 경험치 획득
   */
  public async grantExperience(
    sessionId: string,
    fleetId: string,
    experienceGained: number,
    reason: string,
  ): Promise<{ promotions: number }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return { promotions: 0 };

    let promotions = 0;

    for (const unit of fleet.units) {
      // 베테랑시 증가
      const currentVeterancy = unit.veterancy || 0;
      const newVeterancy = Math.min(100, currentVeterancy + experienceGained * 0.1);
      unit.veterancy = newVeterancy;

      // 승급 체크 (10 베테랑시마다 승급 확률 증가)
      if (newVeterancy >= 30 && currentVeterancy < 30) promotions++;
      if (newVeterancy >= 60 && currentVeterancy < 60) promotions++;
      if (newVeterancy >= 90 && currentVeterancy < 90) promotions++;
    }

    await fleet.save();

    if (promotions > 0) {
      this.emit('crew:promoted', {
        sessionId,
        fleetId,
        promotions,
        reason,
      });
    }

    logger.info(`[CrewManagementService] Fleet ${fleetId} gained ${experienceGained} exp, ${promotions} promotions`);

    return { promotions };
  }

  /**
   * 전투 경험 적용
   */
  public async applyCombatExperience(
    sessionId: string,
    fleetId: string,
    combatResult: {
      victory: boolean;
      enemiesDestroyed: number;
      damageDealt: number;
      damageTaken: number;
    },
  ): Promise<void> {
    const baseExp = combatResult.victory ? 20 : 10;
    const killBonus = combatResult.enemiesDestroyed * 2;
    const damageBonus = Math.floor(combatResult.damageDealt / 1000);
    
    const totalExp = baseExp + killBonus + damageBonus;
    
    await this.grantExperience(sessionId, fleetId, totalExp, 'combat');
  }

  // ============================================================
  // 육전대 관리
  // ============================================================

  /**
   * 육전대 편성
   */
  public async formGroundUnit(request: FormGroundUnitRequest): Promise<FormGroundUnitResult> {
    const { sessionId, factionId, planetId, name, type, strength, equipmentLevel = 'light' } = request;

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

    // 2. 인구 확인 (징집 가능 인원)
    const maxRecruit = Math.floor(planet.population * 0.001); // 인구의 0.1%
    if (strength > maxRecruit) {
      return {
        success: false,
        totalCost: 0,
        error: `징집 가능 인원 초과 (최대: ${maxRecruit})`,
      };
    }

    // 3. 비용 계산
    const stats = GROUND_UNIT_STATS[type];
    const baseCost = stats.costPerSoldier * strength;
    const equipmentMultiplier = equipmentLevel === 'heavy' ? 2.0 : equipmentLevel === 'medium' ? 1.5 : 1.0;
    const totalCost = Math.floor(baseCost * equipmentMultiplier);

    // 4. 자원 확인
    if (planet.resources.credits < totalCost) {
      return {
        success: false,
        totalCost,
        error: `자금 부족 (필요: ${totalCost}, 보유: ${planet.resources.credits})`,
      };
    }

    // 5. 육전대 생성
    const unitId = `GU-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const groundUnit: GroundUnit = {
      unitId,
      name,
      type,
      strength,
      maxStrength: strength,
      experience: 0,
      morale: 70,
      equipment: {
        weapons: equipmentLevel,
        armor: equipmentLevel,
        vehicles: type === GroundUnitType.ARMORED ? Math.floor(strength / 10) : undefined,
      },
      locationId: planetId,
      locationType: 'PLANET',
    };

    // 6. 자원 차감 및 인구 감소
    planet.resources.credits -= totalCost;
    planet.population -= strength;
    await planet.save();

    // 7. 저장
    const key = `${sessionId}-${unitId}`;
    this.groundUnits.set(key, groundUnit);

    // 행성 수비대에 추가
    if (!planet.garrisonIds) planet.garrisonIds = [];
    planet.garrisonIds.push(unitId);
    await planet.save();

    // 8. 이벤트 발생
    this.emit('groundUnit:formed', {
      sessionId,
      factionId,
      planetId,
      unit: groundUnit,
      totalCost,
    });

    logger.info(`[CrewManagementService] Formed ground unit ${name} (${type}) on ${planetId}`);

    return {
      success: true,
      unit: groundUnit,
      totalCost,
    };
  }

  /**
   * 육전대 장비 지급
   */
  public async equipGroundUnit(request: EquipGroundUnitRequest): Promise<{
    success: boolean;
    cost: number;
    error?: string;
  }> {
    const { sessionId, unitId, weaponGrade, armorGrade, vehicles } = request;

    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) {
      return { success: false, cost: 0, error: '육전대를 찾을 수 없습니다.' };
    }

    // 장비 업그레이드 비용 계산
    const gradeMultiplier: Record<string, number> = { light: 1, medium: 1.5, heavy: 2.0 };
    const weaponCost = unit.strength * 30 * gradeMultiplier[weaponGrade];
    const armorCost = unit.strength * 20 * gradeMultiplier[armorGrade];
    const vehicleCost = vehicles ? vehicles * 500 : 0;
    
    const totalCost = Math.floor(weaponCost + armorCost + vehicleCost);

    // 장비 업데이트
    unit.equipment.weapons = weaponGrade;
    unit.equipment.armor = armorGrade;
    if (vehicles !== undefined && unit.type === GroundUnitType.ARMORED) {
      unit.equipment.vehicles = vehicles;
    }

    this.groundUnits.set(key, unit);

    this.emit('groundUnit:equipped', {
      sessionId,
      unitId,
      equipment: unit.equipment,
      cost: totalCost,
    });

    logger.info(`[CrewManagementService] Equipped ground unit ${unitId} with ${weaponGrade} weapons`);

    return {
      success: true,
      cost: totalCost,
    };
  }

  /**
   * 육전대 함대 탑승
   */
  public async embarkonFleet(
    sessionId: string,
    unitId: string,
    fleetId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const key = `${sessionId}-${unitId}`;
    const unit = this.groundUnits.get(key);
    
    if (!unit) {
      return { success: false, error: '육전대를 찾을 수 없습니다.' };
    }

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, error: '함대를 찾을 수 없습니다.' };
    }

    // 수송함 확인
    const transportUnits = fleet.units.filter(u => u.shipClass === 'transport');
    const totalCapacity = transportUnits.reduce((sum, u) => sum + (u.crewCount || 0) * 10, 0);
    
    if (unit.strength > totalCapacity) {
      return { success: false, error: '수송 용량이 부족합니다.' };
    }

    // 이동
    unit.locationId = fleetId;
    unit.locationType = 'FLEET';
    this.groundUnits.set(key, unit);

    // 원래 행성에서 제거
    const planet = await Planet.findOne({ sessionId, planetId: unit.locationId });
    if (planet && planet.garrisonIds) {
      planet.garrisonIds = planet.garrisonIds.filter(id => id !== unitId);
      await planet.save();
    }

    this.emit('groundUnit:embarked', {
      sessionId,
      unitId,
      fleetId,
    });

    logger.info(`[CrewManagementService] Ground unit ${unitId} embarked on fleet ${fleetId}`);

    return { success: true };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private getAvailableCrewFromPlanet(planet: IPlanet, crewType: CrewType): number {
    // 행성 인구 기반 가용 승조원
    const baseAvailable = Math.floor(planet.population * 0.001);
    const key = `${planet.sessionId}-${planet.planetId}`;
    
    const pool = this.crewPools.get(key);
    if (pool && pool.has(crewType)) {
      return pool.get(crewType) || baseAvailable;
    }
    
    return baseAvailable;
  }

  private getAvailableCrewFromFleet(fleet: IFleet, _crewType: CrewType): number {
    // 함대 내 여유 승조원
    return fleet.units.reduce((sum, unit) => {
      const excess = unit.crewCount - Math.floor(unit.maxCrew * 0.8); // 80% 이상이면 여유분
      return sum + Math.max(0, excess);
    }, 0);
  }

  private async reduceCrewFromPlanet(
    sessionId: string,
    planetId: string,
    crewType: CrewType,
    amount: number,
  ): Promise<void> {
    const key = `${sessionId}-${planetId}`;
    const pool = this.crewPools.get(key) || new Map<CrewType, number>();
    const current = pool.get(crewType) || 0;
    pool.set(crewType, Math.max(0, current - amount));
    this.crewPools.set(key, pool);
  }

  private async reduceCrewFromFleet(
    sessionId: string,
    fleetId: string,
    _crewType: CrewType,
    amount: number,
  ): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return;

    let remaining = amount;
    for (const unit of fleet.units) {
      if (remaining <= 0) break;
      const excess = unit.crewCount - Math.floor(unit.maxCrew * 0.8);
      if (excess > 0) {
        const reduce = Math.min(excess, remaining);
        unit.crewCount -= reduce;
        remaining -= reduce;
      }
    }

    await fleet.save();
  }

  private applyCrewTypeBonus(unit: IShipUnit, crewType: CrewType, _count: number): void {
    const stats = CREW_TYPE_STATS[crewType];
    
    // 유닛에 승조원 유형 보너스 적용 (data 필드에 저장)
    if (!unit) return;
    
    // 정비병: 수리 효율 증가
    if (crewType === CrewType.ENGINEERING) {
      unit.hp = Math.min(100, unit.hp + 1);
    }
    // 의료병: 사기 회복
    if (crewType === CrewType.MEDICAL) {
      unit.morale = Math.min(100, unit.morale + 2);
    }
  }

  private distributeCrewReduction(fleet: IFleet, amount: number): void {
    let remaining = amount;
    const units = [...fleet.units].sort((a, b) => b.crewCount - a.crewCount);
    
    for (const unit of units) {
      if (remaining <= 0) break;
      const canReduce = Math.floor(unit.crewCount * 0.2); // 최대 20% 감소
      const reduce = Math.min(canReduce, remaining);
      unit.crewCount -= reduce;
      remaining -= reduce;
    }
  }

  private distributeCrewAddition(fleet: IFleet, amount: number): void {
    let remaining = amount;
    const units = [...fleet.units].sort((a, b) => 
      (a.crewCount / a.maxCrew) - (b.crewCount / b.maxCrew)
    );
    
    for (const unit of units) {
      if (remaining <= 0) break;
      const canAdd = unit.maxCrew - unit.crewCount;
      const add = Math.min(canAdd, remaining);
      unit.crewCount += add;
      remaining -= add;
    }
  }

  private calculateAverageExperience(_crewType: CrewType): number {
    // 기본 경험치 (실제로는 개별 승조원 추적 필요)
    return 50;
  }

  private async processMonthlyUpdate(sessionId: string): Promise<void> {
    // 육전대 유지비 및 사기 갱신
    for (const [key, unit] of this.groundUnits) {
      if (!key.startsWith(sessionId)) continue;
      
      // 사기 자연 감소
      unit.morale = Math.max(0, unit.morale - 2);
      
      // 경험치 소량 증가 (주둔 보너스)
      unit.experience = Math.min(100, unit.experience + 0.5);
      
      this.groundUnits.set(key, unit);
    }

    logger.info(`[CrewManagementService] Monthly update completed for session ${sessionId}`);
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 함대 승조원 현황 조회
   */
  public async getFleetCrewStatus(sessionId: string, fleetId: string): Promise<{
    totalCrew: number;
    maxCrew: number;
    fillRate: number;
    byUnit: Array<{
      unitId: string;
      shipClass: string;
      current: number;
      max: number;
      veterancy: number;
    }>;
  } | null> {
    const fleet = await Fleet.findOne({ sessionId, fleetId }).lean();
    if (!fleet) return null;

    const byUnit = fleet.units.map(unit => ({
      unitId: unit.unitId,
      shipClass: unit.shipClass,
      current: unit.crewCount,
      max: unit.maxCrew,
      veterancy: unit.veterancy,
    }));

    const totalCrew = byUnit.reduce((sum, u) => sum + u.current, 0);
    const maxCrew = byUnit.reduce((sum, u) => sum + u.max, 0);

    return {
      totalCrew,
      maxCrew,
      fillRate: maxCrew > 0 ? totalCrew / maxCrew : 0,
      byUnit,
    };
  }

  /**
   * 행성 육전대 조회
   */
  public getGroundUnitsOnPlanet(sessionId: string, planetId: string): GroundUnit[] {
    const units: GroundUnit[] = [];
    
    for (const [key, unit] of this.groundUnits) {
      if (key.startsWith(sessionId) && unit.locationId === planetId && unit.locationType === 'PLANET') {
        units.push(unit);
      }
    }
    
    return units;
  }

  /**
   * 함대 육전대 조회
   */
  public getGroundUnitsOnFleet(sessionId: string, fleetId: string): GroundUnit[] {
    const units: GroundUnit[] = [];
    
    for (const [key, unit] of this.groundUnits) {
      if (key.startsWith(sessionId) && unit.locationId === fleetId && unit.locationType === 'FLEET') {
        units.push(unit);
      }
    }
    
    return units;
  }

  /**
   * 육전대 상세 조회
   */
  public getGroundUnit(sessionId: string, unitId: string): GroundUnit | undefined {
    const key = `${sessionId}-${unitId}`;
    return this.groundUnits.get(key);
  }

  /**
   * 승조원 유형 스탯 조회
   */
  public getCrewTypeStats(crewType: CrewType): typeof CREW_TYPE_STATS[CrewType] {
    return CREW_TYPE_STATS[crewType];
  }

  /**
   * 육전대 유형 스탯 조회
   */
  public getGroundUnitStats(unitType: GroundUnitType): typeof GROUND_UNIT_STATS[GroundUnitType] {
    return GROUND_UNIT_STATS[unitType];
  }
}

export const crewManagementService = CrewManagementService.getInstance();
export default CrewManagementService;





