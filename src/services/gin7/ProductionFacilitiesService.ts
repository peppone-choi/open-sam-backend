/**
 * ProductionFacilitiesService - 생산 시설 관리
 * 매뉴얼 기반 구현
 *
 * 기능:
 * - 시설 건설/업그레이드
 * - 생산 대기열 관리
 * - 자원 소비 처리
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Planet, IPlanet, IPlanetFacility } from '../../models/gin7/Planet';
import { TimeEngine, GIN7_EVENTS, DayStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum FacilityCategory {
  MILITARY = 'MILITARY',         // 군사 시설
  INDUSTRY = 'INDUSTRY',         // 산업 시설
  RESEARCH = 'RESEARCH',         // 연구 시설
  INFRASTRUCTURE = 'INFRASTRUCTURE', // 기반 시설
  DEFENSE = 'DEFENSE',           // 방어 시설
}

export interface FacilityDefinition {
  facilityId: string;
  name: string;
  category: FacilityCategory;
  maxLevel: number;
  baseBuildTime: number;         // 틱 단위
  baseBuildCost: number;
  baseUpkeep: number;            // 월간 유지비
  effects: FacilityEffect[];
  prerequisites?: {
    facilityId: string;
    minLevel: number;
  }[];
}

export interface FacilityEffect {
  type: 'PRODUCTION' | 'DEFENSE' | 'RESEARCH' | 'MORALE' | 'CAPACITY' | 'TRAINING';
  target: string;                // 대상 (ships, fighters, credits, etc.)
  modifier: number;              // 효과 수치
  isPercent: boolean;
}

export interface ProductionQueue {
  queueId: string;
  planetId: string;
  itemType: 'SHIP' | 'FIGHTER' | 'TROOP' | 'MATERIAL';
  itemId: string;
  quantity: number;
  priority: number;
  startedAt: Date;
  estimatedCompletion: Date;
  progress: number;              // 0-100
}

export interface ProductionBuildResult {
  success: boolean;
  facilityId?: string;
  estimatedTime?: number;
  cost?: number;
  error?: string;
}

// ============================================================
// 시설 정의
// ============================================================

export const FACILITY_DEFINITIONS: FacilityDefinition[] = [
  // 군사 시설
  {
    facilityId: 'SHIPYARD',
    name: '조선소',
    category: FacilityCategory.MILITARY,
    maxLevel: 10,
    baseBuildTime: 720,
    baseBuildCost: 100000,
    baseUpkeep: 5000,
    effects: [
      { type: 'PRODUCTION', target: 'ships', modifier: 10, isPercent: true },
      { type: 'CAPACITY', target: 'shipBuildSlots', modifier: 1, isPercent: false },
    ],
  },
  {
    facilityId: 'MILITARY_ACADEMY',
    name: '사관학교',
    category: FacilityCategory.MILITARY,
    maxLevel: 5,
    baseBuildTime: 1440,
    baseBuildCost: 200000,
    baseUpkeep: 10000,
    effects: [
      { type: 'TRAINING', target: 'crew', modifier: 15, isPercent: true },
      { type: 'PRODUCTION', target: 'officers', modifier: 5, isPercent: false },
    ],
  },
  {
    facilityId: 'FORTRESS',
    name: '행성 요새',
    category: FacilityCategory.DEFENSE,
    maxLevel: 5,
    baseBuildTime: 2880,
    baseBuildCost: 500000,
    baseUpkeep: 20000,
    effects: [
      { type: 'DEFENSE', target: 'ground', modifier: 100, isPercent: false },
      { type: 'DEFENSE', target: 'orbital', modifier: 50, isPercent: false },
    ],
  },
  {
    facilityId: 'FIGHTER_FACTORY',
    name: '전투기 공장',
    category: FacilityCategory.MILITARY,
    maxLevel: 10,
    baseBuildTime: 360,
    baseBuildCost: 50000,
    baseUpkeep: 2500,
    effects: [
      { type: 'PRODUCTION', target: 'fighters', modifier: 20, isPercent: true },
      { type: 'CAPACITY', target: 'fighterStorage', modifier: 100, isPercent: false },
    ],
  },

  // 산업 시설
  {
    facilityId: 'REFINERY',
    name: '정제소',
    category: FacilityCategory.INDUSTRY,
    maxLevel: 10,
    baseBuildTime: 480,
    baseBuildCost: 75000,
    baseUpkeep: 3000,
    effects: [
      { type: 'PRODUCTION', target: 'fuel', modifier: 15, isPercent: true },
      { type: 'PRODUCTION', target: 'materials', modifier: 10, isPercent: true },
    ],
  },
  {
    facilityId: 'MUNITIONS_FACTORY',
    name: '군수 공장',
    category: FacilityCategory.INDUSTRY,
    maxLevel: 10,
    baseBuildTime: 600,
    baseBuildCost: 80000,
    baseUpkeep: 4000,
    effects: [
      { type: 'PRODUCTION', target: 'ammo', modifier: 20, isPercent: true },
      { type: 'PRODUCTION', target: 'missiles', modifier: 15, isPercent: true },
    ],
  },
  {
    facilityId: 'TRADE_CENTER',
    name: '무역 센터',
    category: FacilityCategory.INDUSTRY,
    maxLevel: 5,
    baseBuildTime: 720,
    baseBuildCost: 150000,
    baseUpkeep: 8000,
    effects: [
      { type: 'PRODUCTION', target: 'credits', modifier: 10, isPercent: true },
      { type: 'MORALE', target: 'population', modifier: 5, isPercent: false },
    ],
  },

  // 연구 시설
  {
    facilityId: 'RESEARCH_LAB',
    name: '연구소',
    category: FacilityCategory.RESEARCH,
    maxLevel: 10,
    baseBuildTime: 960,
    baseBuildCost: 120000,
    baseUpkeep: 6000,
    effects: [
      { type: 'RESEARCH', target: 'tech', modifier: 10, isPercent: true },
    ],
  },

  // 기반 시설
  {
    facilityId: 'SPACEPORT',
    name: '우주항',
    category: FacilityCategory.INFRASTRUCTURE,
    maxLevel: 5,
    baseBuildTime: 1080,
    baseBuildCost: 200000,
    baseUpkeep: 10000,
    effects: [
      { type: 'CAPACITY', target: 'dockSlots', modifier: 5, isPercent: false },
      { type: 'CAPACITY', target: 'tradeVolume', modifier: 20, isPercent: true },
    ],
  },
  {
    facilityId: 'COMMUNICATIONS_HUB',
    name: '통신 기지',
    category: FacilityCategory.INFRASTRUCTURE,
    maxLevel: 5,
    baseBuildTime: 480,
    baseBuildCost: 60000,
    baseUpkeep: 3000,
    effects: [
      { type: 'CAPACITY', target: 'commandRange', modifier: 10, isPercent: true },
    ],
  },

  // 방어 시설
  {
    facilityId: 'PLANETARY_SHIELD',
    name: '행성 방어막',
    category: FacilityCategory.DEFENSE,
    maxLevel: 3,
    baseBuildTime: 2160,
    baseBuildCost: 400000,
    baseUpkeep: 15000,
    effects: [
      { type: 'DEFENSE', target: 'orbital', modifier: 200, isPercent: false },
    ],
    prerequisites: [{ facilityId: 'FORTRESS', minLevel: 3 }],
  },
  {
    facilityId: 'GROUND_BATTERY',
    name: '지상 포대',
    category: FacilityCategory.DEFENSE,
    maxLevel: 10,
    baseBuildTime: 240,
    baseBuildCost: 30000,
    baseUpkeep: 1500,
    effects: [
      { type: 'DEFENSE', target: 'ground', modifier: 20, isPercent: false },
      { type: 'DEFENSE', target: 'antiAir', modifier: 10, isPercent: false },
    ],
  },
];

// ============================================================
// ProductionFacilitiesService Class
// ============================================================

export class ProductionFacilitiesService extends EventEmitter {
  private static instance: ProductionFacilitiesService;
  
  // 생산 대기열 캐시
  private productionQueues: Map<string, ProductionQueue[]> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[ProductionFacilitiesService] Initialized');
  }

  public static getInstance(): ProductionFacilitiesService {
    if (!ProductionFacilitiesService.instance) {
      ProductionFacilitiesService.instance = new ProductionFacilitiesService();
    }
    return ProductionFacilitiesService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 일일 생산 처리
      timeEngine.on(GIN7_EVENTS.DAY_START, async (payload: DayStartPayload) => {
        await this.processProductionQueues(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[ProductionFacilitiesService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 시설 건설
  // ============================================================

  /**
   * 시설 건설 시작
   */
  public async buildFacility(
    sessionId: string,
    planetId: string,
    facilityId: string,
  ): Promise<ProductionBuildResult> {
    const definition = FACILITY_DEFINITIONS.find(f => f.facilityId === facilityId);
    if (!definition) {
      return { success: false, error: '시설 정의를 찾을 수 없습니다.' };
    }

    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: '행성을 찾을 수 없습니다.' };
    }

    // 기존 시설 확인
    const existingFacility = planet.facilities?.find(f => f.type === facilityId);
    const currentLevel = existingFacility?.level || 0;

    if (currentLevel >= definition.maxLevel) {
      return { success: false, error: '이미 최대 레벨입니다.' };
    }

    // 선행 조건 확인
    if (definition.prerequisites) {
      for (const prereq of definition.prerequisites) {
        const prereqFacility = planet.facilities?.find(f => f.type === prereq.facilityId);
        if (!prereqFacility || prereqFacility.level < prereq.minLevel) {
          return { success: false, error: `선행 시설 필요: ${prereq.facilityId} Lv.${prereq.minLevel}` };
        }
      }
    }

    // 비용 계산 (레벨당 50% 증가)
    const levelMultiplier = Math.pow(1.5, currentLevel);
    const buildCost = Math.floor(definition.baseBuildCost * levelMultiplier);
    const buildTime = Math.floor(definition.baseBuildTime * levelMultiplier);

    // 건설 시작
    if (existingFacility) {
      existingFacility.isBuilding = true;
      existingFacility.buildProgress = 0;
      existingFacility.buildCompletesAt = new Date(Date.now() + buildTime * 1000);
    } else {
      const newFacility: IPlanetFacility = {
        facilityId: `FAC-${Date.now()}`,
        type: facilityId as any,
        level: 0,
        hp: 100,
        maxHp: 100,
        isOperational: false,
        productionBonus: 0,
        isBuilding: true,
        buildProgress: 0,
        buildCompletesAt: new Date(Date.now() + buildTime * 1000),
      };
      if (!planet.facilities) planet.facilities = [];
      planet.facilities.push(newFacility);
    }

    await planet.save();

    this.emit('facility:buildStarted', {
      sessionId,
      planetId,
      facilityId,
      targetLevel: currentLevel + 1,
      buildTime,
      buildCost,
    });

    logger.info(`[ProductionFacilitiesService] Started building ${facilityId} on ${planetId}`);

    return {
      success: true,
      facilityId,
      estimatedTime: buildTime,
      cost: buildCost,
    };
  }

  /**
   * 시설 건설 진행 (틱 처리)
   */
  public async updateBuildProgress(sessionId: string): Promise<void> {
    const planets = await Planet.find({ 
      sessionId,
      'facilities.isBuilding': true,
    });

    for (const planet of planets) {
      let updated = false;
      
      for (const facility of planet.facilities || []) {
        if (!facility.isBuilding) continue;

        const now = new Date();
        if (facility.buildCompletesAt && now >= facility.buildCompletesAt) {
          // 건설 완료
          facility.level = (facility.level || 0) + 1;
          facility.isBuilding = false;
          facility.buildProgress = undefined;
          facility.buildCompletesAt = undefined;
          updated = true;

          this.emit('facility:buildCompleted', {
            sessionId,
            planetId: planet.planetId,
            facilityId: facility.type,
            newLevel: facility.level,
          });

          logger.info(`[ProductionFacilitiesService] Completed ${facility.type} Lv.${facility.level} on ${planet.planetId}`);
        } else if (facility.buildCompletesAt) {
          // 진행도 업데이트
          const startTime = facility.buildCompletesAt.getTime() - (FACILITY_DEFINITIONS.find(f => f.facilityId === facility.type)?.baseBuildTime || 720) * 1000;
          const totalTime = facility.buildCompletesAt.getTime() - startTime;
          const elapsed = now.getTime() - startTime;
          facility.buildProgress = Math.min(100, Math.floor((elapsed / totalTime) * 100));
        }
      }

      if (updated) {
        await planet.save();
      }
    }
  }

  // ============================================================
  // 생산 대기열
  // ============================================================

  /**
   * 생산 대기열에 추가
   */
  public async addToProductionQueue(
    sessionId: string,
    planetId: string,
    itemType: ProductionQueue['itemType'],
    itemId: string,
    quantity: number,
    priority: number = 5,
  ): Promise<{ success: boolean; queueId?: string; error?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: '행성을 찾을 수 없습니다.' };
    }

    // 생산 능력 확인
    const productionCapacity = this.calculateProductionCapacity(planet, itemType);
    if (productionCapacity <= 0) {
      return { success: false, error: '생산 시설이 없습니다.' };
    }

    // 예상 완료 시간 계산
    const baseTime = this.getBaseProductionTime(itemType, itemId);
    const totalTime = Math.floor(baseTime * quantity / productionCapacity);
    const estimatedCompletion = new Date(Date.now() + totalTime * 1000);

    const queue: ProductionQueue = {
      queueId: `PROD-${uuidv4().slice(0, 8)}`,
      planetId,
      itemType,
      itemId,
      quantity,
      priority,
      startedAt: new Date(),
      estimatedCompletion,
      progress: 0,
    };

    const key = `${sessionId}-${planetId}`;
    const queues = this.productionQueues.get(key) || [];
    queues.push(queue);
    queues.sort((a, b) => b.priority - a.priority); // 우선순위 정렬
    this.productionQueues.set(key, queues);

    this.emit('production:queued', {
      sessionId,
      planetId,
      queueId: queue.queueId,
      itemType,
      itemId,
      quantity,
    });

    return { success: true, queueId: queue.queueId };
  }

  /**
   * 생산 대기열 처리 (일일)
   */
  private async processProductionQueues(sessionId: string): Promise<void> {
    const planets = await Planet.find({ sessionId });

    for (const planet of planets) {
      const key = `${sessionId}-${planet.planetId}`;
      const queues = this.productionQueues.get(key) || [];

      for (let i = queues.length - 1; i >= 0; i--) {
        const queue = queues[i];
        const now = new Date();

        if (now >= queue.estimatedCompletion) {
          // 생산 완료
          this.emit('production:completed', {
            sessionId,
            planetId: planet.planetId,
            queueId: queue.queueId,
            itemType: queue.itemType,
            itemId: queue.itemId,
            quantity: queue.quantity,
          });

          queues.splice(i, 1);
          logger.info(`[ProductionFacilitiesService] Production completed: ${queue.quantity}x ${queue.itemId}`);
        } else {
          // 진행도 업데이트
          const startTime = queue.startedAt.getTime();
          const totalTime = queue.estimatedCompletion.getTime() - startTime;
          const elapsed = now.getTime() - startTime;
          queue.progress = Math.min(100, Math.floor((elapsed / totalTime) * 100));
        }
      }

      this.productionQueues.set(key, queues);
    }
  }

  /**
   * 생산 능력 계산
   */
  private calculateProductionCapacity(planet: IPlanet, itemType: ProductionQueue['itemType']): number {
    let capacity = 1; // 기본 생산력

    const facilities = planet.facilities || [];

    switch (itemType) {
      case 'SHIP':
        const shipyard = facilities.find(f => f.type === 'shipyard');
        if (shipyard) {
          capacity += shipyard.level * 2;
        }
        break;
      case 'FIGHTER':
        const fighterFactory = facilities.find(f => f.type === 'fighter_factory');
        if (fighterFactory) {
          capacity += fighterFactory.level * 5;
        }
        break;
      case 'TROOP':
        const academy = facilities.find(f => f.type === 'military_academy');
        if (academy) {
          capacity += academy.level * 3;
        }
        break;
      case 'MATERIAL':
        const refinery = facilities.find(f => f.type === 'refinery');
        if (refinery) {
          capacity += refinery.level * 10;
        }
        break;
    }

    return capacity;
  }

  /**
   * 기본 생산 시간 조회
   */
  private getBaseProductionTime(itemType: ProductionQueue['itemType'], itemId: string): number {
    // 아이템 타입별 기본 시간 (틱 단위)
    const baseTimes: Record<string, number> = {
      SHIP: 240,
      FIGHTER: 24,
      TROOP: 12,
      MATERIAL: 48,
    };
    return baseTimes[itemType] || 60;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 시설 정의 조회
   */
  public getFacilityDefinition(facilityId: string): FacilityDefinition | undefined {
    return FACILITY_DEFINITIONS.find(f => f.facilityId === facilityId);
  }

  /**
   * 모든 시설 정의 조회
   */
  public getAllFacilityDefinitions(): FacilityDefinition[] {
    return FACILITY_DEFINITIONS;
  }

  /**
   * 카테고리별 시설 조회
   */
  public getFacilitiesByCategory(category: FacilityCategory): FacilityDefinition[] {
    return FACILITY_DEFINITIONS.filter(f => f.category === category);
  }

  /**
   * 행성 시설 현황 조회
   */
  public async getPlanetFacilities(sessionId: string, planetId: string): Promise<{
    facilities: Array<{
      definition: FacilityDefinition;
      currentLevel: number;
      isBuilding: boolean;
      buildProgress?: number;
      effects: FacilityEffect[];
    }>;
    totalEffects: Record<string, number>;
  }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { facilities: [], totalEffects: {} };
    }

    const facilities = [];
    const totalEffects: Record<string, number> = {};

    for (const facilityDef of FACILITY_DEFINITIONS) {
      const planetFacility = planet.facilities?.find(f => f.type === facilityDef.facilityId);
      const currentLevel = planetFacility?.level || 0;

      if (currentLevel > 0 || planetFacility?.isBuilding) {
        const effectMultiplier = currentLevel;
        const scaledEffects = facilityDef.effects.map(e => ({
          ...e,
          modifier: e.modifier * effectMultiplier,
        }));

        facilities.push({
          definition: facilityDef,
          currentLevel,
          isBuilding: planetFacility?.isBuilding || false,
          buildProgress: planetFacility?.buildProgress,
          effects: scaledEffects,
        });

        // 총 효과 합산
        for (const effect of scaledEffects) {
          const key = `${effect.type}_${effect.target}`;
          totalEffects[key] = (totalEffects[key] || 0) + effect.modifier;
        }
      }
    }

    return { facilities, totalEffects };
  }

  /**
   * 생산 대기열 조회
   */
  public getProductionQueue(sessionId: string, planetId: string): ProductionQueue[] {
    const key = `${sessionId}-${planetId}`;
    return this.productionQueues.get(key) || [];
  }
}

export const productionFacilitiesService = ProductionFacilitiesService.getInstance();
export default ProductionFacilitiesService;





