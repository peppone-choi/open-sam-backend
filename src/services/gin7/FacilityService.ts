import { Planet, IPlanet, IPlanetFacility, FacilityType } from '../../models/gin7/Planet';
import { Warehouse, ResourceType } from '../../models/gin7/Warehouse';
import { WarehouseService } from './WarehouseService';
import { 
  ConstructionQueue, 
  IConstructionQueue,
  ExtendedFacilityType,
  ConstructionType,
  FACILITY_DEFINITIONS,
  calculateFacilityCost,
  calculateFacilityMaxHp,
  getFacilityEffect,
  IFacilityCost,
  createFortressCannonState,
  IFortressCannonState
} from '../../models/gin7/Facility';
import { TimeEngine, GIN7_EVENTS, DayStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

/**
 * 행성 크기별 시설 슬롯 제한
 */
const FACILITY_SLOTS_BY_SIZE: Record<string, number> = {
  small: 5,
  medium: 10,
  large: 15,
  huge: 20
};

/**
 * 시설 건설 결과
 */
export interface BuildResult {
  success: boolean;
  queueId?: string;
  error?: string;
  estimatedCompletion?: Date;
}

/**
 * 시설 수리 비용 계산 (파손 정도에 비례)
 */
function calculateRepairCost(facility: IPlanetFacility): IFacilityCost {
  const def = FACILITY_DEFINITIONS[facility.type as ExtendedFacilityType];
  if (!def) {
    return { credits: 100, minerals: 50, energy: 25, turns: 1 };
  }
  
  const damagePercent = 1 - (facility.hp / facility.maxHp);
  const baseCost = calculateFacilityCost(facility.type as ExtendedFacilityType, facility.level);
  
  return {
    credits: Math.floor(baseCost.credits * 0.3 * damagePercent),
    minerals: Math.floor(baseCost.minerals * 0.3 * damagePercent),
    energy: Math.floor(baseCost.energy * 0.3 * damagePercent),
    shipParts: baseCost.shipParts ? Math.floor(baseCost.shipParts * 0.3 * damagePercent) : undefined,
    rareMetals: baseCost.rareMetals ? Math.floor(baseCost.rareMetals * 0.3 * damagePercent) : undefined,
    turns: Math.ceil(baseCost.turns * 0.2 * damagePercent) || 1
  };
}

export class FacilityService {
  private static initialized = false;

  /**
   * TimeEngine 이벤트 구독 초기화
   */
  static initialize() {
    if (this.initialized) return;
    
    const timeEngine = TimeEngine.getInstance();
    
    // DAY_START 이벤트 구독 - 건설 진행 처리
    timeEngine.on(GIN7_EVENTS.DAY_START, async (payload: DayStartPayload) => {
      try {
        await this.processConstructionQueue(payload.sessionId);
        await this.processAutoRepair(payload.sessionId);
        await this.processFortressCannonCharge(payload.sessionId);
      } catch (error) {
        logger.error(`[FacilityService] Error processing DAY_START for session ${payload.sessionId}:`, error);
      }
    });
    
    this.initialized = true;
    logger.info('[FacilityService] Initialized and subscribed to TimeEngine events');
  }

  /**
   * 행성의 시설 목록 조회
   */
  static async getPlanetFacilities(sessionId: string, planetId: string): Promise<IPlanetFacility[]> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return [];
    return planet.facilities;
  }

  /**
   * 시설 건설 가능 여부 확인
   */
  static async canBuildFacility(
    sessionId: string,
    planetId: string,
    facilityType: ExtendedFacilityType
  ): Promise<{ canBuild: boolean; reason?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { canBuild: false, reason: 'Planet not found' };
    }
    
    const def = FACILITY_DEFINITIONS[facilityType];
    if (!def) {
      return { canBuild: false, reason: 'Invalid facility type' };
    }
    
    // 요새 전용 시설 체크
    if (def.isFortressOnly && !planet.data?.isFortress) {
      return { canBuild: false, reason: 'This facility can only be built on fortress planets' };
    }
    
    // 고유 시설 체크
    if (def.isUnique) {
      const existing = planet.facilities.find(f => f.type === facilityType);
      if (existing) {
        return { canBuild: false, reason: 'This unique facility already exists on this planet' };
      }
    }
    
    // 시설 슬롯 체크
    const maxSlots = FACILITY_SLOTS_BY_SIZE[planet.size] || planet.maxFacilitySlots;
    if (planet.facilities.length >= maxSlots) {
      return { canBuild: false, reason: 'No available facility slots' };
    }
    
    // 선행 조건 체크
    if (def.prerequisite) {
      if (def.prerequisite.facilityType) {
        const prereq = planet.facilities.find(
          f => f.type === def.prerequisite!.facilityType && 
               f.level >= (def.prerequisite!.facilityLevel || 1)
        );
        if (!prereq) {
          return { 
            canBuild: false, 
            reason: `Requires ${def.prerequisite.facilityType} level ${def.prerequisite.facilityLevel || 1}` 
          };
        }
      }
    }
    
    // 건설 중인 동일 시설 체크
    const existingQueue = await ConstructionQueue.findOne({
      sessionId,
      planetId,
      facilityType,
      constructionType: 'BUILD',
      status: { $in: ['QUEUED', 'IN_PROGRESS'] }
    });
    
    if (existingQueue) {
      return { canBuild: false, reason: 'This facility is already under construction' };
    }
    
    return { canBuild: true };
  }

  /**
   * 시설 건설 시작
   */
  static async buildFacility(
    sessionId: string,
    planetId: string,
    facilityType: ExtendedFacilityType,
    executedBy: string,
    priority: number = 0
  ): Promise<BuildResult> {
    // 건설 가능 여부 확인
    const canBuild = await this.canBuildFacility(sessionId, planetId, facilityType);
    if (!canBuild.canBuild) {
      return { success: false, error: canBuild.reason };
    }
    
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    // 비용 계산
    const cost = calculateFacilityCost(facilityType, 1);
    
    // 창고 확인 및 자원 예약
    const warehouse = await Warehouse.findOne({ 
      sessionId, 
      ownerId: planetId, 
      ownerType: 'PLANET' 
    });
    
    if (!warehouse) {
      return { success: false, error: 'Planet warehouse not found' };
    }
    
    // 자원 확인
    const resourceItems: Array<{ type: ResourceType; amount: number }> = [
      { type: 'credits', amount: cost.credits },
      { type: 'minerals', amount: cost.minerals },
      { type: 'energy', amount: cost.energy }
    ];
    
    if (cost.shipParts) {
      resourceItems.push({ type: 'shipParts', amount: cost.shipParts });
    }
    if (cost.rareMetals) {
      resourceItems.push({ type: 'rareMetals', amount: cost.rareMetals });
    }
    
    for (const item of resourceItems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = (warehouse as any).getAvailable?.(item.type) ?? 
        (warehouse.items.find(i => i.type === item.type)?.amount || 0);
      if (available < item.amount) {
        return { 
          success: false, 
          error: `Insufficient ${item.type}: need ${item.amount}, have ${available}` 
        };
      }
    }
    
    // 자원 예약
    const reserved = await WarehouseService.reserve(sessionId, warehouse.warehouseId, resourceItems);
    if (!reserved) {
      return { success: false, error: 'Failed to reserve resources' };
    }
    
    // 건설 대기열에 추가
    const queueId = `CONST-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    
    const constructionItem = new ConstructionQueue({
      queueId,
      sessionId,
      planetId,
      ownerId: planet.ownerId || 'NEUTRAL',
      constructionType: 'BUILD' as ConstructionType,
      facilityType,
      targetLevel: 1,
      startTime: now,
      endTime: new Date(now.getTime() + cost.turns * 24 * 60 * 60 * 1000), // 대략적인 예상 시간
      turnsRequired: cost.turns,
      turnsRemaining: cost.turns,
      cost: {
        credits: cost.credits,
        minerals: cost.minerals,
        energy: cost.energy,
        shipParts: cost.shipParts,
        rareMetals: cost.rareMetals
      },
      warehouseId: warehouse.warehouseId,
      priority,
      executedBy,
      status: 'IN_PROGRESS'
    });
    
    await constructionItem.save();
    
    logger.info(`[FacilityService] Started construction: ${facilityType} on ${planetId} (${cost.turns} turns)`);
    
    return { 
      success: true, 
      queueId,
      estimatedCompletion: constructionItem.endTime
    };
  }

  /**
   * 시설 업그레이드
   */
  static async upgradeFacility(
    sessionId: string,
    planetId: string,
    facilityId: string,
    executedBy: string,
    priority: number = 0
  ): Promise<BuildResult> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    const facility = planet.facilities.find(f => f.facilityId === facilityId);
    if (!facility) {
      return { success: false, error: 'Facility not found' };
    }
    
    // 상태 확인
    if (!facility.isOperational) {
      return { success: false, error: 'Facility is not operational. Repair it first.' };
    }
    
    // 최대 레벨 확인
    const def = FACILITY_DEFINITIONS[facility.type as ExtendedFacilityType];
    if (!def) {
      return { success: false, error: 'Invalid facility type' };
    }
    
    if (facility.level >= def.maxLevel) {
      return { success: false, error: 'Facility is already at maximum level' };
    }
    
    // 업그레이드 중인지 확인
    const existingUpgrade = await ConstructionQueue.findOne({
      sessionId,
      planetId,
      facilityId,
      constructionType: 'UPGRADE',
      status: { $in: ['QUEUED', 'IN_PROGRESS'] }
    });
    
    if (existingUpgrade) {
      return { success: false, error: 'Facility is already being upgraded' };
    }
    
    // 비용 계산 (다음 레벨)
    const targetLevel = facility.level + 1;
    const cost = calculateFacilityCost(facility.type as ExtendedFacilityType, targetLevel);
    
    // 창고 확인 및 자원 예약
    const warehouse = await Warehouse.findOne({ 
      sessionId, 
      ownerId: planetId, 
      ownerType: 'PLANET' 
    });
    
    if (!warehouse) {
      return { success: false, error: 'Planet warehouse not found' };
    }
    
    // 자원 확인
    const resourceItems: Array<{ type: ResourceType; amount: number }> = [
      { type: 'credits', amount: cost.credits },
      { type: 'minerals', amount: cost.minerals },
      { type: 'energy', amount: cost.energy }
    ];
    
    if (cost.shipParts) {
      resourceItems.push({ type: 'shipParts', amount: cost.shipParts });
    }
    if (cost.rareMetals) {
      resourceItems.push({ type: 'rareMetals', amount: cost.rareMetals });
    }
    
    for (const item of resourceItems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = (warehouse as any).getAvailable?.(item.type) ?? 
        (warehouse.items.find(i => i.type === item.type)?.amount || 0);
      if (available < item.amount) {
        return { 
          success: false, 
          error: `Insufficient ${item.type}: need ${item.amount}, have ${available}` 
        };
      }
    }
    
    // 자원 예약
    const reserved = await WarehouseService.reserve(sessionId, warehouse.warehouseId, resourceItems);
    if (!reserved) {
      return { success: false, error: 'Failed to reserve resources' };
    }
    
    // 건설 대기열에 추가
    const queueId = `UPGR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    
    const upgradeItem = new ConstructionQueue({
      queueId,
      sessionId,
      planetId,
      ownerId: planet.ownerId || 'NEUTRAL',
      constructionType: 'UPGRADE' as ConstructionType,
      facilityType: facility.type as ExtendedFacilityType,
      targetLevel,
      startTime: now,
      endTime: new Date(now.getTime() + cost.turns * 24 * 60 * 60 * 1000),
      turnsRequired: cost.turns,
      turnsRemaining: cost.turns,
      cost: {
        credits: cost.credits,
        minerals: cost.minerals,
        energy: cost.energy,
        shipParts: cost.shipParts,
        rareMetals: cost.rareMetals
      },
      warehouseId: warehouse.warehouseId,
      priority,
      executedBy,
      facilityId,
      status: 'IN_PROGRESS'
    });
    
    await upgradeItem.save();
    
    logger.info(`[FacilityService] Started upgrade: ${facility.type} to level ${targetLevel} on ${planetId}`);
    
    return { 
      success: true, 
      queueId,
      estimatedCompletion: upgradeItem.endTime
    };
  }

  /**
   * 시설 수리
   */
  static async repairFacility(
    sessionId: string,
    planetId: string,
    facilityId: string,
    executedBy: string,
    priority: number = 0
  ): Promise<BuildResult> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    const facility = planet.facilities.find(f => f.facilityId === facilityId);
    if (!facility) {
      return { success: false, error: 'Facility not found' };
    }
    
    // 수리 필요 여부 확인
    if (facility.hp >= facility.maxHp) {
      return { success: false, error: 'Facility does not need repair' };
    }
    
    // 이미 수리 중인지 확인
    const existingRepair = await ConstructionQueue.findOne({
      sessionId,
      planetId,
      facilityId,
      constructionType: 'REPAIR',
      status: { $in: ['QUEUED', 'IN_PROGRESS'] }
    });
    
    if (existingRepair) {
      return { success: false, error: 'Facility is already being repaired' };
    }
    
    // 수리 비용 계산
    const cost = calculateRepairCost(facility);
    
    // 창고 확인 및 자원 예약
    const warehouse = await Warehouse.findOne({ 
      sessionId, 
      ownerId: planetId, 
      ownerType: 'PLANET' 
    });
    
    if (!warehouse) {
      return { success: false, error: 'Planet warehouse not found' };
    }
    
    // 자원 확인
    const resourceItems: Array<{ type: ResourceType; amount: number }> = [
      { type: 'credits', amount: cost.credits },
      { type: 'minerals', amount: cost.minerals },
      { type: 'energy', amount: cost.energy }
    ];
    
    for (const item of resourceItems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = (warehouse as any).getAvailable?.(item.type) ?? 
        (warehouse.items.find(i => i.type === item.type)?.amount || 0);
      if (available < item.amount) {
        return { 
          success: false, 
          error: `Insufficient ${item.type}: need ${item.amount}, have ${available}` 
        };
      }
    }
    
    // 자원 예약
    const reserved = await WarehouseService.reserve(sessionId, warehouse.warehouseId, resourceItems);
    if (!reserved) {
      return { success: false, error: 'Failed to reserve resources' };
    }
    
    // 수리 대기열에 추가
    const queueId = `REPR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    
    const repairItem = new ConstructionQueue({
      queueId,
      sessionId,
      planetId,
      ownerId: planet.ownerId || 'NEUTRAL',
      constructionType: 'REPAIR' as ConstructionType,
      facilityType: facility.type as ExtendedFacilityType,
      targetLevel: facility.level,
      startTime: now,
      endTime: new Date(now.getTime() + cost.turns * 24 * 60 * 60 * 1000),
      turnsRequired: cost.turns,
      turnsRemaining: cost.turns,
      cost: {
        credits: cost.credits,
        minerals: cost.minerals,
        energy: cost.energy
      },
      warehouseId: warehouse.warehouseId,
      priority,
      executedBy,
      facilityId,
      status: 'IN_PROGRESS'
    });
    
    await repairItem.save();
    
    logger.info(`[FacilityService] Started repair: ${facility.type} on ${planetId} (${cost.turns} turns)`);
    
    return { 
      success: true, 
      queueId,
      estimatedCompletion: repairItem.endTime
    };
  }

  /**
   * 건설 대기열 처리 (DAY_START 이벤트)
   */
  static async processConstructionQueue(sessionId: string): Promise<void> {
    const activeItems = await ConstructionQueue.find({
      sessionId,
      status: 'IN_PROGRESS'
    }).sort({ priority: -1 });
    
    for (const item of activeItems) {
      item.turnsRemaining--;
      
      if (item.turnsRemaining <= 0) {
        // 건설 완료!
        await this.completeConstruction(item);
      } else {
        await item.save();
      }
    }
  }

  /**
   * 건설 완료 처리
   */
  private static async completeConstruction(item: IConstructionQueue): Promise<void> {
    const planet = await Planet.findOne({ 
      sessionId: item.sessionId, 
      planetId: item.planetId 
    });
    
    if (!planet) {
      logger.error(`[FacilityService] Planet not found for construction completion: ${item.planetId}`);
      item.status = 'CANCELLED';
      await item.save();
      return;
    }
    
    try {
      switch (item.constructionType) {
        case 'BUILD': {
          // 새 시설 생성
          const facilityId = `FAC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const maxHp = calculateFacilityMaxHp(item.facilityType, 1);
          
          const newFacility: IPlanetFacility = {
            facilityId,
            type: item.facilityType as FacilityType,
            level: 1,
            hp: maxHp,
            maxHp,
            isOperational: true,
            productionBonus: 0
          };
          
          planet.facilities.push(newFacility);
          
          // 요새포인 경우 상태 초기화
          if (item.facilityType === 'fortress_cannon') {
            planet.data = planet.data || {};
            planet.data.fortressCannonState = createFortressCannonState(1);
          }
          
          logger.info(`[FacilityService] Completed BUILD: ${item.facilityType} on ${item.planetId}`);
          break;
        }
        
        case 'UPGRADE': {
          // 시설 업그레이드
          const facility = planet.facilities.find(f => f.facilityId === item.facilityId);
          if (facility) {
            facility.level = item.targetLevel;
            facility.maxHp = calculateFacilityMaxHp(item.facilityType, item.targetLevel);
            facility.hp = facility.maxHp; // 업그레이드 완료 시 전체 회복
            
            // 요새포 레벨업 시 상태 업데이트
            if (item.facilityType === 'fortress_cannon') {
              planet.data = planet.data || {};
              planet.data.fortressCannonState = createFortressCannonState(item.targetLevel);
            }
            
            logger.info(`[FacilityService] Completed UPGRADE: ${item.facilityType} to level ${item.targetLevel}`);
          }
          break;
        }
        
        case 'REPAIR': {
          // 시설 수리
          const facility = planet.facilities.find(f => f.facilityId === item.facilityId);
          if (facility) {
            facility.hp = facility.maxHp;
            facility.isOperational = true;
            
            logger.info(`[FacilityService] Completed REPAIR: ${item.facilityType} on ${item.planetId}`);
          }
          break;
        }
      }
      
      // 예약된 자원 소비
      const resourceItems: Array<{ type: ResourceType; amount: number }> = [
        { type: 'credits', amount: item.cost.credits },
        { type: 'minerals', amount: item.cost.minerals },
        { type: 'energy', amount: item.cost.energy }
      ];
      
      if (item.cost.shipParts) {
        resourceItems.push({ type: 'shipParts', amount: item.cost.shipParts });
      }
      if (item.cost.rareMetals) {
        resourceItems.push({ type: 'rareMetals', amount: item.cost.rareMetals });
      }
      
      await WarehouseService.consume(
        item.sessionId,
        item.warehouseId,
        resourceItems,
        'FACILITY_CONSTRUCTION'
      );
      
      item.status = 'COMPLETED';
      await item.save();
      await planet.save();
      
    } catch (error) {
      logger.error(`[FacilityService] Error completing construction ${item.queueId}:`, error);
    }
  }

  /**
   * 시설에 데미지 적용
   */
  static async applyDamage(
    sessionId: string,
    planetId: string,
    facilityId: string,
    damage: number
  ): Promise<{ destroyed: boolean; remainingHp: number }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      throw new Error('Planet not found');
    }
    
    const facility = planet.facilities.find(f => f.facilityId === facilityId);
    if (!facility) {
      throw new Error('Facility not found');
    }
    
    // 방어막 효과 적용
    const shieldFacility = planet.facilities.find(
      f => (f.type as string) === 'defense_shield' && f.isOperational
    );
    
    let actualDamage = damage;
    if (shieldFacility) {
      const effect = getFacilityEffect('defense_shield', shieldFacility.level);
      const shieldAbsorb = Math.min(damage * 0.5, effect.shieldStrength || 0);
      actualDamage = damage - shieldAbsorb;
    }
    
    facility.hp = Math.max(0, facility.hp - actualDamage);
    
    // HP 기반 상태 결정
    if (facility.hp === 0) {
      facility.isOperational = false;
      logger.info(`[FacilityService] Facility destroyed: ${facility.type} on ${planetId}`);
    } else if (facility.hp < facility.maxHp * 0.5) {
      // 50% 이하 시 효율 감소 (productionBonus를 음수로)
      facility.productionBonus = -0.5;
      logger.info(`[FacilityService] Facility damaged (efficiency reduced): ${facility.type}`);
    }
    
    await planet.save();
    
    return {
      destroyed: facility.hp === 0,
      remainingHp: facility.hp
    };
  }

  /**
   * 유체 금속 장갑 자동 수리 처리
   */
  static async processAutoRepair(sessionId: string): Promise<void> {
    const planets = await Planet.find({
      sessionId,
      'data.isFortress': true
    });
    
    for (const planet of planets) {
      const liquidArmor = planet.facilities.find(
        f => (f.type as string) === 'liquid_metal_armor' && f.isOperational
      );
      
      if (!liquidArmor) continue;
      
      const effect = getFacilityEffect('liquid_metal_armor', liquidArmor.level);
      const repairRate = (effect.autoRepairRate || 5) / 100;
      
      // 모든 시설에 자동 수리 적용
      for (const facility of planet.facilities) {
        if (facility.hp < facility.maxHp) {
          const repairAmount = Math.floor(facility.maxHp * repairRate);
          facility.hp = Math.min(facility.maxHp, facility.hp + repairAmount);
          
          // HP 50% 이상이면 효율 복구
          if (facility.hp >= facility.maxHp * 0.5 && facility.productionBonus < 0) {
            facility.productionBonus = 0;
          }
          
          // HP 100% 이상이면 운영 재개
          if (facility.hp >= facility.maxHp * 0.1 && !facility.isOperational) {
            facility.isOperational = true;
          }
        }
      }
      
      await planet.save();
      logger.debug(`[FacilityService] Auto-repair processed for fortress ${planet.planetId}`);
    }
  }

  /**
   * 요새포 충전 처리
   */
  static async processFortressCannonCharge(sessionId: string): Promise<void> {
    const planets = await Planet.find({
      sessionId,
      'data.fortressCannonState': { $exists: true }
    });
    
    for (const planet of planets) {
      const cannonState = planet.data?.fortressCannonState as IFortressCannonState;
      if (!cannonState || cannonState.isCharged) continue;
      
      // 요새포가 작동 중인지 확인
      const cannon = planet.facilities.find(
        f => (f.type as string) === 'fortress_cannon' && f.isOperational
      );
      
      if (!cannon) continue;
      
      // 충전
      cannonState.chargeProgress += cannonState.chargePerTurn;
      
      if (cannonState.chargeProgress >= 100) {
        cannonState.chargeProgress = 100;
        cannonState.isCharged = true;
        logger.info(`[FacilityService] Fortress cannon fully charged on ${planet.planetId}`);
      }
      
      planet.data!.fortressCannonState = cannonState;
      await planet.save();
    }
  }

  /**
   * 요새포 발사
   */
  static async fireFortressCannon(
    sessionId: string,
    planetId: string,
    targetFleetId: string
  ): Promise<{ success: boolean; damage?: number; error?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    const cannonState = planet.data?.fortressCannonState as IFortressCannonState;
    if (!cannonState) {
      return { success: false, error: 'No fortress cannon on this planet' };
    }
    
    if (!cannonState.isCharged) {
      return { success: false, error: `Cannon not charged (${cannonState.chargeProgress}%)` };
    }
    
    const cannon = planet.facilities.find(
      f => (f.type as string) === 'fortress_cannon' && f.isOperational
    );
    
    if (!cannon) {
      return { success: false, error: 'Fortress cannon is not operational' };
    }
    
    // 발사!
    const damage = cannonState.damage;
    
    // 상태 리셋
    cannonState.isCharged = false;
    cannonState.chargeProgress = 0;
    cannonState.lastFiredAt = new Date();
    
    planet.data!.fortressCannonState = cannonState;
    await planet.save();
    
    logger.info(`[FacilityService] Fortress cannon fired! Damage: ${damage} at fleet ${targetFleetId}`);
    
    // Note: 실제 데미지 적용은 gin7-tactical-engine이 처리
    return { success: true, damage };
  }

  /**
   * 건설 대기열 조회
   */
  static async getConstructionQueue(
    sessionId: string,
    planetId: string
  ): Promise<IConstructionQueue[]> {
    return ConstructionQueue.find({
      sessionId,
      planetId,
      status: { $in: ['QUEUED', 'IN_PROGRESS'] }
    }).sort({ priority: -1, startTime: 1 });
  }

  /**
   * 건설 취소
   */
  static async cancelConstruction(
    sessionId: string,
    queueId: string
  ): Promise<{ success: boolean; refunded?: Record<string, number>; error?: string }> {
    const item = await ConstructionQueue.findOne({ sessionId, queueId });
    if (!item) {
      return { success: false, error: 'Construction item not found' };
    }
    
    if (item.status !== 'IN_PROGRESS' && item.status !== 'QUEUED') {
      return { success: false, error: 'Cannot cancel completed or already cancelled construction' };
    }
    
    // 80% 환불
    const refunded: Record<string, number> = {};
    const resourceItems: Array<{ type: ResourceType; amount: number }> = [];
    
    const refundAmount = (amount: number) => Math.floor(amount * 0.8);
    
    resourceItems.push({ type: 'credits', amount: item.cost.credits });
    resourceItems.push({ type: 'minerals', amount: item.cost.minerals });
    resourceItems.push({ type: 'energy', amount: item.cost.energy });
    
    if (item.cost.shipParts) {
      resourceItems.push({ type: 'shipParts', amount: item.cost.shipParts });
    }
    if (item.cost.rareMetals) {
      resourceItems.push({ type: 'rareMetals', amount: item.cost.rareMetals });
    }
    
    // 예약 해제
    await WarehouseService.release(sessionId, item.warehouseId, resourceItems);
    
    // 환불 금액 계산
    for (const r of resourceItems) {
      refunded[r.type] = refundAmount(r.amount);
    }
    
    item.status = 'CANCELLED';
    await item.save();
    
    logger.info(`[FacilityService] Construction cancelled: ${queueId}, refunded 80%`);
    
    return { success: true, refunded };
  }

  /**
   * 시설 자동 수리 설정 (토글)
   */
  static async setAutoRepair(
    sessionId: string,
    planetId: string,
    enabled: boolean
  ): Promise<{ success: boolean }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false };
    }
    
    planet.data = planet.data || {};
    planet.data.autoRepairEnabled = enabled;
    await planet.save();
    
    return { success: true };
  }

  // ==================== CHECKLIST B: 시설 조회/피해 API ====================

  /**
   * 특정 시설 조회
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param facilityId 시설 ID
   * @returns 시설 정보 또는 null
   * 
   * 사용 예시:
   * const facility = await FacilityService.getFacilityById('session1', 'planet1', 'FAC-123');
   * if (facility && FacilityService.isFacilityOperational(facility)) { ... }
   */
  static async getFacilityById(
    sessionId: string,
    planetId: string,
    facilityId: string
  ): Promise<IPlanetFacility | null> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        logger.warn(`[FacilityService] Planet not found: ${planetId}`);
        return null;
      }
      
      const facility = planet.facilities.find(f => f.facilityId === facilityId);
      return facility || null;
    } catch (error) {
      logger.error(`[FacilityService] Error getting facility ${facilityId}:`, error);
      return null;
    }
  }

  /**
   * 시설에 피해를 입힘 (SpyService 및 기타 에이전트용 공개 API)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param facilityId 시설 ID
   * @param damageAmount 피해량
   * @returns 피해 결과 (파괴 여부, 남은 HP, 레벨 다운 여부)
   * 
   * 사용 예시:
   * const result = await FacilityService.damageFacility('session1', 'planet1', 'FAC-123', 50);
   * if (result.destroyed) { logger.info('시설 파괴됨!'); }
   */
  static async damageFacility(
    sessionId: string,
    planetId: string,
    facilityId: string,
    damageAmount: number
  ): Promise<{
    success: boolean;
    destroyed: boolean;
    remainingHp: number;
    levelDowngraded: boolean;
    operationalStatusChanged: boolean;
    error?: string;
  }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { 
          success: false, 
          destroyed: false, 
          remainingHp: 0, 
          levelDowngraded: false,
          operationalStatusChanged: false,
          error: 'Planet not found' 
        };
      }
      
      const facility = planet.facilities.find(f => f.facilityId === facilityId);
      if (!facility) {
        return { 
          success: false, 
          destroyed: false, 
          remainingHp: 0, 
          levelDowngraded: false,
          operationalStatusChanged: false,
          error: 'Facility not found' 
        };
      }
      
      const previousHp = facility.hp;
      const previousOperational = facility.isOperational;
      const previousLevel = facility.level;
      
      // 방어막 효과 적용 (있다면)
      const shieldFacility = planet.facilities.find(
        f => (f.type as string) === 'defense_shield' && f.isOperational
      );
      
      let actualDamage = damageAmount;
      if (shieldFacility) {
        const effect = getFacilityEffect('defense_shield', shieldFacility.level);
        const shieldAbsorb = Math.min(damageAmount * 0.3, effect.shieldStrength || 0);
        actualDamage = Math.max(0, damageAmount - shieldAbsorb);
        logger.debug(`[FacilityService] Shield absorbed ${shieldAbsorb} damage`);
      }
      
      // 피해 적용
      facility.hp = Math.max(0, facility.hp - actualDamage);
      
      let levelDowngraded = false;
      let operationalStatusChanged = false;
      
      // HP 기반 상태 결정
      if (facility.hp === 0) {
        // 완전 파괴 - 운영 중단
        facility.isOperational = false;
        operationalStatusChanged = previousOperational;
        logger.info(`[FacilityService] Facility destroyed: ${facility.type} on ${planetId}`);
      } else if (facility.hp < facility.maxHp * 0.3 && facility.level > 1) {
        // 30% 이하 && 레벨 2 이상 -> 레벨 다운 (심각한 피해)
        facility.level = Math.max(1, facility.level - 1);
        facility.maxHp = calculateFacilityMaxHp(facility.type as ExtendedFacilityType, facility.level);
        facility.hp = Math.min(facility.hp, facility.maxHp); // maxHp 초과 방지
        levelDowngraded = true;
        logger.info(`[FacilityService] Facility level downgraded: ${facility.type} to level ${facility.level}`);
      } else if (facility.hp < facility.maxHp * 0.5) {
        // 50% 이하 - 효율 감소
        facility.productionBonus = -0.5;
        if (facility.hp < facility.maxHp * 0.2) {
          // 20% 이하 - 운영 중단
          facility.isOperational = false;
          operationalStatusChanged = previousOperational;
        }
        logger.debug(`[FacilityService] Facility damaged (efficiency reduced): ${facility.type}`);
      }
      
      await planet.save();
      
      return {
        success: true,
        destroyed: facility.hp === 0,
        remainingHp: facility.hp,
        levelDowngraded,
        operationalStatusChanged
      };
    } catch (error) {
      logger.error(`[FacilityService] Error damaging facility ${facilityId}:`, error);
      return { 
        success: false, 
        destroyed: false, 
        remainingHp: 0, 
        levelDowngraded: false,
        operationalStatusChanged: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 시설 파괴 여부 확인 헬퍼
   * @param facility 시설 정보
   * @returns HP가 0인지 여부
   */
  static isFacilityDestroyed(facility: IPlanetFacility): boolean {
    return facility.hp <= 0;
  }

  /**
   * 시설 비활성 여부 확인 헬퍼
   * @param facility 시설 정보
   * @returns 운영 중단 여부
   */
  static isFacilityDisabled(facility: IPlanetFacility): boolean {
    return !facility.isOperational || facility.hp <= 0;
  }

  /**
   * 시설 운영 가능 여부 확인 헬퍼
   * @param facility 시설 정보
   * @returns 운영 가능 여부
   */
  static isFacilityOperational(facility: IPlanetFacility): boolean {
    return facility.isOperational && facility.hp > 0;
  }

  /**
   * 첩보/사보타주로 시설을 손상시킨 것을 기록
   * 사보타주 메타데이터를 시설에 저장 (추후 복구/수사 등에 활용)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param facilityId 시설 ID
   * @param sabotageData 사보타주 정보
   * @returns 성공 여부
   * 
   * 사용 예시:
   * await FacilityService.markFacilitySabotaged('session1', 'planet1', 'FAC-123', {
   *   operationType: 'spy_sabotage',
   *   executedBy: 'spy-char-id',
   *   damage: 50,
   *   timestamp: new Date()
   * });
   */
  static async markFacilitySabotaged(
    sessionId: string,
    planetId: string,
    facilityId: string,
    sabotageData: {
      operationType: string;
      executedBy?: string;
      damage?: number;
      timestamp?: Date;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: 'Planet not found' };
      }
      
      const facility = planet.facilities.find(f => f.facilityId === facilityId);
      if (!facility) {
        return { success: false, error: 'Facility not found' };
      }
      
      // 시설 데이터에 사보타주 기록 추가
      facility.data = facility.data || {};
      facility.data.sabotageHistory = facility.data.sabotageHistory || [];
      facility.data.sabotageHistory.push({
        ...sabotageData,
        timestamp: sabotageData.timestamp || new Date(),
        recordedAt: new Date()
      });
      
      // 마지막 사보타주 기록
      facility.data.lastSabotage = {
        operationType: sabotageData.operationType,
        timestamp: sabotageData.timestamp || new Date()
      };
      
      await planet.save();
      
      logger.info(`[FacilityService] Facility sabotage recorded: ${facilityId} on ${planetId}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`[FacilityService] Error marking facility sabotaged:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * 행성의 특정 타입 시설 조회
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param facilityType 시설 타입
   * @returns 해당 타입의 시설 목록
   */
  static async getFacilitiesByType(
    sessionId: string,
    planetId: string,
    facilityType: ExtendedFacilityType | FacilityType
  ): Promise<IPlanetFacility[]> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) return [];
      
      return planet.facilities.filter(f => f.type === facilityType);
    } catch (error) {
      logger.error(`[FacilityService] Error getting facilities by type:`, error);
      return [];
    }
  }

  /**
   * 행성의 운영 중인 시설만 조회
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @returns 운영 중인 시설 목록
   */
  static async getOperationalFacilities(
    sessionId: string,
    planetId: string
  ): Promise<IPlanetFacility[]> {
    try {
      const facilities = await this.getPlanetFacilities(sessionId, planetId);
      return facilities.filter(f => this.isFacilityOperational(f));
    } catch (error) {
      logger.error(`[FacilityService] Error getting operational facilities:`, error);
      return [];
    }
  }
}

