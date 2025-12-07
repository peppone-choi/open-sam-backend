/**
 * AutoProductionService
 * 지역별 자동 생산 및 수송 처리 서비스
 */

import { ProductionRule, IProductionRule, SHIP_TYPE_MAPPING, EMPIRE_PRODUCTION_DATA, ALLIANCE_PRODUCTION_DATA, LOCATION_NAMES } from '../../models/logh/ProductionRule.model';
import { TransportPlan, ITransportPlan } from '../../models/logh/TransportPlan.model';
import { Planet, IPlanet } from '../../models/logh/Planet.model';
import { v4 as uuidv4 } from 'uuid';

interface ProductionResult {
  locationId: string;
  locationName: string;
  producedItems: {
    itemType: string;
    itemTypeKo: string;
    quantity: number;
  }[];
  totalProduced: number;
}

interface TransportResult {
  planId: string;
  sourceId: string;
  destinationId: string;
  packages: {
    itemType: string;
    quantity: number;
  }[];
  status: 'executed' | 'pending' | 'failed';
  message?: string;
}

export class AutoProductionService {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 세션에 대한 생산 규칙 초기화
   * 부록 데이터 기반으로 ProductionRule 생성
   */
  async initializeProductionRules(): Promise<number> {
    let createdCount = 0;

    // 제국 생산 규칙 생성
    for (const [locationId, ships] of Object.entries(EMPIRE_PRODUCTION_DATA)) {
      const existing = await ProductionRule.findOne({
        session_id: this.sessionId,
        locationId,
      });

      if (!existing) {
        const locationInfo = LOCATION_NAMES[locationId] || { ko: locationId, en: locationId };
        
        const items = ships.map(shipType => ({
          itemType: shipType,
          itemTypeKo: SHIP_TYPE_MAPPING[shipType]?.ko || shipType,
          itemTypeEn: SHIP_TYPE_MAPPING[shipType]?.en || shipType,
          rate: 1, // 기본 턴당 1척
          enabled: true,
        }));

        await ProductionRule.create({
          session_id: this.sessionId,
          locationId,
          locationName: locationInfo.ko,
          faction: 'empire',
          items,
          requirements: {
            minIndustry: 60,
            minTechnology: 40,
            requiredFacility: '조병공창',
          },
          autoProduction: {
            enabled: true,
            interval: 1,
            lastProductionTurn: 0,
          },
          isActive: true,
        });
        createdCount++;
      }
    }

    // 동맹 생산 규칙 생성
    for (const [locationId, ships] of Object.entries(ALLIANCE_PRODUCTION_DATA)) {
      const existing = await ProductionRule.findOne({
        session_id: this.sessionId,
        locationId,
      });

      if (!existing) {
        const locationInfo = LOCATION_NAMES[locationId] || { ko: locationId, en: locationId };
        
        const items = ships.map(shipType => ({
          itemType: shipType,
          itemTypeKo: SHIP_TYPE_MAPPING[shipType]?.ko || shipType,
          itemTypeEn: SHIP_TYPE_MAPPING[shipType]?.en || shipType,
          rate: 1,
          enabled: true,
        }));

        await ProductionRule.create({
          session_id: this.sessionId,
          locationId,
          locationName: locationInfo.ko,
          faction: 'alliance',
          items,
          requirements: {
            minIndustry: 60,
            minTechnology: 40,
            requiredFacility: '조병공창',
          },
          autoProduction: {
            enabled: true,
            interval: 1,
            lastProductionTurn: 0,
          },
          isActive: true,
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * 턴 종료 시 자동 생산 처리
   */
  async processAutoProduction(currentTurn: number): Promise<ProductionResult[]> {
    const results: ProductionResult[] = [];

    // 활성화된 모든 생산 규칙 조회
    const rules = await ProductionRule.find({
      session_id: this.sessionId,
      isActive: true,
      'autoProduction.enabled': true,
    });

    for (const rule of rules) {
      // 생산 주기 확인
      const turnsSinceLastProduction = currentTurn - rule.autoProduction.lastProductionTurn;
      if (turnsSinceLastProduction < rule.autoProduction.interval) {
        continue;
      }

      // 해당 행성 조회
      const planet = await Planet.findOne({
        session_id: this.sessionId,
        planetId: rule.locationId,
      });

      if (!planet) {
        console.warn(`Planet not found for production rule: ${rule.locationId}`);
        continue;
      }

      // 소유권 확인 (적에게 점령당했으면 생산 중단)
      if (planet.owner !== rule.faction) {
        continue;
      }

      // 요구 조건 확인
      const industry = planet.stats?.industry || 0;
      const technology = planet.stats?.technology || 0;

      if (industry < rule.requirements.minIndustry || 
          technology < rule.requirements.minTechnology) {
        continue;
      }

      // 생산 실행
      const producedItems: { itemType: string; itemTypeKo: string; quantity: number }[] = [];
      let totalProduced = 0;

      for (const item of rule.items) {
        if (!item.enabled) continue;

        const quantity = item.rate;
        producedItems.push({
          itemType: item.itemType,
          itemTypeKo: item.itemTypeKo || item.itemType,
          quantity,
        });
        totalProduced += quantity;

        // 행성 창고에 추가
        planet.warehouse.ships += quantity;
      }

      // 생산 시간 업데이트
      rule.autoProduction.lastProductionTurn = currentTurn;
      await rule.save();

      // 행성 저장
      await planet.save();

      if (totalProduced > 0) {
        results.push({
          locationId: rule.locationId,
          locationName: rule.locationName,
          producedItems,
          totalProduced,
        });
      }
    }

    return results;
  }

  /**
   * 정기 수송 처리
   */
  async processTransportPlans(currentTurn: number): Promise<TransportResult[]> {
    const results: TransportResult[] = [];

    // 실행 예정인 수송 계획 조회
    const plans = await TransportPlan.find({
      session_id: this.sessionId,
      status: 'active',
      'schedule.nextExecutionTurn': { $lte: currentTurn },
    });

    for (const plan of plans) {
      const result = await this.executeTransportPlan(plan, currentTurn);
      results.push(result);
    }

    return results;
  }

  /**
   * 수송 계획 실행
   */
  private async executeTransportPlan(plan: ITransportPlan, currentTurn: number): Promise<TransportResult> {
    // 출발지/도착지 행성 조회
    const sourcePlanet = await Planet.findOne({
      session_id: this.sessionId,
      planetId: plan.sourceId,
    });

    const destPlanet = await Planet.findOne({
      session_id: this.sessionId,
      planetId: plan.destinationId,
    });

    if (!sourcePlanet || !destPlanet) {
      return {
        planId: plan.planId,
        sourceId: plan.sourceId,
        destinationId: plan.destinationId,
        packages: [],
        status: 'failed',
        message: '출발지 또는 도착지 행성을 찾을 수 없습니다.',
      };
    }

    // 소유권 확인
    if (sourcePlanet.owner !== plan.faction || destPlanet.owner !== plan.faction) {
      return {
        planId: plan.planId,
        sourceId: plan.sourceId,
        destinationId: plan.destinationId,
        packages: [],
        status: 'failed',
        message: '출발지 또는 도착지가 적에게 점령당했습니다.',
      };
    }

    // 패키지 이동 처리
    const executedPackages: { itemType: string; quantity: number }[] = [];

    for (const pkg of plan.packages) {
      if (pkg.status !== 'pending') continue;

      let canTransport = false;
      let quantity = pkg.quantity;

      switch (pkg.itemType) {
        case 'ship':
          if (sourcePlanet.warehouse.ships >= quantity) {
            sourcePlanet.warehouse.ships -= quantity;
            destPlanet.warehouse.ships += quantity;
            canTransport = true;
          }
          break;
        case 'supplies':
          if (sourcePlanet.warehouse.supplies >= quantity) {
            sourcePlanet.warehouse.supplies -= quantity;
            destPlanet.warehouse.supplies += quantity;
            canTransport = true;
          }
          break;
        // fuel, troops 등 추가 가능
      }

      if (canTransport) {
        pkg.status = 'delivered';
        executedPackages.push({
          itemType: pkg.itemType,
          quantity,
        });
      }
    }

    // 행성 저장
    await sourcePlanet.save();
    await destPlanet.save();

    // 로그 기록
    plan.executionLog.push({
      turn: currentTurn,
      timestamp: new Date(),
      action: 'executed',
      details: { packages: executedPackages },
    });

    // 다음 실행 턴 계산 (반복 수송인 경우)
    if (plan.schedule.type === 'recurring') {
      plan.schedule.lastExecutedTurn = currentTurn;
      plan.schedule.nextExecutionTurn = currentTurn + plan.schedule.interval;
    } else {
      plan.status = 'completed';
    }

    await plan.save();

    return {
      planId: plan.planId,
      sourceId: plan.sourceId,
      destinationId: plan.destinationId,
      packages: executedPackages,
      status: 'executed',
    };
  }

  /**
   * 수송 계획 생성
   */
  async createTransportPlan(params: {
    sourceId: string;
    destinationId: string;
    faction: 'empire' | 'alliance';
    packages: { itemType: string; itemSubType?: string; quantity: number }[];
    recurring?: boolean;
    interval?: number;
  }): Promise<ITransportPlan> {
    const sourcePlanet = await Planet.findOne({
      session_id: this.sessionId,
      planetId: params.sourceId,
    });

    const destPlanet = await Planet.findOne({
      session_id: this.sessionId,
      planetId: params.destinationId,
    });

    if (!sourcePlanet || !destPlanet) {
      throw new Error('출발지 또는 도착지 행성을 찾을 수 없습니다.');
    }

    const planId = `TP-${uuidv4().substring(0, 8)}`;

    const packages = params.packages.map(pkg => ({
      packageId: `PKG-${uuidv4().substring(0, 8)}`,
      itemType: pkg.itemType,
      itemSubType: pkg.itemSubType,
      quantity: pkg.quantity,
      status: 'pending' as const,
      createdAt: new Date(),
    }));

    const plan = await TransportPlan.create({
      session_id: this.sessionId,
      planId,
      sourceId: params.sourceId,
      sourceName: sourcePlanet.name,
      destinationId: params.destinationId,
      destinationName: destPlanet.name,
      faction: params.faction,
      schedule: {
        type: params.recurring ? 'recurring' : 'once',
        interval: params.interval || 1,
        lastExecutedTurn: 0,
        nextExecutionTurn: 1,
      },
      packages,
      transitTime: 1, // 기본 1턴 소요
      status: 'active',
      executionLog: [],
    });

    return plan;
  }

  /**
   * 생산 규칙 조회
   */
  async getProductionRules(faction?: 'empire' | 'alliance'): Promise<IProductionRule[]> {
    const query: any = { session_id: this.sessionId };
    if (faction) {
      query.faction = faction;
    }
    return ProductionRule.find(query);
  }

  /**
   * 수송 계획 조회
   */
  async getTransportPlans(faction?: 'empire' | 'alliance'): Promise<ITransportPlan[]> {
    const query: any = { session_id: this.sessionId };
    if (faction) {
      query.faction = faction;
    }
    return TransportPlan.find(query);
  }

  /**
   * 특정 행성의 생산 규칙 조회
   */
  async getProductionRuleByLocation(locationId: string): Promise<IProductionRule | null> {
    return ProductionRule.findOne({
      session_id: this.sessionId,
      locationId,
    });
  }

  /**
   * 생산 규칙 업데이트
   */
  async updateProductionRule(
    locationId: string,
    updates: Partial<{
      isActive: boolean;
      items: { itemType: string; rate: number; enabled: boolean }[];
    }>
  ): Promise<IProductionRule | null> {
    return ProductionRule.findOneAndUpdate(
      { session_id: this.sessionId, locationId },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * 수송 계획 취소
   */
  async cancelTransportPlan(planId: string): Promise<boolean> {
    const result = await TransportPlan.updateOne(
      { session_id: this.sessionId, planId },
      { $set: { status: 'cancelled' } }
    );
    return result.modifiedCount > 0;
  }
}








