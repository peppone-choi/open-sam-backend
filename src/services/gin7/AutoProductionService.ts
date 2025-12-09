/**
 * AutoProductionService - 자동 생산 시스템 서비스
 * 매뉴얼 1906~1925행 기반
 *
 * 주요 기능:
 * - 행성별 함선/승조원/육전대 자동 생산
 * - 생산 진행도 관리
 * - 완료 시 행성 창고로 적재
 * - 점령 시 생산 설정 초기화
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import {
  AutoProductionItem,
  getAutoProductionDef,
  getAutoProductionByFaction,
  ShipProductionItem,
  CrewProductionItem,
  GroundProductionItem,
} from '../../constants/gin7/auto_production_definitions';

/**
 * 생산 진행 상태 인터페이스
 */
export interface ProductionProgress {
  itemId: string;
  itemType: 'SHIP' | 'CREW' | 'GROUND';
  progress: number; // 0.0 ~ 1.0 (1.0 = 1유닛 완료)
  accumulated: number; // 누적 완료 유닛 수
}

/**
 * 생산 완료 이벤트 페이로드
 */
export interface ProductionCompletePayload {
  sessionId: string;
  planetId: string;
  itemId: string;
  itemType: 'SHIP' | 'CREW' | 'GROUND';
  quantity: number;
}

/**
 * AutoProductionService 클래스
 */
export class AutoProductionService extends EventEmitter {
  private static instance: AutoProductionService;

  // 세션별 생산 진행 상태 관리
  // sessionId -> (planetId -> (itemId -> ProductionProgress))
  private productionState: Map<string, Map<string, Map<string, ProductionProgress>>> = new Map();

  private constructor() {
    super();
    logger.info('[AutoProductionService] Initialized');
  }

  public static getInstance(): AutoProductionService {
    if (!AutoProductionService.instance) {
      AutoProductionService.instance = new AutoProductionService();
    }
    return AutoProductionService.instance;
  }

  /**
   * 세션 초기화
   */
  public initializeSession(sessionId: string): void {
    this.productionState.set(sessionId, new Map());
    logger.info(`[AutoProductionService] Session ${sessionId} initialized`);
  }

  /**
   * 세션 정리
   */
  public cleanupSession(sessionId: string): void {
    this.productionState.delete(sessionId);
    logger.info(`[AutoProductionService] Session ${sessionId} cleaned up`);
  }

  /**
   * 행성 자동 생산 초기화
   */
  public initializePlanetProduction(sessionId: string, planetId: string): void {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) {
      this.initializeSession(sessionId);
    }

    const def = getAutoProductionDef(planetId);
    if (!def) {
      logger.warn(`[AutoProductionService] No production definition for planet ${planetId}`);
      return;
    }

    const planetProgress = new Map<string, ProductionProgress>();

    // 함선 생산 초기화
    for (const ship of def.shipUnits) {
      planetProgress.set(`SHIP_${ship.shipTypeId}`, {
        itemId: ship.shipTypeId,
        itemType: 'SHIP',
        progress: 0,
        accumulated: 0,
      });
    }

    // 승조원 생산 초기화
    for (const crew of def.crewUnits) {
      planetProgress.set(`CREW_${crew.crewTypeId}`, {
        itemId: crew.crewTypeId,
        itemType: 'CREW',
        progress: 0,
        accumulated: 0,
      });
    }

    // 육전대 생산 초기화
    for (const ground of def.groundUnits) {
      planetProgress.set(`GROUND_${ground.unitTypeId}`, {
        itemId: ground.unitTypeId,
        itemType: 'GROUND',
        progress: 0,
        accumulated: 0,
      });
    }

    this.productionState.get(sessionId)!.set(planetId, planetProgress);
    logger.info(
      `[AutoProductionService] Planet ${planetId} production initialized with ${planetProgress.size} items`,
    );
  }

  /**
   * 일일 생산 처리 (게임 내 1일 경과 시 호출)
   */
  public processDailyProduction(sessionId: string): ProductionCompletePayload[] {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) return [];

    const completedItems: ProductionCompletePayload[] = [];

    for (const [planetId, planetProgress] of sessionState.entries()) {
      const def = getAutoProductionDef(planetId);
      if (!def) continue;

      // 함선 생산 처리
      for (const ship of def.shipUnits) {
        const completed = this.processItemProduction(
          sessionId,
          planetId,
          `SHIP_${ship.shipTypeId}`,
          ship.dailyProduction,
          'SHIP',
          ship.shipTypeId,
        );
        if (completed) completedItems.push(completed);
      }

      // 승조원 생산 처리
      for (const crew of def.crewUnits) {
        const completed = this.processItemProduction(
          sessionId,
          planetId,
          `CREW_${crew.crewTypeId}`,
          crew.dailyProduction,
          'CREW',
          crew.crewTypeId,
        );
        if (completed) completedItems.push(completed);
      }

      // 육전대 생산 처리
      for (const ground of def.groundUnits) {
        const completed = this.processItemProduction(
          sessionId,
          planetId,
          `GROUND_${ground.unitTypeId}`,
          ground.dailyProduction,
          'GROUND',
          ground.unitTypeId,
        );
        if (completed) completedItems.push(completed);
      }
    }

    return completedItems;
  }

  /**
   * 개별 생산 품목 처리
   */
  private processItemProduction(
    sessionId: string,
    planetId: string,
    progressKey: string,
    dailyRate: number,
    itemType: 'SHIP' | 'CREW' | 'GROUND',
    itemId: string,
  ): ProductionCompletePayload | null {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) return null;

    const planetProgress = sessionState.get(planetId);
    if (!planetProgress) return null;

    let progress = planetProgress.get(progressKey);
    if (!progress) {
      progress = {
        itemId,
        itemType,
        progress: 0,
        accumulated: 0,
      };
      planetProgress.set(progressKey, progress);
    }

    // 진행도 증가
    progress.progress += dailyRate;

    // 1.0 이상이면 유닛 완료
    if (progress.progress >= 1.0) {
      const completedUnits = Math.floor(progress.progress);
      progress.progress -= completedUnits;
      progress.accumulated += completedUnits;

      const payload: ProductionCompletePayload = {
        sessionId,
        planetId,
        itemId,
        itemType,
        quantity: completedUnits,
      };

      this.emit('production:complete', payload);
      logger.debug(
        `[AutoProductionService] ${planetId} produced ${completedUnits} ${itemId} (${itemType})`,
      );

      return payload;
    }

    return null;
  }

  /**
   * 행성 점령 시 생산 상태 초기화
   */
  public handlePlanetOccupation(
    sessionId: string,
    planetId: string,
    newFaction: 'IMPERIAL' | 'ALLIANCE',
  ): void {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) return;

    // 기존 생산 상태 삭제
    sessionState.delete(planetId);

    // 새 진영에 해당하는 생산 정의가 있으면 초기화
    const newDef = getAutoProductionByFaction(newFaction).find((d) => d.planetId === planetId);
    if (newDef) {
      this.initializePlanetProduction(sessionId, planetId);
      logger.info(
        `[AutoProductionService] Planet ${planetId} production reset for faction ${newFaction}`,
      );
    } else {
      logger.info(
        `[AutoProductionService] Planet ${planetId} has no production definition for faction ${newFaction}`,
      );
    }
  }

  /**
   * 특정 행성의 생산 현황 조회
   */
  public getPlanetProductionStatus(
    sessionId: string,
    planetId: string,
  ): Array<{
    itemId: string;
    itemType: string;
    progress: number;
    accumulated: number;
    dailyRate: number;
    estimatedDaysToComplete: number;
  }> {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) return [];

    const planetProgress = sessionState.get(planetId);
    if (!planetProgress) return [];

    const def = getAutoProductionDef(planetId);
    if (!def) return [];

    const result: Array<{
      itemId: string;
      itemType: string;
      progress: number;
      accumulated: number;
      dailyRate: number;
      estimatedDaysToComplete: number;
    }> = [];

    // 함선
    for (const ship of def.shipUnits) {
      const key = `SHIP_${ship.shipTypeId}`;
      const prog = planetProgress.get(key);
      if (prog) {
        const remaining = 1.0 - prog.progress;
        result.push({
          itemId: ship.shipTypeId,
          itemType: 'SHIP',
          progress: prog.progress,
          accumulated: prog.accumulated,
          dailyRate: ship.dailyProduction,
          estimatedDaysToComplete:
            ship.dailyProduction > 0 ? Math.ceil(remaining / ship.dailyProduction) : Infinity,
        });
      }
    }

    // 승조원
    for (const crew of def.crewUnits) {
      const key = `CREW_${crew.crewTypeId}`;
      const prog = planetProgress.get(key);
      if (prog) {
        const remaining = 1.0 - prog.progress;
        result.push({
          itemId: crew.crewTypeId,
          itemType: 'CREW',
          progress: prog.progress,
          accumulated: prog.accumulated,
          dailyRate: crew.dailyProduction,
          estimatedDaysToComplete:
            crew.dailyProduction > 0 ? Math.ceil(remaining / crew.dailyProduction) : Infinity,
        });
      }
    }

    // 육전대
    for (const ground of def.groundUnits) {
      const key = `GROUND_${ground.unitTypeId}`;
      const prog = planetProgress.get(key);
      if (prog) {
        const remaining = 1.0 - prog.progress;
        result.push({
          itemId: ground.unitTypeId,
          itemType: 'GROUND',
          progress: prog.progress,
          accumulated: prog.accumulated,
          dailyRate: ground.dailyProduction,
          estimatedDaysToComplete:
            ground.dailyProduction > 0 ? Math.ceil(remaining / ground.dailyProduction) : Infinity,
        });
      }
    }

    return result;
  }

  /**
   * 세션 전체 생산 통계 조회
   */
  public getSessionProductionStats(sessionId: string): {
    totalPlanets: number;
    totalShipProgress: number;
    totalCrewProgress: number;
    totalGroundProgress: number;
    totalAccumulated: { ships: number; crews: number; grounds: number };
  } {
    const sessionState = this.productionState.get(sessionId);
    if (!sessionState) {
      return {
        totalPlanets: 0,
        totalShipProgress: 0,
        totalCrewProgress: 0,
        totalGroundProgress: 0,
        totalAccumulated: { ships: 0, crews: 0, grounds: 0 },
      };
    }

    let totalShipProgress = 0;
    let totalCrewProgress = 0;
    let totalGroundProgress = 0;
    let totalShips = 0;
    let totalCrews = 0;
    let totalGrounds = 0;

    for (const [, planetProgress] of sessionState.entries()) {
      for (const [, progress] of planetProgress.entries()) {
        switch (progress.itemType) {
          case 'SHIP':
            totalShipProgress += progress.progress;
            totalShips += progress.accumulated;
            break;
          case 'CREW':
            totalCrewProgress += progress.progress;
            totalCrews += progress.accumulated;
            break;
          case 'GROUND':
            totalGroundProgress += progress.progress;
            totalGrounds += progress.accumulated;
            break;
        }
      }
    }

    return {
      totalPlanets: sessionState.size,
      totalShipProgress,
      totalCrewProgress,
      totalGroundProgress,
      totalAccumulated: { ships: totalShips, crews: totalCrews, grounds: totalGrounds },
    };
  }
}

export const autoProductionService = AutoProductionService.getInstance();
export default AutoProductionService;





