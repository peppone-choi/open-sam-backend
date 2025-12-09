/**
 * LogisticsService - 창고 및 물류 시스템 서비스
 * 매뉴얼 1932~2105행 기반
 *
 * 주요 기능:
 * - 할당 (ALLOCATE): 행성 창고 -> 부대 창고
 * - 재편성 (REORGANIZE): 부대 <-> 부대 창고 유닛 교환
 * - 보충 (RESUPPLY): 부대 창고 -> 유닛 상태 회복
 * - 제한 조건 관리
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet, ShipClass, SHIP_SPECS } from '../../models/gin7/Fleet';
import { Warehouse, IWarehouse, ResourceType as WarehouseResourceType } from '../../models/gin7/Warehouse';
import { logger } from '../../common/logger';

/**
 * 자원 타입 열거형
 */
export enum ResourceType {
  CREDITS = 'CREDITS', // 크레딧
  FUEL = 'FUEL', // 연료
  AMMO = 'AMMO', // 탄약
  MATERIALS = 'MATERIALS', // 자재
}

/**
 * 유닛 타입 열거형
 */
export enum UnitType {
  BATTLESHIP = 'BATTLESHIP',
  FAST_BATTLESHIP = 'FAST_BATTLESHIP',
  CRUISER = 'CRUISER',
  ATTACK_CRUISER = 'ATTACK_CRUISER',
  DESTROYER = 'DESTROYER',
  CARRIER = 'CARRIER',
  TORPEDO_CARRIER = 'TORPEDO_CARRIER',
  LANDING_SHIP = 'LANDING_SHIP',
  TRANSPORT_SHIP = 'TRANSPORT_SHIP',
  TROOP_TRANSPORT = 'TROOP_TRANSPORT',
  REPAIR_SHIP = 'REPAIR_SHIP',
  CREW = 'CREW',
  ARMORED_INFANTRY = 'ARMORED_INFANTRY', // 장갑병
  ARMORED_GRENADIER = 'ARMORED_GRENADIER', // 장갑척탄병
  LIGHT_INFANTRY = 'LIGHT_INFANTRY', // 경장육전병
}

/**
 * 할당 요청 인터페이스
 */
export interface LogisticsAllocationRequest {
  planetId: string;
  fleetId: string;
  units: Array<{ unitType: UnitType; quantity: number }>;
  resources: Array<{ resourceType: ResourceType; quantity: number }>;
}

/**
 * 재편성 요청 인터페이스
 */
export interface ReorganizationRequest {
  fleetId: string;
  fromFleet: Array<{ unitType: UnitType; quantity: number }>;
  toFleet: Array<{ unitType: UnitType; quantity: number }>;
}

/**
 * 보충 요청 인터페이스
 */
export interface ResupplyRequest {
  fleetId: string;
  targetUnitId: string;
  unitType: UnitType;
  quantity: number;
}

/**
 * 물류 작업 결과 인터페이스
 */
export interface LogisticsResult {
  success: boolean;
  error?: string;
  transferredUnits?: Array<{ unitType: UnitType; quantity: number }>;
  transferredResources?: Array<{ resourceType: ResourceType; quantity: number }>;
}

/**
 * 담당 역직별 할당 권한 매핑 (매뉴얼 1959행)
 */
const ALLOCATION_AUTHORITY: Record<
  string,
  { fleet: boolean; patrol: boolean; transport: boolean; ground: boolean }
> = {
  STRATEGY_CHIEF_1: { fleet: true, patrol: false, transport: false, ground: false }, // 통수본부작전1과장
  STRATEGY_CHIEF_2: { fleet: false, patrol: true, transport: true, ground: true }, // 통수본부작전2과장
  JOINT_OPS_VICE_3: { fleet: true, patrol: true, transport: true, ground: true }, // 통합작전본부제3차장
};

/**
 * 부대 타입 열거형 (Fleet Type)
 */
export enum FleetType {
  FLEET = 'fleet',           // 정규 함대
  PATROL = 'patrol',         // 순찰대
  TRANSPORT = 'transport',   // 수송대
  GROUND = 'ground_force',   // 지상군
  GARRISON = 'garrison',     // 수비대
}

/**
 * 유닛 타입별 승무원 요구량 (매뉴얼 2054행 기반)
 */
const CREW_REQUIREMENTS: Record<UnitType, number> = {
  [UnitType.BATTLESHIP]: 500,
  [UnitType.FAST_BATTLESHIP]: 450,
  [UnitType.CRUISER]: 300,
  [UnitType.ATTACK_CRUISER]: 280,
  [UnitType.DESTROYER]: 150,
  [UnitType.CARRIER]: 800,
  [UnitType.TORPEDO_CARRIER]: 350,
  [UnitType.LANDING_SHIP]: 200,
  [UnitType.TRANSPORT_SHIP]: 100,
  [UnitType.TROOP_TRANSPORT]: 120,
  [UnitType.REPAIR_SHIP]: 150,
  [UnitType.CREW]: 1,
  [UnitType.ARMORED_INFANTRY]: 50,
  [UnitType.ARMORED_GRENADIER]: 60,
  [UnitType.LIGHT_INFANTRY]: 30,
};

/**
 * UnitType -> ShipClass 매핑
 */
const UNIT_TYPE_TO_SHIP_CLASS: Partial<Record<UnitType, ShipClass>> = {
  [UnitType.BATTLESHIP]: 'battleship',
  [UnitType.CRUISER]: 'cruiser',
  [UnitType.DESTROYER]: 'destroyer',
  [UnitType.CARRIER]: 'carrier',
  [UnitType.TRANSPORT_SHIP]: 'transport',
  [UnitType.REPAIR_SHIP]: 'engineering',
};

/**
 * ResourceType -> WarehouseResourceType 매핑
 */
const RESOURCE_TYPE_MAP: Record<ResourceType, WarehouseResourceType> = {
  [ResourceType.CREDITS]: 'credits',
  [ResourceType.FUEL]: 'fuel',
  [ResourceType.AMMO]: 'ammo',
  [ResourceType.MATERIALS]: 'minerals',
};

/**
 * LogisticsService 클래스
 */
export class LogisticsService extends EventEmitter {
  private static instance: LogisticsService;

  // 진행 중인 작업 상태 추적 (fleetId -> 작업 타입)
  private ongoingOperations: Map<string, 'ALLOCATE' | 'REORGANIZE' | 'RESUPPLY'> = new Map();

  private constructor() {
    super();
    logger.info('[LogisticsService] Initialized');
  }

  public static getInstance(): LogisticsService {
    if (!LogisticsService.instance) {
      LogisticsService.instance = new LogisticsService();
    }
    return LogisticsService.instance;
  }

  /**
   * 할당 실행 (행성 창고 -> 부대 창고)
   */
  public async allocate(
    sessionId: string,
    executorId: string,
    request: LogisticsAllocationRequest,
  ): Promise<LogisticsResult> {
    try {
      // 1. 실행자 확인 및 권한 검증
      const executor = await Gin7Character.findOne({ sessionId, characterId: executorId });
      if (!executor) {
        return { success: false, error: '실행자를 찾을 수 없습니다.' };
      }

      // 2. 진행 중인 작업 확인 (제한 조건: 매뉴얼 2018행)
      if (this.ongoingOperations.has(request.fleetId)) {
        const operation = this.ongoingOperations.get(request.fleetId);
        return {
          success: false,
          error: `해당 부대는 현재 ${operation} 작업 중이므로 할당을 실행할 수 없습니다.`,
        };
      }

      // 3. 권한 확인 - 직책 기반 권한 검증
      const position = executor.currentPosition;
      if (!position || !this.checkAllocationAuthority(position)) {
        return { success: false, error: '할당 권한이 없습니다.' };
      }

      // 4. 행성 창고 재고 확인
      const planetWarehouse = await this.getPlanetWarehouse(sessionId, request.planetId);
      if (!planetWarehouse) {
        return { success: false, error: '행성 창고를 찾을 수 없습니다.' };
      }

      // 5. 재고 검증
      for (const unit of request.units) {
        const available = this.getWarehouseUnitCount(planetWarehouse, unit.unitType);
        if (available < unit.quantity) {
          return {
            success: false,
            error: `${unit.unitType} 재고 부족 (필요: ${unit.quantity}, 가용: ${available})`,
          };
        }
      }

      for (const resource of request.resources) {
        const available = this.getWarehouseResourceCount(planetWarehouse, resource.resourceType);
        if (available < resource.quantity) {
          return {
            success: false,
            error: `${resource.resourceType} 재고 부족 (필요: ${resource.quantity}, 가용: ${available})`,
          };
        }
      }

      // 6. 작업 시작 상태 등록
      this.ongoingOperations.set(request.fleetId, 'ALLOCATE');

      // 7. 실제 할당 수행 (비동기)
      await this.performAllocation(sessionId, request);

      // 8. 작업 완료
      this.ongoingOperations.delete(request.fleetId);

      this.emit('ALLOCATION_COMPLETED', {
        sessionId,
        executorId,
        planetId: request.planetId,
        fleetId: request.fleetId,
        units: request.units,
        resources: request.resources,
      });

      logger.info(`[LogisticsService] Allocation completed: ${request.planetId} -> ${request.fleetId}`);

      return {
        success: true,
        transferredUnits: request.units,
        transferredResources: request.resources,
      };
    } catch (error) {
      logger.error(`[LogisticsService] Allocation error: ${error}`);
      this.ongoingOperations.delete(request.fleetId);
      return { success: false, error: '할당 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 재편성 실행 (부대 <-> 부대 창고)
   */
  public async reorganize(
    sessionId: string,
    commanderId: string,
    request: ReorganizationRequest,
  ): Promise<LogisticsResult> {
    try {
      // 1. 사령관 확인
      const commander = await Gin7Character.findOne({ sessionId, characterId: commanderId });
      if (!commander) {
        return { success: false, error: '사령관을 찾을 수 없습니다.' };
      }

      // 2. 부대 소속 확인 - 사령관이 해당 함대의 지휘관이거나 같은 세력인지 검증
      const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
      if (!fleet) {
        return { success: false, error: '함대를 찾을 수 없습니다.' };
      }

      const affiliationCheck = this.validateFleetAffiliation(commander, fleet);
      if (!affiliationCheck.valid) {
        return { success: false, error: affiliationCheck.error };
      }

      // 3. 진행 중인 작업 확인
      if (this.ongoingOperations.has(request.fleetId)) {
        const operation = this.ongoingOperations.get(request.fleetId);
        return {
          success: false,
          error: `해당 부대는 현재 ${operation} 작업 중이므로 재편성을 실행할 수 없습니다.`,
        };
      }

      // 4. 작업 시작 상태 등록
      this.ongoingOperations.set(request.fleetId, 'REORGANIZE');

      // 5. 승무원 요구량 검증 (매뉴얼 2054행)
      const crewRequirement = await this.calculateCrewRequirement(sessionId, request);
      if (!crewRequirement.valid) {
        this.ongoingOperations.delete(request.fleetId);
        return { success: false, error: crewRequirement.error };
      }

      // 6. 실제 재편성 수행
      await this.performReorganization(sessionId, request);

      // 7. 유닛 합산 처리 (매뉴얼 1945행)
      await this.mergePartialUnits(sessionId, request.fleetId);

      // 8. 작업 완료
      this.ongoingOperations.delete(request.fleetId);

      this.emit('REORGANIZATION_COMPLETED', {
        sessionId,
        commanderId,
        fleetId: request.fleetId,
      });

      logger.info(`[LogisticsService] Reorganization completed for fleet ${request.fleetId}`);

      return { success: true };
    } catch (error) {
      logger.error(`[LogisticsService] Reorganization error: ${error}`);
      this.ongoingOperations.delete(request.fleetId);
      return { success: false, error: '재편성 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 보충 실행 (부대 창고 -> 유닛)
   */
  public async resupply(
    sessionId: string,
    commanderId: string,
    request: ResupplyRequest,
  ): Promise<LogisticsResult> {
    try {
      // 1. 사령관 확인
      const commander = await Gin7Character.findOne({ sessionId, characterId: commanderId });
      if (!commander) {
        return { success: false, error: '사령관을 찾을 수 없습니다.' };
      }

      // 2. 진행 중인 작업 확인
      if (this.ongoingOperations.has(request.fleetId)) {
        const operation = this.ongoingOperations.get(request.fleetId);
        return {
          success: false,
          error: `해당 부대는 현재 ${operation} 작업 중이므로 보충을 실행할 수 없습니다.`,
        };
      }

      // 3. 부대 창고 재고 확인
      const fleetWarehouse = await this.getFleetWarehouse(sessionId, request.fleetId);
      if (!fleetWarehouse) {
        return { success: false, error: '부대 창고를 찾을 수 없습니다.' };
      }

      // 4. 동일 타입 유닛 확인 (매뉴얼 2093행)
      const available = this.getWarehouseUnitCount(fleetWarehouse, request.unitType);
      if (available < request.quantity) {
        return {
          success: false,
          error: `동일 타입 유닛 부족 (필요: ${request.quantity}, 가용: ${available})`,
        };
      }

      // 5. 승무원 자동 보충 확인 (매뉴얼 2096행)
      const crewCheck = await this.checkCrewForResupply(sessionId, request);
      if (!crewCheck.valid) {
        return { success: false, error: crewCheck.error };
      }

      // 6. 작업 시작 상태 등록
      this.ongoingOperations.set(request.fleetId, 'RESUPPLY');

      // 7. 실제 보충 수행
      await this.performResupply(sessionId, request);

      // 8. 유닛 합산 처리
      await this.mergePartialUnits(sessionId, request.fleetId);

      // 9. 작업 완료
      this.ongoingOperations.delete(request.fleetId);

      this.emit('RESUPPLY_COMPLETED', {
        sessionId,
        commanderId,
        fleetId: request.fleetId,
        targetUnitId: request.targetUnitId,
        quantity: request.quantity,
      });

      logger.info(`[LogisticsService] Resupply completed for unit ${request.targetUnitId}`);

      return {
        success: true,
        transferredUnits: [{ unitType: request.unitType, quantity: request.quantity }],
      };
    } catch (error) {
      logger.error(`[LogisticsService] Resupply error: ${error}`);
      this.ongoingOperations.delete(request.fleetId);
      return { success: false, error: '보충 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 부대 작업 상태 조회
   */
  public getFleetOperationStatus(fleetId: string): string | null {
    return this.ongoingOperations.get(fleetId) || null;
  }

  /**
   * 작업 취소 (관리자/강제)
   */
  public cancelOperation(fleetId: string): boolean {
    if (this.ongoingOperations.has(fleetId)) {
      this.ongoingOperations.delete(fleetId);
      logger.info(`[LogisticsService] Operation cancelled for fleet ${fleetId}`);
      return true;
    }
    return false;
  }

  // ==================== Private Helper Methods ====================

  /**
   * 부대 소속 검증 - 사령관이 해당 함대를 지휘할 권한이 있는지 확인
   * @param commander 사령관 캐릭터
   * @param fleet 대상 함대
   * @returns 검증 결과
   */
  private validateFleetAffiliation(
    commander: IGin7Character,
    fleet: IFleet,
  ): { valid: boolean; error?: string } {
    // 1. 함대 지휘관인지 확인
    if (fleet.commanderId === commander.characterId) {
      return { valid: true };
    }

    // 2. 같은 세력인지 확인
    const commanderFaction = commander.faction || commander.factionId;
    if (commanderFaction !== fleet.factionId) {
      return { valid: false, error: '다른 세력의 함대를 조작할 수 없습니다.' };
    }

    // 3. 상위 권한 확인 (통합작전본부 등)
    const position = commander.currentPosition;
    if (position && ALLOCATION_AUTHORITY[position]) {
      return { valid: true };
    }

    return { valid: false, error: '해당 함대에 대한 지휘 권한이 없습니다.' };
  }

  /**
   * 할당 권한 확인 - 부대 타입별 권한 검증
   * @param position 직책 ID
   * @param fleetType 부대 타입
   * @returns 권한 여부
   */
  private checkAllocationAuthority(position: string, fleetType?: string): boolean {
    const authority = ALLOCATION_AUTHORITY[position];
    if (!authority) return false;

    // 부대 타입에 따른 권한 확인
    switch (fleetType) {
      case FleetType.FLEET:
        return authority.fleet;
      case FleetType.PATROL:
        return authority.patrol;
      case FleetType.TRANSPORT:
        return authority.transport;
      case FleetType.GROUND:
      case FleetType.GARRISON:
        return authority.ground;
      default:
        // 기본적으로 fleet 권한 사용
        return authority.fleet;
    }
  }

  /**
   * 행성 창고 조회 - Warehouse 모델과 연동
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @returns 창고 문서 또는 null
   */
  private async getPlanetWarehouse(
    sessionId: string,
    planetId: string,
  ): Promise<IWarehouse | null> {
    return Warehouse.findOne({
      sessionId,
      ownerId: planetId,
      ownerType: 'PLANET',
    });
  }

  /**
   * 부대 창고 조회 - Warehouse 모델과 연동
   * @param sessionId 세션 ID
   * @param fleetId 함대 ID
   * @returns 창고 문서 또는 null
   */
  private async getFleetWarehouse(
    sessionId: string,
    fleetId: string,
  ): Promise<IWarehouse | null> {
    return Warehouse.findOne({
      sessionId,
      ownerId: fleetId,
      ownerType: 'FLEET',
    });
  }

  /**
   * 창고 유닛 수량 조회
   * @param warehouse 창고 문서
   * @param unitType 유닛 타입
   * @returns 가용 수량
   */
  private getWarehouseUnitCount(warehouse: IWarehouse | null, unitType: UnitType): number {
    if (!warehouse) return 0;

    // 유닛 타입을 shipParts 자원으로 환산 (유닛은 shipParts로 저장)
    // 또는 warehouse.data에서 units 정보를 조회
    const unitsData = warehouse.data?.units as Record<string, number> | undefined;
    if (unitsData && unitsData[unitType] !== undefined) {
      return unitsData[unitType];
    }

    // 대체: shipParts 기반으로 유닛 생산 가능량 계산
    const shipPartsItem = warehouse.items.find((i) => i.type === 'shipParts');
    if (!shipPartsItem) return 0;

    const available = shipPartsItem.amount - shipPartsItem.reserved;
    const shipClass = UNIT_TYPE_TO_SHIP_CLASS[unitType];
    if (shipClass && SHIP_SPECS[shipClass]) {
      const partsPerUnit = SHIP_SPECS[shipClass].buildCost.shipParts;
      return Math.floor(available / partsPerUnit);
    }

    return 0;
  }

  /**
   * 창고 자원 수량 조회
   * @param warehouse 창고 문서
   * @param resourceType 자원 타입
   * @returns 가용 수량
   */
  private getWarehouseResourceCount(
    warehouse: IWarehouse | null,
    resourceType: ResourceType,
  ): number {
    if (!warehouse) return 0;

    const warehouseResType = RESOURCE_TYPE_MAP[resourceType];
    const item = warehouse.items.find((i) => i.type === warehouseResType);
    if (!item) return 0;

    return item.amount - item.reserved;
  }

  /**
   * 승무원 요구량 계산 (매뉴얼 2054행)
   * 재편성 시 유닛 추가에 필요한 승무원 수를 계산하고 검증
   * @param sessionId 세션 ID
   * @param request 재편성 요청
   * @returns 검증 결과
   */
  private async calculateCrewRequirement(
    sessionId: string,
    request: ReorganizationRequest,
  ): Promise<{ valid: boolean; error?: string }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
    if (!fleet) {
      return { valid: false, error: '함대를 찾을 수 없습니다.' };
    }

    // 부대에서 창고로 이동하는 유닛의 승무원은 반환됨
    let crewReleased = 0;
    for (const unit of request.fromFleet) {
      crewReleased += (CREW_REQUIREMENTS[unit.unitType] || 100) * unit.quantity;
    }

    // 창고에서 부대로 이동하는 유닛에 필요한 승무원
    let crewRequired = 0;
    for (const unit of request.toFleet) {
      crewRequired += (CREW_REQUIREMENTS[unit.unitType] || 100) * unit.quantity;
    }

    // 현재 함대의 가용 승무원 풀
    const crewPool = fleet.crewPool || 0;
    const netCrewNeeded = crewRequired - crewReleased;

    if (netCrewNeeded > crewPool) {
      return {
        valid: false,
        error: `승무원 부족: 필요 ${netCrewNeeded}명, 가용 ${crewPool}명`,
      };
    }

    return { valid: true };
  }

  /**
   * 보충용 승무원 확인 (매뉴얼 2096행)
   * 유닛 보충에 필요한 승무원이 자동으로 할당되는지 확인
   * @param sessionId 세션 ID
   * @param request 보충 요청
   * @returns 검증 결과
   */
  private async checkCrewForResupply(
    sessionId: string,
    request: ResupplyRequest,
  ): Promise<{ valid: boolean; error?: string }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
    if (!fleet) {
      return { valid: false, error: '함대를 찾을 수 없습니다.' };
    }

    // 보충에 필요한 승무원 계산
    const crewPerUnit = CREW_REQUIREMENTS[request.unitType] || 100;
    const crewNeeded = crewPerUnit * request.quantity;

    // 함대 승무원 풀 확인
    const crewPool = fleet.crewPool || 0;
    if (crewNeeded > crewPool) {
      return {
        valid: false,
        error: `보충용 승무원 부족: 필요 ${crewNeeded}명, 가용 ${crewPool}명`,
      };
    }

    return { valid: true };
  }

  /**
   * 할당 실제 수행 - 행성 창고에서 부대 창고로 자원 이동
   * Warehouse 모델의 atomicTransfer 사용
   * @param sessionId 세션 ID
   * @param request 할당 요청
   */
  private async performAllocation(
    sessionId: string,
    request: LogisticsAllocationRequest,
  ): Promise<void> {
    const planetWarehouse = await this.getPlanetWarehouse(sessionId, request.planetId);
    const fleetWarehouse = await this.getFleetWarehouse(sessionId, request.fleetId);

    if (!planetWarehouse || !fleetWarehouse) {
      throw new Error('창고를 찾을 수 없습니다.');
    }

    // 자원 이동
    if (request.resources.length > 0) {
      const items = request.resources.map((r) => ({
        type: RESOURCE_TYPE_MAP[r.resourceType],
        amount: r.quantity,
      }));

      const result = await Warehouse.atomicTransfer(
        sessionId,
        planetWarehouse.warehouseId,
        fleetWarehouse.warehouseId,
        items,
        'LOGISTICS_ALLOCATION',
      );

      if (!result.success) {
        throw new Error(result.error || '자원 이동 실패');
      }
    }

    // 유닛 이동 (data.units에서 관리)
    if (request.units.length > 0) {
      await this.transferUnits(
        sessionId,
        planetWarehouse,
        fleetWarehouse,
        request.units,
      );
    }

    logger.info(
      `[LogisticsService] Allocation performed: ${request.planetId} -> ${request.fleetId}`,
    );
  }

  /**
   * 유닛 이동 헬퍼 - 창고 간 유닛 데이터 이동
   */
  private async transferUnits(
    sessionId: string,
    sourceWarehouse: IWarehouse,
    targetWarehouse: IWarehouse,
    units: Array<{ unitType: UnitType; quantity: number }>,
  ): Promise<void> {
    // 소스 창고의 유닛 데이터
    const sourceUnits = (sourceWarehouse.data?.units || {}) as Record<string, number>;
    const targetUnits = (targetWarehouse.data?.units || {}) as Record<string, number>;

    for (const unit of units) {
      const available = sourceUnits[unit.unitType] || 0;
      if (available < unit.quantity) {
        throw new Error(`${unit.unitType} 유닛 부족: 필요 ${unit.quantity}, 가용 ${available}`);
      }

      sourceUnits[unit.unitType] = available - unit.quantity;
      targetUnits[unit.unitType] = (targetUnits[unit.unitType] || 0) + unit.quantity;
    }

    // 업데이트
    sourceWarehouse.data = { ...sourceWarehouse.data, units: sourceUnits };
    targetWarehouse.data = { ...targetWarehouse.data, units: targetUnits };

    await Promise.all([sourceWarehouse.save(), targetWarehouse.save()]);
  }

  /**
   * 재편성 실제 수행 - 부대 <-> 부대 창고 유닛 교환
   * @param sessionId 세션 ID
   * @param request 재편성 요청
   */
  private async performReorganization(
    sessionId: string,
    request: ReorganizationRequest,
  ): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
    const fleetWarehouse = await this.getFleetWarehouse(sessionId, request.fleetId);

    if (!fleet || !fleetWarehouse) {
      throw new Error('함대 또는 창고를 찾을 수 없습니다.');
    }

    // 부대 -> 창고 이동
    for (const unit of request.fromFleet) {
      const fleetUnit = fleet.units.find(
        (u) => UNIT_TYPE_TO_SHIP_CLASS[unit.unitType] === u.shipClass,
      );
      if (fleetUnit && fleetUnit.count >= unit.quantity) {
        fleetUnit.count -= unit.quantity;

        // 창고에 유닛 추가
        const warehouseUnits = (fleetWarehouse.data?.units || {}) as Record<string, number>;
        warehouseUnits[unit.unitType] = (warehouseUnits[unit.unitType] || 0) + unit.quantity;
        fleetWarehouse.data = { ...fleetWarehouse.data, units: warehouseUnits };
      }
    }

    // 창고 -> 부대 이동
    const warehouseUnits = (fleetWarehouse.data?.units || {}) as Record<string, number>;
    for (const unit of request.toFleet) {
      const available = warehouseUnits[unit.unitType] || 0;
      if (available >= unit.quantity) {
        warehouseUnits[unit.unitType] = available - unit.quantity;

        // 함대에 유닛 추가
        const shipClass = UNIT_TYPE_TO_SHIP_CLASS[unit.unitType];
        if (shipClass) {
          let fleetUnit = fleet.units.find((u) => u.shipClass === shipClass);
          if (!fleetUnit) {
            fleetUnit = {
              unitId: `UNIT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              shipClass,
              count: 0,
              hp: 100,
              morale: 100,
              fuel: 100,
              maxFuel: 100,
              ammo: 100,
              maxAmmo: 100,
              crewCount: 0,
              maxCrew: CREW_REQUIREMENTS[unit.unitType] * unit.quantity,
              veterancy: 0,
              destroyed: 0,
              damaged: 0,
            };
            fleet.units.push(fleetUnit);
          }
          fleetUnit.count += unit.quantity;
        }
      }
    }

    fleetWarehouse.data = { ...fleetWarehouse.data, units: warehouseUnits };

    await Promise.all([fleet.save(), fleetWarehouse.save()]);

    logger.info(`[LogisticsService] Reorganization performed for fleet ${request.fleetId}`);
  }

  /**
   * 보충 실제 수행 - 부대 창고에서 유닛으로 함선 보충
   * @param sessionId 세션 ID
   * @param request 보충 요청
   */
  private async performResupply(sessionId: string, request: ResupplyRequest): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
    const fleetWarehouse = await this.getFleetWarehouse(sessionId, request.fleetId);

    if (!fleet || !fleetWarehouse) {
      throw new Error('함대 또는 창고를 찾을 수 없습니다.');
    }

    // 대상 유닛 찾기
    const targetUnit = fleet.units.find((u) => u.unitId === request.targetUnitId);
    if (!targetUnit) {
      throw new Error('대상 유닛을 찾을 수 없습니다.');
    }

    // 창고에서 유닛 차감
    const warehouseUnits = (fleetWarehouse.data?.units || {}) as Record<string, number>;
    const available = warehouseUnits[request.unitType] || 0;

    if (available < request.quantity) {
      throw new Error(`보충용 ${request.unitType} 부족: 필요 ${request.quantity}, 가용 ${available}`);
    }

    warehouseUnits[request.unitType] = available - request.quantity;
    fleetWarehouse.data = { ...fleetWarehouse.data, units: warehouseUnits };

    // 유닛에 함선 추가
    targetUnit.count += request.quantity;
    if (targetUnit.currentShipCount !== undefined) {
      targetUnit.currentShipCount += request.quantity;
    }

    // 승무원 풀에서 차감
    const crewNeeded = (CREW_REQUIREMENTS[request.unitType] || 100) * request.quantity;
    fleet.crewPool = Math.max(0, (fleet.crewPool || 0) - crewNeeded);

    await Promise.all([fleet.save(), fleetWarehouse.save()]);

    logger.info(
      `[LogisticsService] Resupply performed: ${request.quantity} ${request.unitType} to ${request.targetUnitId}`,
    );
  }

  /**
   * 단수(端數) 유닛 합산 처리 (매뉴얼 1945행)
   * 같은 타입의 부분 유닛들을 합산하여 정수 유닛으로 변환
   * @param sessionId 세션 ID
   * @param fleetId 함대 ID
   */
  private async mergePartialUnits(sessionId: string, fleetId: string): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return;

    // 동일 함급의 유닛들을 그룹화
    const unitsByClass = new Map<ShipClass, typeof fleet.units>();
    for (const unit of fleet.units) {
      const existing = unitsByClass.get(unit.shipClass) || [];
      existing.push(unit);
      unitsByClass.set(unit.shipClass, existing);
    }

    // 각 함급별로 합산
    const mergedUnits: typeof fleet.units = [];
    for (const [shipClass, units] of unitsByClass) {
      if (units.length <= 1) {
        mergedUnits.push(...units);
        continue;
      }

      // 합산된 유닛 생성
      const merged = {
        ...units[0],
        count: units.reduce((sum, u) => sum + u.count, 0),
        hp: Math.round(
          units.reduce((sum, u) => sum + u.hp * u.count, 0) /
            units.reduce((sum, u) => sum + u.count, 0),
        ),
        morale: Math.round(
          units.reduce((sum, u) => sum + u.morale * u.count, 0) /
            units.reduce((sum, u) => sum + u.count, 0),
        ),
        fuel: units.reduce((sum, u) => sum + u.fuel, 0),
        ammo: units.reduce((sum, u) => sum + u.ammo, 0),
        crewCount: units.reduce((sum, u) => sum + u.crewCount, 0),
        veterancy: Math.round(
          units.reduce((sum, u) => sum + u.veterancy * u.count, 0) /
            units.reduce((sum, u) => sum + u.count, 0),
        ),
        destroyed: units.reduce((sum, u) => sum + u.destroyed, 0),
        damaged: units.reduce((sum, u) => sum + u.damaged, 0),
      };

      mergedUnits.push(merged);
      logger.debug(
        `[LogisticsService] Merged ${units.length} ${shipClass} units into one with count ${merged.count}`,
      );
    }

    fleet.units = mergedUnits;
    await fleet.save();

    logger.debug(`[LogisticsService] Merging partial units completed for fleet ${fleetId}`);
  }

  // ==================== Public Utility Methods ====================

  /**
   * 함대 보급 실행 (LogisticsCommandService에서 사용)
   * @param sessionId 세션 ID
   * @param fleetId 함대 ID
   * @param planetId 행성 ID
   * @returns 보급된 자원 정보
   */
  public async resupplyFleet(
    sessionId: string,
    fleetId: string,
    planetId: string,
  ): Promise<{ success: boolean; suppliedResources?: Record<string, number>; error?: string }> {
    try {
      const planetWarehouse = await this.getPlanetWarehouse(sessionId, planetId);
      const fleetWarehouse = await this.getFleetWarehouse(sessionId, fleetId);
      const fleet = await Fleet.findOne({ sessionId, fleetId });

      if (!planetWarehouse || !fleetWarehouse || !fleet) {
        return { success: false, error: '창고 또는 함대를 찾을 수 없습니다.' };
      }

      const supplied: Record<string, number> = {};
      const transfers: Array<{ type: WarehouseResourceType; amount: number }> = [];

      // 연료 보급
      const fuelNeeded = fleet.units.reduce((sum, u) => sum + (u.maxFuel - u.fuel) * u.count, 0);
      const fuelAvailable = this.getWarehouseResourceCount(planetWarehouse, ResourceType.FUEL);
      const fuelToTransfer = Math.min(fuelNeeded, fuelAvailable);
      if (fuelToTransfer > 0) {
        transfers.push({ type: 'fuel', amount: fuelToTransfer });
        supplied['fuel'] = fuelToTransfer;
      }

      // 탄약 보급
      const ammoNeeded = fleet.units.reduce((sum, u) => sum + (u.maxAmmo - u.ammo) * u.count, 0);
      const ammoAvailable = this.getWarehouseResourceCount(planetWarehouse, ResourceType.AMMO);
      const ammoToTransfer = Math.min(ammoNeeded, ammoAvailable);
      if (ammoToTransfer > 0) {
        transfers.push({ type: 'ammo', amount: ammoToTransfer });
        supplied['ammo'] = ammoToTransfer;
      }

      // 실제 이동
      if (transfers.length > 0) {
        const result = await Warehouse.atomicTransfer(
          sessionId,
          planetWarehouse.warehouseId,
          fleetWarehouse.warehouseId,
          transfers,
          'FLEET_RESUPPLY',
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        // 함대 유닛에 자원 반영
        for (const unit of fleet.units) {
          if (supplied['fuel']) {
            unit.fuel = unit.maxFuel;
          }
          if (supplied['ammo']) {
            unit.ammo = unit.maxAmmo;
          }
        }
        await fleet.save();
      }

      return { success: true, suppliedResources: supplied };
    } catch (error) {
      logger.error(`[LogisticsService] resupplyFleet error: ${error}`);
      return { success: false, error: '보급 처리 중 오류 발생' };
    }
  }

  /**
   * 유닛 재편성 (LogisticsCommandService에서 사용)
   */
  public async reorganizeUnits(
    sessionId: string,
    fleetId: string,
    options: { targetFleetId?: string; transfers?: Array<{ unitId: string; quantity: number }> },
  ): Promise<{ success: boolean; error?: string }> {
    // 간단한 재편성 - 동일 함대 내 유닛 조정
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, error: '함대를 찾을 수 없습니다.' };
    }

    // 유닛 합산 처리
    await this.mergePartialUnits(sessionId, fleetId);

    return { success: true };
  }

  /**
   * 자원 할당 (LogisticsCommandService에서 사용)
   */
  public async allocateResources(
    sessionId: string,
    planetId: string,
    fleetId: string,
    resources: Array<{ type: string; quantity: number }>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const planetWarehouse = await this.getPlanetWarehouse(sessionId, planetId);
      const fleetWarehouse = await this.getFleetWarehouse(sessionId, fleetId);

      if (!planetWarehouse || !fleetWarehouse) {
        return { success: false, error: '창고를 찾을 수 없습니다.' };
      }

      const transfers = resources.map((r) => ({
        type: r.type as WarehouseResourceType,
        amount: r.quantity,
      }));

      const result = await Warehouse.atomicTransfer(
        sessionId,
        planetWarehouse.warehouseId,
        fleetWarehouse.warehouseId,
        transfers,
        'RESOURCE_ALLOCATION',
      );

      return result;
    } catch (error) {
      logger.error(`[LogisticsService] allocateResources error: ${error}`);
      return { success: false, error: '자원 할당 중 오류 발생' };
    }
  }

  /**
   * 수송 계획 생성 (LogisticsCommandService에서 사용)
   */
  public async createTransportPlan(options: {
    sessionId: string;
    sourcePlanetId: string;
    targetPlanetId: string;
    resources: Array<{ type: string; quantity: number }>;
    priority: number;
    createdBy: string;
  }): Promise<string> {
    const planId = `TRANSPORT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // 수송 계획은 별도 컬렉션에 저장하거나 이벤트로 처리
    this.emit('TRANSPORT_PLAN_CREATED', {
      planId,
      ...options,
    });

    logger.info(`[LogisticsService] Transport plan created: ${planId}`);
    return planId;
  }

  /**
   * 수송 계획 취소 (LogisticsCommandService에서 사용)
   */
  public async cancelTransportPlan(sessionId: string, planId: string): Promise<void> {
    this.emit('TRANSPORT_PLAN_CANCELLED', { sessionId, planId });
    logger.info(`[LogisticsService] Transport plan cancelled: ${planId}`);
  }
}

export const logisticsService = LogisticsService.getInstance();
export default LogisticsService;





