/**
 * LogisticsCommandService - 병참 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 병참 커맨드:
 * - FULL_REPAIR (완전수리): 전 유닛 수리
 * - FULL_SUPPLY (완전보급): 물자 보급
 * - REORGANIZE (재편성): 유닛 재편성
 * - REINFORCE (보충): 손실 함정 보충
 * - CARGO_TRANSFER (반출입): 수송 패키지 반출입
 * - ALLOCATE (할당): 창고 → 부대 창고 할당
 * - TRANSPORT_PLAN (수송계획): 수송 패키지 작성
 * - TRANSPORT_CANCEL (수송중지): 수송 계획 취소
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { LogisticsService, logisticsService } from './LogisticsService';
import { WarehouseService } from './WarehouseService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface LogisticsRequest {
  sessionId: string;
  characterId: string;     // 실행자
  fleetId?: string;        // 대상 함대
  planetId?: string;       // 대상 행성
  commandId: string;
  params?: Record<string, any>;
}

export interface LogisticsCommandResult {
  success: boolean;
  commandId: string;
  details?: string;
  cpCost: number;
  error?: string;
}

// ============================================================
// LogisticsCommandService Class
// ============================================================

export class LogisticsCommandService extends EventEmitter {
  private static instance: LogisticsCommandService;

  private constructor() {
    super();
    logger.info('[LogisticsCommandService] Initialized');
  }

  public static getInstance(): LogisticsCommandService {
    if (!LogisticsCommandService.instance) {
      LogisticsCommandService.instance = new LogisticsCommandService();
    }
    return LogisticsCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 병참 커맨드 라우터
   */
  public async executeLogisticsCommand(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'FULL_REPAIR':
        return this.executeFullRepair(request);
      case 'FULL_SUPPLY':
        return this.executeFullSupply(request);
      case 'REORGANIZE':
        return this.executeReorganize(request);
      case 'REINFORCE':
        return this.executeReinforce(request);
      case 'CARGO_TRANSFER':
        return this.executeCargoTransfer(request);
      case 'ALLOCATE':
        return this.executeAllocate(request);
      case 'TRANSPORT_PLAN':
        return this.executeTransportPlan(request);
      case 'TRANSPORT_CANCEL':
        return this.executeTransportCancel(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 병참 커맨드입니다.');
    }
  }

  // ============================================================
  // 수리/보급
  // ============================================================

  /**
   * 완전수리 - 전 유닛 수리
   */
  private async executeFullRepair(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, planetId } = request;
    const cpCost = this.getCommandCost('FULL_REPAIR');

    if (!fleetId) {
      return this.errorResult('FULL_REPAIR', cpCost, '함대 ID가 필요합니다.');
    }

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        return this.errorResult('FULL_REPAIR', cpCost, '함대를 찾을 수 없습니다.');
      }

      // 행성 도킹 상태 확인
      if (!fleet.dockedAt) {
        return this.errorResult('FULL_REPAIR', cpCost, '행성에 도킹된 상태에서만 수리 가능합니다.');
      }

      // 수리 비용 계산 (유닛별 손상도 기반)
      let totalRepairCost = 0;
      let repairedUnits = 0;

      for (const unit of fleet.units || []) {
        if (unit.currentHp < unit.maxHp) {
          const damage = unit.maxHp - unit.currentHp;
          const repairCost = Math.floor(damage * 0.5); // 데미지의 50%
          totalRepairCost += repairCost;
          
          unit.currentHp = unit.maxHp;
          repairedUnits++;
        }
      }

      // 자원 차감 (행성 창고에서)
      if (planetId) {
        await WarehouseService.deductResources(sessionId, planetId, [
          { type: 'credits', amount: totalRepairCost },
        ]);
      }

      await fleet.save();

      this.emit('logistics:repaired', {
        sessionId,
        characterId,
        fleetId,
        repairedUnits,
        totalCost: totalRepairCost,
      });

      return {
        success: true,
        commandId: 'FULL_REPAIR',
        details: `${repairedUnits}개 유닛 수리 완료. 비용: ${totalRepairCost} 크레딧`,
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Full repair error:', error);
      return this.errorResult('FULL_REPAIR', cpCost, '수리 처리 중 오류 발생');
    }
  }

  /**
   * 완전보급 - 물자 보급
   */
  private async executeFullSupply(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, planetId } = request;
    const cpCost = this.getCommandCost('FULL_SUPPLY');

    if (!fleetId) {
      return this.errorResult('FULL_SUPPLY', cpCost, '함대 ID가 필요합니다.');
    }

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        return this.errorResult('FULL_SUPPLY', cpCost, '함대를 찾을 수 없습니다.');
      }

      if (!fleet.dockedAt) {
        return this.errorResult('FULL_SUPPLY', cpCost, '행성에 도킹된 상태에서만 보급 가능합니다.');
      }

      // 보급 실행 (LogisticsService 사용)
      const result = await logisticsService.resupplyFleet(sessionId, fleetId, fleet.dockedAt);

      this.emit('logistics:supplied', {
        sessionId,
        characterId,
        fleetId,
        supplies: result.suppliedResources,
      });

      return {
        success: true,
        commandId: 'FULL_SUPPLY',
        details: '보급 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Full supply error:', error);
      return this.errorResult('FULL_SUPPLY', cpCost, '보급 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 재편성/보충
  // ============================================================

  /**
   * 재편성 - 유닛 재편성
   */
  private async executeReorganize(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, params } = request;
    const cpCost = this.getCommandCost('REORGANIZE');

    if (!fleetId) {
      return this.errorResult('REORGANIZE', cpCost, '함대 ID가 필요합니다.');
    }

    const targetFleetId = params?.targetFleetId;
    const transfers = params?.transfers; // { unitId, quantity }[]

    try {
      // LogisticsService의 reorganize 호출
      const result = await logisticsService.reorganizeUnits(sessionId, fleetId, {
        targetFleetId,
        transfers,
      });

      this.emit('logistics:reorganized', {
        sessionId,
        characterId,
        sourceFleetId: fleetId,
        targetFleetId,
        transfers,
      });

      return {
        success: true,
        commandId: 'REORGANIZE',
        details: '재편성 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Reorganize error:', error);
      return this.errorResult('REORGANIZE', cpCost, '재편성 처리 중 오류 발생');
    }
  }

  /**
   * 보충 - 손실 함정 보충
   */
  private async executeReinforce(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, planetId, params } = request;
    const cpCost = this.getCommandCost('REINFORCE');

    if (!fleetId) {
      return this.errorResult('REINFORCE', cpCost, '함대 ID가 필요합니다.');
    }

    const unitId = params?.unitId;
    const shipClass = params?.shipClass;

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        return this.errorResult('REINFORCE', cpCost, '함대를 찾을 수 없습니다.');
      }

      if (!fleet.dockedAt) {
        return this.errorResult('REINFORCE', cpCost, '행성에 도킹된 상태에서만 보충 가능합니다.');
      }

      // 유닛 찾기
      const unit = fleet.units?.find(u => u.unitId === unitId);
      if (!unit) {
        return this.errorResult('REINFORCE', cpCost, '유닛을 찾을 수 없습니다.');
      }

      // 함급이 일치하는지 확인
      if (shipClass && unit.shipClass !== shipClass) {
        return this.errorResult('REINFORCE', cpCost, '함급이 일치하지 않습니다.');
      }

      // 행성 창고에서 예비함 확인 및 차감
      const neededShips = unit.maxShipCount - unit.currentShipCount;
      if (neededShips <= 0) {
        return this.errorResult('REINFORCE', cpCost, '이미 최대 함정 수입니다.');
      }

      // 보충 실행
      const transferResult = await WarehouseService.transferShips(
        sessionId,
        fleet.dockedAt || '',
        fleetId,
        [{ type: unit.shipClass, count: neededShips }]
      );

      if (transferResult.transferred > 0) {
        unit.currentShipCount += transferResult.transferred;
        await fleet.save();
      }
      
      const reinforced = transferResult.transferred;

      this.emit('logistics:reinforced', {
        sessionId,
        characterId,
        fleetId,
        unitId,
        shipClass: unit.shipClass,
        quantity: reinforced,
      });

      return {
        success: true,
        commandId: 'REINFORCE',
        details: `${reinforced}척 보충 완료`,
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Reinforce error:', error);
      return this.errorResult('REINFORCE', cpCost, '보충 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 수송
  // ============================================================

  /**
   * 반출입 - 수송 패키지 반출입
   */
  private async executeCargoTransfer(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, planetId, params } = request;
    const cpCost = this.getCommandCost('CARGO_TRANSFER');

    const direction = params?.direction || 'load'; // 'load' | 'unload'
    const resources = params?.resources; // { type: string, quantity: number }[]

    if (!fleetId || !planetId) {
      return this.errorResult('CARGO_TRANSFER', cpCost, '함대 ID와 행성 ID가 필요합니다.');
    }

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet || fleet.dockedAt !== planetId) {
        return this.errorResult('CARGO_TRANSFER', cpCost, '해당 행성에 도킹되어 있지 않습니다.');
      }

      if (direction === 'load') {
        // 행성 → 함대
        await WarehouseService.loadCargo(sessionId, planetId, fleetId, resources);
      } else {
        // 함대 → 행성
        await WarehouseService.unloadCargo(sessionId, fleetId, planetId, resources);
      }

      this.emit('logistics:cargoTransferred', {
        sessionId,
        characterId,
        fleetId,
        planetId,
        direction,
        resources,
      });

      return {
        success: true,
        commandId: 'CARGO_TRANSFER',
        details: `화물 ${direction === 'load' ? '적재' : '하역'} 완료`,
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Cargo transfer error:', error);
      return this.errorResult('CARGO_TRANSFER', cpCost, '반출입 처리 중 오류 발생');
    }
  }

  /**
   * 할당 - 창고 → 부대 창고 할당
   */
  private async executeAllocate(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, fleetId, planetId, params } = request;
    const cpCost = this.getCommandCost('ALLOCATE');

    const resources = params?.resources;

    if (!fleetId || !planetId) {
      return this.errorResult('ALLOCATE', cpCost, '함대 ID와 행성 ID가 필요합니다.');
    }

    try {
      const result = await logisticsService.allocateResources(sessionId, planetId, fleetId, resources);

      this.emit('logistics:allocated', {
        sessionId,
        characterId,
        sourceId: planetId,
        targetId: fleetId,
        resources,
      });

      return {
        success: true,
        commandId: 'ALLOCATE',
        details: '자원 할당 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Allocate error:', error);
      return this.errorResult('ALLOCATE', cpCost, '할당 처리 중 오류 발생');
    }
  }

  /**
   * 수송계획 - 수송 패키지 작성
   */
  private async executeTransportPlan(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('TRANSPORT_PLAN');

    const { sourcePlanetId, targetPlanetId, resources, priority } = params || {};

    if (!sourcePlanetId || !targetPlanetId) {
      return this.errorResult('TRANSPORT_PLAN', cpCost, '출발지와 도착지가 필요합니다.');
    }

    try {
      const planId = await logisticsService.createTransportPlan({
        sessionId,
        sourcePlanetId,
        targetPlanetId,
        resources,
        priority,
        createdBy: characterId,
      });

      this.emit('logistics:transportPlanned', {
        sessionId,
        characterId,
        planId,
        sourcePlanetId,
        targetPlanetId,
        resources,
      });

      return {
        success: true,
        commandId: 'TRANSPORT_PLAN',
        details: `수송 계획 작성 완료. 계획 ID: ${planId}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Transport plan error:', error);
      return this.errorResult('TRANSPORT_PLAN', cpCost, '수송계획 처리 중 오류 발생');
    }
  }

  /**
   * 수송중지 - 수송 계획 취소
   */
  private async executeTransportCancel(request: LogisticsRequest): Promise<LogisticsCommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('TRANSPORT_CANCEL');

    const planId = params?.planId;
    if (!planId) {
      return this.errorResult('TRANSPORT_CANCEL', cpCost, '계획 ID가 필요합니다.');
    }

    try {
      await logisticsService.cancelTransportPlan(sessionId, planId);

      this.emit('logistics:transportCancelled', {
        sessionId,
        characterId,
        planId,
      });

      return {
        success: true,
        commandId: 'TRANSPORT_CANCEL',
        details: '수송 계획 취소 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[LogisticsCommandService] Transport cancel error:', error);
      return this.errorResult('TRANSPORT_CANCEL', cpCost, '수송중지 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 160;
  }

  private errorResult(commandId: string, cpCost: number, error: string): LogisticsCommandResult {
    return {
      success: false,
      commandId,
      cpCost,
      error,
    };
  }
}

export const logisticsCommandService = LogisticsCommandService.getInstance();
export default LogisticsCommandService;





