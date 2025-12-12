/**
 * PrivateArmyService - 제국 사병(私兵) 시스템 서비스
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 귀족의 개인 군대(사병) 관리
 * - 봉토 기반 병력 유지
 * - 반란 시 동원
 *
 * 원작 예시: 브라운슈바이크 공작의 사병, 리텐하임 후작의 사병
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/**
 * 사병 유닛 타입
 */
export enum PrivateUnitType {
  WARSHIP = 'WARSHIP',       // 전투함
  TRANSPORT = 'TRANSPORT',   // 수송함
  GROUND_TROOP = 'GROUND_TROOP', // 육전대
  GUARD = 'GUARD',           // 근위병 (개인 호위)
}

/**
 * 사병 유닛 인터페이스
 */
export interface PrivateUnit {
  unitId: string;
  type: PrivateUnitType;
  count: number;             // 함선 수 또는 병력 수
  quality: number;           // 품질 (0-100, 훈련도+장비)
  morale: number;            // 사기 (0-100)
  maintenanceCost: number;   // 월 유지비
}

/**
 * 사병 인터페이스
 */
export interface PrivateArmy {
  armyId: string;
  sessionId: string;
  ownerId: string;           // 귀족 캐릭터 ID
  ownerName: string;

  // 병력
  units: PrivateUnit[];
  totalShips: number;        // 총 함선 수
  totalTroops: number;       // 총 육전 병력

  // 유지
  monthlyMaintenanceCost: number;  // 월간 유지비 총액
  lastPaidAt: Date;

  // 상태
  status: 'ACTIVE' | 'MOBILIZED' | 'DISBANDED';
  mobilizedForRebellionId?: string;

  // 한도
  maxShips: number;          // 봉토 기반 최대 함선
  maxTroops: number;         // 봉토 기반 최대 병력

  createdAt: Date;
  updatedAt: Date;
}

/**
 * 사병 규모 계산 상수
 */
const PRIVATE_ARMY_CONSTANTS = {
  // 봉토 인구 1000만 당 최대 함선 수
  SHIPS_PER_10M_POPULATION: 100,
  // 봉토 인구 1000만 당 최대 육전 병력
  TROOPS_PER_10M_POPULATION: 10000,
  // 함선 1척당 월 유지비
  SHIP_MAINTENANCE_COST: 50,
  // 육전병 1명당 월 유지비
  TROOP_MAINTENANCE_COST: 1,
  // 근위병 1명당 월 유지비 (정예)
  GUARD_MAINTENANCE_COST: 5,
  // 유지비 미지불 시 사기 감소
  MORALE_DECAY_UNPAID: 10,
  // 유지비 미지불 시 탈영률
  DESERTION_RATE_UNPAID: 0.05,
};

/**
 * 사병 충원 요청
 */
export interface RecruitRequest {
  sessionId: string;
  ownerId: string;
  unitType: PrivateUnitType;
  count: number;
  quality?: number;          // 기본 50
}

/**
 * PrivateArmyService 클래스
 */
export class PrivateArmyService extends EventEmitter {
  private static instance: PrivateArmyService;

  // 사병 저장소 (캐릭터 ID -> 사병)
  private armies: Map<string, PrivateArmy> = new Map();

  private constructor() {
    super();
    logger.info('[PrivateArmyService] Initialized');
  }

  public static getInstance(): PrivateArmyService {
    if (!PrivateArmyService.instance) {
      PrivateArmyService.instance = new PrivateArmyService();
    }
    return PrivateArmyService.instance;
  }

  // ==================== 사병 생성/관리 ====================

  /**
   * 사병 초기화 (봉토 수여 시 호출)
   */
  public async initializePrivateArmy(
    sessionId: string,
    ownerId: string,
    fiefdomPopulations: number[], // 봉토들의 인구 배열
  ): Promise<PrivateArmy> {
    const character = await Gin7Character.findOne({ sessionId, characterId: ownerId });
    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // 기존 사병이 있으면 업데이트
    const existingArmy = this.armies.get(ownerId);
    if (existingArmy) {
      return this.updateArmyLimits(existingArmy, fiefdomPopulations);
    }

    // 총 인구 계산
    const totalPopulation = fiefdomPopulations.reduce((sum, p) => sum + p, 0);

    // 최대 한도 계산
    const maxShips = Math.floor(
      (totalPopulation / 10000000) * PRIVATE_ARMY_CONSTANTS.SHIPS_PER_10M_POPULATION
    );
    const maxTroops = Math.floor(
      (totalPopulation / 10000000) * PRIVATE_ARMY_CONSTANTS.TROOPS_PER_10M_POPULATION
    );

    const armyId = `PARMY-${ownerId}-${Date.now()}`;
    const now = new Date();

    const army: PrivateArmy = {
      armyId,
      sessionId,
      ownerId,
      ownerName: character.name,
      units: [],
      totalShips: 0,
      totalTroops: 0,
      monthlyMaintenanceCost: 0,
      lastPaidAt: now,
      status: 'ACTIVE',
      maxShips: Math.max(10, maxShips), // 최소 10척
      maxTroops: Math.max(1000, maxTroops), // 최소 1000명
      createdAt: now,
      updatedAt: now,
    };

    this.armies.set(ownerId, army);

    this.emit('PRIVATE_ARMY_CREATED', {
      sessionId,
      armyId,
      ownerId,
      maxShips: army.maxShips,
      maxTroops: army.maxTroops,
    });

    logger.info(`[PrivateArmyService] Private army initialized for ${character.name}`, {
      maxShips: army.maxShips,
      maxTroops: army.maxTroops,
    });

    return army;
  }

  /**
   * 사병 한도 업데이트 (봉토 변경 시)
   */
  private updateArmyLimits(
    army: PrivateArmy,
    fiefdomPopulations: number[],
  ): PrivateArmy {
    const totalPopulation = fiefdomPopulations.reduce((sum, p) => sum + p, 0);

    army.maxShips = Math.max(10, Math.floor(
      (totalPopulation / 10000000) * PRIVATE_ARMY_CONSTANTS.SHIPS_PER_10M_POPULATION
    ));
    army.maxTroops = Math.max(1000, Math.floor(
      (totalPopulation / 10000000) * PRIVATE_ARMY_CONSTANTS.TROOPS_PER_10M_POPULATION
    ));
    army.updatedAt = new Date();

    return army;
  }

  // ==================== 사병 충원 ====================

  /**
   * 사병 충원
   */
  public async recruitUnits(request: RecruitRequest): Promise<{
    success: boolean;
    error?: string;
    unit?: PrivateUnit;
    recruitCost?: number;
  }> {
    const { sessionId, ownerId, unitType, count, quality = 50 } = request;

    const army = this.armies.get(ownerId);
    if (!army || army.sessionId !== sessionId) {
      return { success: false, error: '사병을 찾을 수 없습니다.' };
    }

    if (army.status !== 'ACTIVE') {
      return { success: false, error: '동원 중이거나 해산된 사병입니다.' };
    }

    // 한도 체크
    if (unitType === PrivateUnitType.WARSHIP || unitType === PrivateUnitType.TRANSPORT) {
      if (army.totalShips + count > army.maxShips) {
        return {
          success: false,
          error: `함선 한도 초과. 현재: ${army.totalShips}, 한도: ${army.maxShips}`,
        };
      }
    } else {
      if (army.totalTroops + count > army.maxTroops) {
        return {
          success: false,
          error: `병력 한도 초과. 현재: ${army.totalTroops}, 한도: ${army.maxTroops}`,
        };
      }
    }

    // 충원 비용 계산 (유지비의 12배 = 1년치)
    const unitMaintenanceCost = this.calculateUnitMaintenanceCost(unitType, count);
    const recruitCost = unitMaintenanceCost * 12;

    // 유닛 생성
    const unitId = `PUNIT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const unit: PrivateUnit = {
      unitId,
      type: unitType,
      count,
      quality,
      morale: 70, // 초기 사기
      maintenanceCost: unitMaintenanceCost,
    };

    army.units.push(unit);

    // 총계 업데이트
    if (unitType === PrivateUnitType.WARSHIP || unitType === PrivateUnitType.TRANSPORT) {
      army.totalShips += count;
    } else {
      army.totalTroops += count;
    }

    army.monthlyMaintenanceCost += unitMaintenanceCost;
    army.updatedAt = new Date();

    this.emit('UNITS_RECRUITED', {
      sessionId,
      ownerId,
      unitType,
      count,
      recruitCost,
    });

    logger.info(`[PrivateArmyService] Units recruited`, {
      ownerId,
      unitType,
      count,
      recruitCost,
    });

    return { success: true, unit, recruitCost };
  }

  /**
   * 유닛 유지비 계산
   */
  private calculateUnitMaintenanceCost(unitType: PrivateUnitType, count: number): number {
    switch (unitType) {
      case PrivateUnitType.WARSHIP:
      case PrivateUnitType.TRANSPORT:
        return count * PRIVATE_ARMY_CONSTANTS.SHIP_MAINTENANCE_COST;
      case PrivateUnitType.GUARD:
        return count * PRIVATE_ARMY_CONSTANTS.GUARD_MAINTENANCE_COST;
      case PrivateUnitType.GROUND_TROOP:
      default:
        return count * PRIVATE_ARMY_CONSTANTS.TROOP_MAINTENANCE_COST;
    }
  }

  // ==================== 유지비 처리 ====================

  /**
   * 월간 유지비 처리 (TimeEngine에서 호출)
   */
  public async processMonthlyMaintenance(sessionId: string): Promise<void> {
    for (const [ownerId, army] of this.armies) {
      if (army.sessionId !== sessionId) continue;
      if (army.status === 'DISBANDED') continue;

      // 봉토 수입 조회 (FiefService와 연동 필요)
      const fiefIncome = await this.getFiefIncome(sessionId, ownerId);
      const maintenanceCost = army.monthlyMaintenanceCost;

      if (fiefIncome >= maintenanceCost) {
        // 유지비 지불 성공
        army.lastPaidAt = new Date();

        // 사기 회복
        for (const unit of army.units) {
          unit.morale = Math.min(100, unit.morale + 5);
        }

        this.emit('MAINTENANCE_PAID', {
          sessionId,
          ownerId,
          amount: maintenanceCost,
          remaining: fiefIncome - maintenanceCost,
        });
      } else {
        // 유지비 지불 실패
        this.emit('MAINTENANCE_FAILED', {
          sessionId,
          ownerId,
          required: maintenanceCost,
          available: fiefIncome,
        });

        // 사기 감소
        for (const unit of army.units) {
          unit.morale = Math.max(0, unit.morale - PRIVATE_ARMY_CONSTANTS.MORALE_DECAY_UNPAID);
        }

        // 탈영 처리
        await this.processDesertion(army);
      }
    }
  }

  /**
   * 탈영 처리
   */
  private async processDesertion(army: PrivateArmy): Promise<void> {
    const desertionRate = PRIVATE_ARMY_CONSTANTS.DESERTION_RATE_UNPAID;
    let totalDeserted = 0;

    for (const unit of army.units) {
      if (unit.morale < 30) {
        const deserted = Math.floor(unit.count * desertionRate);
        if (deserted > 0) {
          unit.count -= deserted;
          totalDeserted += deserted;

          // 유지비 재계산
          unit.maintenanceCost = this.calculateUnitMaintenanceCost(unit.type, unit.count);
        }
      }
    }

    // 빈 유닛 제거
    army.units = army.units.filter(u => u.count > 0);

    // 총계 재계산
    this.recalculateTotals(army);

    if (totalDeserted > 0) {
      this.emit('DESERTION_OCCURRED', {
        sessionId: army.sessionId,
        ownerId: army.ownerId,
        desertedCount: totalDeserted,
      });

      logger.warn(`[PrivateArmyService] Desertion occurred`, {
        ownerId: army.ownerId,
        desertedCount: totalDeserted,
      });
    }
  }

  /**
   * 총계 재계산
   */
  private recalculateTotals(army: PrivateArmy): void {
    army.totalShips = army.units
      .filter(u => u.type === PrivateUnitType.WARSHIP || u.type === PrivateUnitType.TRANSPORT)
      .reduce((sum, u) => sum + u.count, 0);

    army.totalTroops = army.units
      .filter(u => u.type === PrivateUnitType.GROUND_TROOP || u.type === PrivateUnitType.GUARD)
      .reduce((sum, u) => sum + u.count, 0);

    army.monthlyMaintenanceCost = army.units.reduce((sum, u) => sum + u.maintenanceCost, 0);
  }

  // ==================== 사병 동원 ====================

  /**
   * 사병 동원 (반란 시)
   */
  public mobilizeForRebellion(
    sessionId: string,
    ownerId: string,
    rebellionId: string,
  ): { success: boolean; error?: string; army?: PrivateArmy } {
    const army = this.armies.get(ownerId);
    if (!army || army.sessionId !== sessionId) {
      return { success: false, error: '사병을 찾을 수 없습니다.' };
    }

    if (army.status !== 'ACTIVE') {
      return { success: false, error: '이미 동원 중이거나 해산된 사병입니다.' };
    }

    army.status = 'MOBILIZED';
    army.mobilizedForRebellionId = rebellionId;
    army.updatedAt = new Date();

    this.emit('ARMY_MOBILIZED', {
      sessionId,
      ownerId,
      rebellionId,
      totalShips: army.totalShips,
      totalTroops: army.totalTroops,
    });

    logger.info(`[PrivateArmyService] Army mobilized for rebellion`, {
      ownerId,
      rebellionId,
      totalShips: army.totalShips,
      totalTroops: army.totalTroops,
    });

    return { success: true, army };
  }

  /**
   * 사병 복귀 (반란 종결 후)
   */
  public demobilize(sessionId: string, ownerId: string): boolean {
    const army = this.armies.get(ownerId);
    if (!army || army.sessionId !== sessionId) return false;

    army.status = 'ACTIVE';
    army.mobilizedForRebellionId = undefined;
    army.updatedAt = new Date();

    this.emit('ARMY_DEMOBILIZED', {
      sessionId,
      ownerId,
    });

    return true;
  }

  /**
   * 사병 해산 (봉토 몰수, 반역죄 등)
   */
  public disbandArmy(sessionId: string, ownerId: string): boolean {
    const army = this.armies.get(ownerId);
    if (!army || army.sessionId !== sessionId) return false;

    army.status = 'DISBANDED';
    army.units = [];
    army.totalShips = 0;
    army.totalTroops = 0;
    army.monthlyMaintenanceCost = 0;
    army.updatedAt = new Date();

    this.emit('ARMY_DISBANDED', {
      sessionId,
      ownerId,
      armyId: army.armyId,
    });

    logger.info(`[PrivateArmyService] Army disbanded`, { ownerId });

    return true;
  }

  // ==================== 조회 ====================

  /**
   * 사병 조회
   */
  public getArmy(ownerId: string): PrivateArmy | undefined {
    return this.armies.get(ownerId);
  }

  /**
   * 세션 내 모든 사병 조회
   */
  public getSessionArmies(sessionId: string): PrivateArmy[] {
    return Array.from(this.armies.values()).filter(a => a.sessionId === sessionId);
  }

  /**
   * 동원된 사병 조회
   */
  public getMobilizedArmies(sessionId: string, rebellionId: string): PrivateArmy[] {
    return Array.from(this.armies.values()).filter(
      a => a.sessionId === sessionId &&
           a.status === 'MOBILIZED' &&
           a.mobilizedForRebellionId === rebellionId
    );
  }

  /**
   * 사병 전력 합산 (반란 세력 전력 계산용)
   */
  public calculateCombinedStrength(ownerIds: string[]): {
    totalShips: number;
    totalTroops: number;
    armies: PrivateArmy[];
  } {
    const armies = ownerIds
      .map(id => this.armies.get(id))
      .filter((a): a is PrivateArmy => a !== undefined);

    return {
      totalShips: armies.reduce((sum, a) => sum + a.totalShips, 0),
      totalTroops: armies.reduce((sum, a) => sum + a.totalTroops, 0),
      armies,
    };
  }

  // ==================== Helper ====================

  /**
   * 봉토 수입 조회 (FiefService 연동)
   * TODO: 실제 FiefService와 연동
   */
  private async getFiefIncome(sessionId: string, ownerId: string): Promise<number> {
    // 임시 구현 - 실제로는 FiefService에서 가져와야 함
    return 10000; // 기본 수입
  }
}

export const privateArmyService = PrivateArmyService.getInstance();
export default PrivateArmyService;







