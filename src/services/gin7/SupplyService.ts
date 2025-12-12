/**
 * SupplyService
 * 
 * 함대 보급 시스템 관리
 * - 연료(fuel): 이동에 필요, 0이면 이동 불가
 * - 탄약(ammo): 공격에 필요, 0이면 공격 불가
 * - 보급품(supplies): 수리/회복에 필요, 0이면 수리 불가
 * 
 * 전투 중 매 틱마다 소모됨
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet, IFleetSupply } from '../../models/gin7/Fleet';

/**
 * 보급 소모율 상수
 */
export const CONSUMPTION_RATES = {
  // 연료 소모 (매 틱)
  fuelPerMoveTick: 0.1,      // 이동 시 연료 소모/틱
  fuelPerIdleTick: 0.01,     // 정지 시 연료 소모/틱 (최소 유지비)
  fuelPerWarpTick: 0.5,      // 워프 시 연료 소모/틱
  
  // 탄약 소모
  ammoPerAttack: 1.0,        // 공격당 탄약 소모
  ammoPerMissile: 2.0,       // 미사일 공격당 소모
  ammoPerDefense: 0.3,       // 방어 시 소모 (포인트 디펜스)
  
  // 보급품 소모
  suppliesPerTick: 0.05,     // 틱당 기본 보급품 소모
  suppliesPerRepair: 5.0,    // 수리 시 보급품 소모
  suppliesPerMoraleBoost: 2.0, // 사기 회복 시 소모
  
  // 유닛 규모 배율 (유닛당 소모량 배율)
  unitScaleFactor: 0.01,     // 유닛 1개당 기본 소모량의 1%
};

/**
 * 보급 상태
 */
export interface ISupplyStatus {
  fleetId: string;
  sessionId: string;
  
  // 현재 보급 상태
  fuel: number;
  maxFuel: number;
  fuelPercent: number;
  
  ammo: number;
  maxAmmo: number;
  ammoPercent: number;
  
  supplies: number;
  maxSupplies: number;
  suppliesPercent: number;
  
  // 능력 상태
  canMove: boolean;
  canAttack: boolean;
  canRepair: boolean;
  
  // 예상 지속 시간 (틱)
  ticksUntilFuelEmpty: number;
  ticksUntilAmmoEmpty: number;
  ticksUntilSuppliesEmpty: number;
  
  // 위험 상태
  isLowFuel: boolean;      // 연료 < 20%
  isLowAmmo: boolean;      // 탄약 < 20%
  isLowSupplies: boolean;  // 보급품 < 20%
  isCritical: boolean;     // 어느 하나라도 < 10%
}

/**
 * 보급 소모 결과
 */
export interface IConsumptionResult {
  success: boolean;
  consumed: {
    fuel: number;
    ammo: number;
    supplies: number;
  };
  remaining: IFleetSupply;
  depleted: {
    fuel: boolean;
    ammo: boolean;
    supplies: boolean;
  };
  warning?: string;
}

/**
 * 보급 이벤트
 */
export interface ISupplyEvent {
  sessionId: string;
  fleetId: string;
  type: 'LOW_FUEL' | 'LOW_AMMO' | 'LOW_SUPPLIES' | 'FUEL_EMPTY' | 'AMMO_EMPTY' | 'SUPPLIES_EMPTY' | 'RESUPPLIED';
  currentValue: number;
  maxValue: number;
  percent: number;
}

/**
 * SupplyService 클래스
 */
class SupplyService extends EventEmitter {
  private static instance: SupplyService;
  
  // 보급 상태 캐시 (전투 중 빠른 조회용)
  private supplyCache: Map<string, IFleetSupply> = new Map();  // fleetId -> supply
  
  // 경고 발송 추적 (중복 방지)
  private warningsSent: Map<string, Set<string>> = new Map();  // fleetId -> warning types

  private constructor() {
    super();
  }

  static getInstance(): SupplyService {
    if (!SupplyService.instance) {
      SupplyService.instance = new SupplyService();
    }
    return SupplyService.instance;
  }

  /**
   * 함대 보급 상태 조회
   */
  async getFleetSupply(sessionId: string, fleetId: string): Promise<IFleetSupply | null> {
    // 캐시 확인
    const cached = this.supplyCache.get(fleetId);
    if (cached) {
      return cached;
    }

    // DB 조회
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet || !fleet.supply) {
      return null;
    }

    // 캐시 저장
    this.supplyCache.set(fleetId, fleet.supply);
    return fleet.supply;
  }

  /**
   * 함대 보급 상태 상세 조회
   */
  async getSupplyStatus(sessionId: string, fleetId: string): Promise<ISupplyStatus | null> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) {
      return null;
    }

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    const unitCount = fleet?.units?.reduce((sum, u) => sum + u.count, 0) || 1;

    // 예상 소모율 계산
    const fuelRate = this.calculateFuelConsumptionRate(unitCount, true);
    const ammoRate = this.calculateAmmoConsumptionRate(unitCount);
    const suppliesRate = this.calculateSuppliesConsumptionRate(unitCount);

    const fuelPercent = (supply.fuel / supply.maxFuel) * 100;
    const ammoPercent = (supply.ammo / supply.maxAmmo) * 100;
    const suppliesPercent = (supply.supplies / supply.maxSupplies) * 100;

    return {
      fleetId,
      sessionId,
      
      fuel: supply.fuel,
      maxFuel: supply.maxFuel,
      fuelPercent,
      
      ammo: supply.ammo,
      maxAmmo: supply.maxAmmo,
      ammoPercent,
      
      supplies: supply.supplies,
      maxSupplies: supply.maxSupplies,
      suppliesPercent,
      
      canMove: supply.fuel > 0,
      canAttack: supply.ammo > 0,
      canRepair: supply.supplies > 0,
      
      ticksUntilFuelEmpty: fuelRate > 0 ? Math.floor(supply.fuel / fuelRate) : Infinity,
      ticksUntilAmmoEmpty: ammoRate > 0 ? Math.floor(supply.ammo / ammoRate) : Infinity,
      ticksUntilSuppliesEmpty: suppliesRate > 0 ? Math.floor(supply.supplies / suppliesRate) : Infinity,
      
      isLowFuel: fuelPercent < 20,
      isLowAmmo: ammoPercent < 20,
      isLowSupplies: suppliesPercent < 20,
      isCritical: fuelPercent < 10 || ammoPercent < 10 || suppliesPercent < 10
    };
  }

  /**
   * 연료 소모
   */
  async consumeFuel(
    sessionId: string, 
    fleetId: string, 
    amount: number
  ): Promise<IConsumptionResult> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) {
      return this.createFailedResult('함대를 찾을 수 없습니다');
    }

    const actualAmount = Math.min(amount, supply.fuel);
    supply.fuel = Math.max(0, supply.fuel - actualAmount);
    
    // 캐시 업데이트
    this.supplyCache.set(fleetId, supply);
    
    // 경고 체크
    await this.checkAndEmitWarnings(sessionId, fleetId, supply);

    return {
      success: true,
      consumed: { fuel: actualAmount, ammo: 0, supplies: 0 },
      remaining: supply,
      depleted: {
        fuel: supply.fuel <= 0,
        ammo: false,
        supplies: false
      }
    };
  }

  /**
   * 탄약 소모
   */
  async consumeAmmo(
    sessionId: string, 
    fleetId: string, 
    amount: number
  ): Promise<IConsumptionResult> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) {
      return this.createFailedResult('함대를 찾을 수 없습니다');
    }

    const actualAmount = Math.min(amount, supply.ammo);
    supply.ammo = Math.max(0, supply.ammo - actualAmount);
    
    this.supplyCache.set(fleetId, supply);
    await this.checkAndEmitWarnings(sessionId, fleetId, supply);

    return {
      success: true,
      consumed: { fuel: 0, ammo: actualAmount, supplies: 0 },
      remaining: supply,
      depleted: {
        fuel: false,
        ammo: supply.ammo <= 0,
        supplies: false
      }
    };
  }

  /**
   * 보급품 소모
   */
  async consumeSupplies(
    sessionId: string, 
    fleetId: string, 
    amount: number
  ): Promise<IConsumptionResult> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) {
      return this.createFailedResult('함대를 찾을 수 없습니다');
    }

    const actualAmount = Math.min(amount, supply.supplies);
    supply.supplies = Math.max(0, supply.supplies - actualAmount);
    
    this.supplyCache.set(fleetId, supply);
    await this.checkAndEmitWarnings(sessionId, fleetId, supply);

    return {
      success: true,
      consumed: { fuel: 0, ammo: 0, supplies: actualAmount },
      remaining: supply,
      depleted: {
        fuel: false,
        ammo: false,
        supplies: supply.supplies <= 0
      }
    };
  }

  /**
   * 전투 틱 보급 소모 (통합)
   * 매 틱마다 호출됨
   */
  async processBattleTick(
    sessionId: string,
    fleetId: string,
    actions: {
      isMoving: boolean;
      isAttacking: boolean;
      attackCount?: number;
      isRepairing?: boolean;
    }
  ): Promise<IConsumptionResult> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) {
      return this.createFailedResult('함대를 찾을 수 없습니다');
    }

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    const unitCount = fleet?.units?.reduce((sum, u) => sum + u.count, 0) || 1;

    // 소모량 계산
    let fuelConsumption = 0;
    let ammoConsumption = 0;
    let suppliesConsumption = 0;

    // 연료 소모
    if (actions.isMoving) {
      fuelConsumption = this.calculateFuelConsumptionRate(unitCount, true);
    } else {
      fuelConsumption = this.calculateFuelConsumptionRate(unitCount, false);
    }

    // 탄약 소모
    if (actions.isAttacking) {
      const attacks = actions.attackCount || 1;
      ammoConsumption = CONSUMPTION_RATES.ammoPerAttack * attacks * (1 + unitCount * CONSUMPTION_RATES.unitScaleFactor);
    }

    // 보급품 소모
    suppliesConsumption = this.calculateSuppliesConsumptionRate(unitCount);
    if (actions.isRepairing) {
      suppliesConsumption += CONSUMPTION_RATES.suppliesPerRepair;
    }

    // 적용
    const consumed = {
      fuel: Math.min(fuelConsumption, supply.fuel),
      ammo: Math.min(ammoConsumption, supply.ammo),
      supplies: Math.min(suppliesConsumption, supply.supplies)
    };

    supply.fuel = Math.max(0, supply.fuel - consumed.fuel);
    supply.ammo = Math.max(0, supply.ammo - consumed.ammo);
    supply.supplies = Math.max(0, supply.supplies - consumed.supplies);

    this.supplyCache.set(fleetId, supply);
    await this.checkAndEmitWarnings(sessionId, fleetId, supply);

    return {
      success: true,
      consumed,
      remaining: supply,
      depleted: {
        fuel: supply.fuel <= 0,
        ammo: supply.ammo <= 0,
        supplies: supply.supplies <= 0
      }
    };
  }

  /**
   * 전투 지속 가능 여부 확인
   */
  async canContinueBattle(sessionId: string, fleetId: string): Promise<boolean> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) return false;

    // 연료가 있어야 전투 지속 가능 (최소한 위치 유지)
    // 탄약이 없어도 방어는 가능
    return supply.fuel > 0;
  }

  /**
   * 공격 가능 여부 확인
   */
  async canAttack(sessionId: string, fleetId: string): Promise<boolean> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) return false;
    return supply.ammo > 0;
  }

  /**
   * 이동 가능 여부 확인
   */
  async canMove(sessionId: string, fleetId: string): Promise<boolean> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) return false;
    return supply.fuel > 0;
  }

  /**
   * 수리 가능 여부 확인
   */
  async canRepair(sessionId: string, fleetId: string): Promise<boolean> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) return false;
    return supply.supplies >= CONSUMPTION_RATES.suppliesPerRepair;
  }

  /**
   * 남은 전투 가능 틱 수 계산
   */
  async getTicksRemaining(
    sessionId: string, 
    fleetId: string,
    assumeActive: boolean = true
  ): Promise<number> {
    const supply = await this.getFleetSupply(sessionId, fleetId);
    if (!supply) return 0;

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    const unitCount = fleet?.units?.reduce((sum, u) => sum + u.count, 0) || 1;

    // 가장 빨리 고갈되는 자원 기준
    const fuelRate = this.calculateFuelConsumptionRate(unitCount, assumeActive);
    const suppliesRate = this.calculateSuppliesConsumptionRate(unitCount);

    const fuelTicks = fuelRate > 0 ? supply.fuel / fuelRate : Infinity;
    const suppliesTicks = suppliesRate > 0 ? supply.supplies / suppliesRate : Infinity;

    return Math.floor(Math.min(fuelTicks, suppliesTicks));
  }

  /**
   * 보급 (리필)
   */
  async resupply(
    sessionId: string,
    fleetId: string,
    amounts: { fuel?: number; ammo?: number; supplies?: number }
  ): Promise<IFleetSupply | null> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet || !fleet.supply) return null;

    if (amounts.fuel !== undefined) {
      fleet.supply.fuel = Math.min(fleet.supply.maxFuel, fleet.supply.fuel + amounts.fuel);
    }
    if (amounts.ammo !== undefined) {
      fleet.supply.ammo = Math.min(fleet.supply.maxAmmo, fleet.supply.ammo + amounts.ammo);
    }
    if (amounts.supplies !== undefined) {
      fleet.supply.supplies = Math.min(fleet.supply.maxSupplies, fleet.supply.supplies + amounts.supplies);
    }

    await fleet.save();
    this.supplyCache.set(fleetId, fleet.supply);
    
    // 경고 초기화
    this.warningsSent.delete(fleetId);

    this.emit('supply:resupplied', {
      sessionId,
      fleetId,
      type: 'RESUPPLIED',
      supply: fleet.supply
    });

    return fleet.supply;
  }

  /**
   * 보급 완전 리필
   */
  async resupplyFull(sessionId: string, fleetId: string): Promise<IFleetSupply | null> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet || !fleet.supply) return null;

    fleet.supply.fuel = fleet.supply.maxFuel;
    fleet.supply.ammo = fleet.supply.maxAmmo;
    fleet.supply.supplies = fleet.supply.maxSupplies;

    await fleet.save();
    this.supplyCache.set(fleetId, fleet.supply);
    this.warningsSent.delete(fleetId);

    this.emit('supply:resupplied', {
      sessionId,
      fleetId,
      type: 'RESUPPLIED',
      supply: fleet.supply
    });

    return fleet.supply;
  }

  /**
   * 캐시된 보급 상태를 DB에 저장
   */
  async saveSupplyState(sessionId: string, fleetId: string): Promise<void> {
    const supply = this.supplyCache.get(fleetId);
    if (!supply) return;

    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { supply }
    );
  }

  /**
   * 전투 종료 시 모든 함대 보급 상태 저장
   */
  async saveBattleSupplyStates(sessionId: string, fleetIds: string[]): Promise<void> {
    for (const fleetId of fleetIds) {
      await this.saveSupplyState(sessionId, fleetId);
    }
  }

  // === 내부 헬퍼 함수 ===

  /**
   * 연료 소모율 계산
   */
  private calculateFuelConsumptionRate(unitCount: number, isMoving: boolean): number {
    const baseRate = isMoving 
      ? CONSUMPTION_RATES.fuelPerMoveTick 
      : CONSUMPTION_RATES.fuelPerIdleTick;
    
    return baseRate * (1 + unitCount * CONSUMPTION_RATES.unitScaleFactor);
  }

  /**
   * 탄약 소모율 계산
   */
  private calculateAmmoConsumptionRate(unitCount: number): number {
    return CONSUMPTION_RATES.ammoPerAttack * (1 + unitCount * CONSUMPTION_RATES.unitScaleFactor);
  }

  /**
   * 보급품 소모율 계산
   */
  private calculateSuppliesConsumptionRate(unitCount: number): number {
    return CONSUMPTION_RATES.suppliesPerTick * (1 + unitCount * CONSUMPTION_RATES.unitScaleFactor);
  }

  /**
   * 실패 결과 생성
   */
  private createFailedResult(warning: string): IConsumptionResult {
    return {
      success: false,
      consumed: { fuel: 0, ammo: 0, supplies: 0 },
      remaining: { fuel: 0, maxFuel: 0, ammo: 0, maxAmmo: 0, supplies: 0, maxSupplies: 0 },
      depleted: { fuel: false, ammo: false, supplies: false },
      warning
    };
  }

  /**
   * 경고 체크 및 이벤트 발송
   */
  private async checkAndEmitWarnings(
    sessionId: string,
    fleetId: string,
    supply: IFleetSupply
  ): Promise<void> {
    if (!this.warningsSent.has(fleetId)) {
      this.warningsSent.set(fleetId, new Set());
    }
    const sent = this.warningsSent.get(fleetId)!;

    const fuelPercent = (supply.fuel / supply.maxFuel) * 100;
    const ammoPercent = (supply.ammo / supply.maxAmmo) * 100;
    const suppliesPercent = (supply.supplies / supply.maxSupplies) * 100;

    // 연료 경고
    if (supply.fuel <= 0 && !sent.has('FUEL_EMPTY')) {
      sent.add('FUEL_EMPTY');
      this.emitSupplyEvent(sessionId, fleetId, 'FUEL_EMPTY', supply.fuel, supply.maxFuel, fuelPercent);
    } else if (fuelPercent < 20 && !sent.has('LOW_FUEL')) {
      sent.add('LOW_FUEL');
      this.emitSupplyEvent(sessionId, fleetId, 'LOW_FUEL', supply.fuel, supply.maxFuel, fuelPercent);
    }

    // 탄약 경고
    if (supply.ammo <= 0 && !sent.has('AMMO_EMPTY')) {
      sent.add('AMMO_EMPTY');
      this.emitSupplyEvent(sessionId, fleetId, 'AMMO_EMPTY', supply.ammo, supply.maxAmmo, ammoPercent);
    } else if (ammoPercent < 20 && !sent.has('LOW_AMMO')) {
      sent.add('LOW_AMMO');
      this.emitSupplyEvent(sessionId, fleetId, 'LOW_AMMO', supply.ammo, supply.maxAmmo, ammoPercent);
    }

    // 보급품 경고
    if (supply.supplies <= 0 && !sent.has('SUPPLIES_EMPTY')) {
      sent.add('SUPPLIES_EMPTY');
      this.emitSupplyEvent(sessionId, fleetId, 'SUPPLIES_EMPTY', supply.supplies, supply.maxSupplies, suppliesPercent);
    } else if (suppliesPercent < 20 && !sent.has('LOW_SUPPLIES')) {
      sent.add('LOW_SUPPLIES');
      this.emitSupplyEvent(sessionId, fleetId, 'LOW_SUPPLIES', supply.supplies, supply.maxSupplies, suppliesPercent);
    }
  }

  /**
   * 보급 이벤트 발송
   */
  private emitSupplyEvent(
    sessionId: string,
    fleetId: string,
    type: ISupplyEvent['type'],
    currentValue: number,
    maxValue: number,
    percent: number
  ): void {
    const event: ISupplyEvent = {
      sessionId,
      fleetId,
      type,
      currentValue,
      maxValue,
      percent
    };
    
    this.emit(`supply:${type.toLowerCase()}`, event);
    this.emit('supply:warning', event);
  }

  /**
   * 캐시 클리어
   */
  clearCache(fleetId?: string): void {
    if (fleetId) {
      this.supplyCache.delete(fleetId);
      this.warningsSent.delete(fleetId);
    } else {
      this.supplyCache.clear();
      this.warningsSent.clear();
    }
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    this.supplyCache.clear();
    this.warningsSent.clear();
    this.removeAllListeners();
  }
}

export const supplyService = SupplyService.getInstance();
export default SupplyService;
