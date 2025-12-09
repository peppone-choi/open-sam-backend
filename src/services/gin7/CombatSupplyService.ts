/**
 * CombatSupplyService - 전투 물자 소모 시스템
 * 매뉴얼 2266행: "攻撃による物資の減少は現在未実装となっております"
 *
 * 매뉴얼 기반 물자 소모:
 * - ガン攻撃: "艦艇ユニットのガン消費の値だけの軍需物資を消費します"
 * - ミサイル攻撃: "艦艇ユニットのミサイル消費の値だけの軍需物資を消費します"
 * - 戦闘艇: "戦闘艇を出撃させると、一律10の軍需物資を消費します"
 *
 * 이 서비스는 전투 중 공격, 수리, 보급 등에서 발생하는 물자 소모를 관리합니다.
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

/**
 * 무기 유형
 */
export enum WeaponType {
  BEAM = 'BEAM',           // 빔 병기 (에너지)
  GUN = 'GUN',             // 건 병기 (탄약)
  MISSILE = 'MISSILE',     // 미사일
  TORPEDO = 'TORPEDO',     // 어뢰 (뇌격정용)
  FIGHTER = 'FIGHTER',     // 전투정
  FORTRESS_CANNON = 'FORTRESS_CANNON', // 요새포 (트르니히트포 등)
}

/**
 * 물자 유형
 */
export enum SupplyType {
  AMMUNITION = 'AMMUNITION',     // 탄약
  MISSILES = 'MISSILES',         // 미사일
  FUEL = 'FUEL',                 // 연료
  REPAIR_PARTS = 'REPAIR_PARTS', // 수리 부품
  PROVISIONS = 'PROVISIONS',     // 식량/생활물자
}

/**
 * 함선별 무기 소모량 정의
 */
export interface ShipWeaponConsumption {
  shipClass: string;
  shipType: string;
  
  // 무기별 소모량 (1회 발사당)
  beamConsumption: number;      // 빔: 에너지 소모 (물자 X)
  gunConsumption: number;       // 건: 탄약 소모
  missileConsumption: number;   // 미사일 소모
  
  // 최대 탄약 적재량
  maxAmmunition: number;
  maxMissiles: number;
  
  // 유지 비용 (1턴당)
  maintenanceCost: number;
}

/**
 * 유닛 물자 상태
 */
export interface UnitSupplyStatus {
  unitId: string;
  sessionId: string;
  battleId?: string;
  
  // 현재 물자량
  currentAmmunition: number;
  currentMissiles: number;
  currentFuel: number;
  currentRepairParts: number;
  
  // 최대 적재량
  maxAmmunition: number;
  maxMissiles: number;
  maxFuel: number;
  maxRepairParts: number;
  
  // 상태
  isAmmoLow: boolean;          // 탄약 부족 경고
  isMissileLow: boolean;       // 미사일 부족 경고
  isFuelLow: boolean;          // 연료 부족 경고
  
  lastUpdated: Date;
}

/**
 * 물자 소모 기록
 */
export interface SupplyConsumptionLog {
  logId: string;
  sessionId: string;
  battleId?: string;
  unitId: string;
  
  consumptionType: 'ATTACK' | 'REPAIR' | 'MOVEMENT' | 'FIGHTER_LAUNCH' | 'RESUPPLY';
  weaponType?: WeaponType;
  supplyType: SupplyType;
  amount: number;
  
  timestamp: Date;
  description: string;
}

// 함급별 무기 소모량 정의 (매뉴얼 기반 추정)
const SHIP_CONSUMPTION_TABLE: Record<string, ShipWeaponConsumption> = {
  // 제국군 함선
  'IMPERIAL_BATTLESHIP': {
    shipClass: 'IMPERIAL_BATTLESHIP',
    shipType: 'BATTLESHIP',
    beamConsumption: 0,       // 빔은 에너지만
    gunConsumption: 8,        // 건 발사당 8
    missileConsumption: 15,   // 미사일 발사당 15
    maxAmmunition: 500,
    maxMissiles: 100,
    maintenanceCost: 10,
  },
  'IMPERIAL_FAST_BATTLESHIP': {
    shipClass: 'IMPERIAL_FAST_BATTLESHIP',
    shipType: 'FAST_BATTLESHIP',
    beamConsumption: 0,
    gunConsumption: 6,
    missileConsumption: 12,
    maxAmmunition: 400,
    maxMissiles: 80,
    maintenanceCost: 12,
  },
  'IMPERIAL_CRUISER': {
    shipClass: 'IMPERIAL_CRUISER',
    shipType: 'CRUISER',
    beamConsumption: 0,
    gunConsumption: 5,
    missileConsumption: 10,
    maxAmmunition: 300,
    maxMissiles: 60,
    maintenanceCost: 6,
  },
  'IMPERIAL_DESTROYER': {
    shipClass: 'IMPERIAL_DESTROYER',
    shipType: 'DESTROYER',
    beamConsumption: 0,
    gunConsumption: 3,
    missileConsumption: 8,
    maxAmmunition: 200,
    maxMissiles: 40,
    maintenanceCost: 4,
  },
  'IMPERIAL_CARRIER': {
    shipClass: 'IMPERIAL_CARRIER',
    shipType: 'CARRIER',
    beamConsumption: 0,
    gunConsumption: 2,
    missileConsumption: 5,
    maxAmmunition: 150,
    maxMissiles: 30,
    maintenanceCost: 15,
  },
  
  // 동맹군 함선
  'ALLIANCE_BATTLESHIP': {
    shipClass: 'ALLIANCE_BATTLESHIP',
    shipType: 'BATTLESHIP',
    beamConsumption: 0,
    gunConsumption: 7,
    missileConsumption: 14,
    maxAmmunition: 480,
    maxMissiles: 90,
    maintenanceCost: 9,
  },
  'ALLIANCE_STRIKE_CRUISER': {
    shipClass: 'ALLIANCE_STRIKE_CRUISER',
    shipType: 'STRIKE_CRUISER',
    beamConsumption: 0,
    gunConsumption: 6,
    missileConsumption: 12,
    maxAmmunition: 350,
    maxMissiles: 70,
    maintenanceCost: 8,
  },
  'ALLIANCE_CRUISER': {
    shipClass: 'ALLIANCE_CRUISER',
    shipType: 'CRUISER',
    beamConsumption: 0,
    gunConsumption: 5,
    missileConsumption: 10,
    maxAmmunition: 280,
    maxMissiles: 55,
    maintenanceCost: 5,
  },
  'ALLIANCE_DESTROYER': {
    shipClass: 'ALLIANCE_DESTROYER',
    shipType: 'DESTROYER',
    beamConsumption: 0,
    gunConsumption: 3,
    missileConsumption: 7,
    maxAmmunition: 180,
    maxMissiles: 35,
    maintenanceCost: 3,
  },
  'ALLIANCE_CARRIER': {
    shipClass: 'ALLIANCE_CARRIER',
    shipType: 'CARRIER',
    beamConsumption: 0,
    gunConsumption: 2,
    missileConsumption: 5,
    maxAmmunition: 140,
    maxMissiles: 25,
    maintenanceCost: 14,
  },
};

// 전투정/뇌격정 소모량 (매뉴얼: 일률 10)
const FIGHTER_LAUNCH_COST = 10;
const TORPEDO_LAUNCH_COST = 15;

// 요새포 소모량
const FORTRESS_CANNON_COST = 100;

/**
 * CombatSupplyService 클래스
 */
export class CombatSupplyService extends EventEmitter {
  private static instance: CombatSupplyService;
  
  private unitSupplies: Map<string, UnitSupplyStatus[]> = new Map(); // sessionId -> UnitSupplyStatus[]
  private consumptionLogs: Map<string, SupplyConsumptionLog[]> = new Map(); // sessionId -> logs

  private constructor() {
    super();
    logger.info('[CombatSupplyService] Initialized - 매뉴얼 미구현 기능 (공격 물자 소모) 완성');
  }

  public static getInstance(): CombatSupplyService {
    if (!CombatSupplyService.instance) {
      CombatSupplyService.instance = new CombatSupplyService();
    }
    return CombatSupplyService.instance;
  }

  // ==================== 초기화 ====================

  public initializeSession(sessionId: string): void {
    this.unitSupplies.set(sessionId, []);
    this.consumptionLogs.set(sessionId, []);
    logger.info(`[CombatSupplyService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.unitSupplies.delete(sessionId);
    this.consumptionLogs.delete(sessionId);
  }

  // ==================== 유닛 물자 초기화 ====================

  /**
   * 유닛 물자 상태 초기화
   */
  public initializeUnitSupply(
    sessionId: string,
    unitId: string,
    shipClass: string,
    initialSupplyRatio: number = 1.0, // 0-1, 기본 100%
  ): UnitSupplyStatus {
    const specs = SHIP_CONSUMPTION_TABLE[shipClass] || SHIP_CONSUMPTION_TABLE['IMPERIAL_CRUISER'];
    
    const supply: UnitSupplyStatus = {
      unitId,
      sessionId,
      currentAmmunition: Math.floor(specs.maxAmmunition * initialSupplyRatio),
      currentMissiles: Math.floor(specs.maxMissiles * initialSupplyRatio),
      currentFuel: 1000 * initialSupplyRatio,
      currentRepairParts: 100 * initialSupplyRatio,
      maxAmmunition: specs.maxAmmunition,
      maxMissiles: specs.maxMissiles,
      maxFuel: 1000,
      maxRepairParts: 100,
      isAmmoLow: false,
      isMissileLow: false,
      isFuelLow: false,
      lastUpdated: new Date(),
    };

    this.unitSupplies.get(sessionId)?.push(supply);
    this.emit('supply:unitInitialized', { sessionId, unitId, supply });
    
    return supply;
  }

  // ==================== 공격 물자 소모 ====================

  /**
   * 건 공격 시 물자 소모
   * 매뉴얼: "ガン攻撃を行うと、艦艇ユニットのガン消費の値だけの軍需物資を消費します"
   */
  public consumeGunAttack(
    sessionId: string,
    unitId: string,
    shipClass: string,
    shotCount: number = 1,
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      return { success: false, consumed: 0, remaining: 0, error: '유닛 물자 정보를 찾을 수 없습니다.' };
    }

    const specs = SHIP_CONSUMPTION_TABLE[shipClass] || SHIP_CONSUMPTION_TABLE['IMPERIAL_CRUISER'];
    const consumeAmount = specs.gunConsumption * shotCount;

    if (supply.currentAmmunition < consumeAmount) {
      return { 
        success: false, 
        consumed: 0, 
        remaining: supply.currentAmmunition, 
        error: `탄약 부족! (필요: ${consumeAmount}, 보유: ${supply.currentAmmunition})` 
      };
    }

    supply.currentAmmunition -= consumeAmount;
    supply.isAmmoLow = supply.currentAmmunition < supply.maxAmmunition * 0.2;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'ATTACK',
      weaponType: WeaponType.GUN,
      supplyType: SupplyType.AMMUNITION,
      amount: consumeAmount,
      description: `건 공격 ${shotCount}회 - 탄약 ${consumeAmount} 소모`,
    });

    if (supply.isAmmoLow) {
      this.emit('supply:ammoLow', { sessionId, unitId, remaining: supply.currentAmmunition });
    }

    this.emit('supply:consumed', { 
      sessionId, 
      unitId, 
      type: 'GUN', 
      amount: consumeAmount, 
      remaining: supply.currentAmmunition 
    });

    logger.debug(`[CombatSupplyService] Unit ${unitId} gun attack: ${consumeAmount} ammo consumed. Remaining: ${supply.currentAmmunition}`);

    return { success: true, consumed: consumeAmount, remaining: supply.currentAmmunition };
  }

  /**
   * 미사일 공격 시 물자 소모
   * 매뉴얼: "ミサイル攻撃を行うと、艦艇ユニットのミサイル消費の値だけの軍需物資を消費します"
   */
  public consumeMissileAttack(
    sessionId: string,
    unitId: string,
    shipClass: string,
    missileCount: number = 1,
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      return { success: false, consumed: 0, remaining: 0, error: '유닛 물자 정보를 찾을 수 없습니다.' };
    }

    const specs = SHIP_CONSUMPTION_TABLE[shipClass] || SHIP_CONSUMPTION_TABLE['IMPERIAL_CRUISER'];
    const consumeAmount = specs.missileConsumption * missileCount;

    if (supply.currentMissiles < consumeAmount) {
      return { 
        success: false, 
        consumed: 0, 
        remaining: supply.currentMissiles, 
        error: `미사일 부족! (필요: ${consumeAmount}, 보유: ${supply.currentMissiles})` 
      };
    }

    supply.currentMissiles -= consumeAmount;
    supply.isMissileLow = supply.currentMissiles < supply.maxMissiles * 0.2;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'ATTACK',
      weaponType: WeaponType.MISSILE,
      supplyType: SupplyType.MISSILES,
      amount: consumeAmount,
      description: `미사일 공격 ${missileCount}회 - 미사일 ${consumeAmount} 소모`,
    });

    if (supply.isMissileLow) {
      this.emit('supply:missileLow', { sessionId, unitId, remaining: supply.currentMissiles });
    }

    this.emit('supply:consumed', { 
      sessionId, 
      unitId, 
      type: 'MISSILE', 
      amount: consumeAmount, 
      remaining: supply.currentMissiles 
    });

    logger.debug(`[CombatSupplyService] Unit ${unitId} missile attack: ${consumeAmount} missiles consumed. Remaining: ${supply.currentMissiles}`);

    return { success: true, consumed: consumeAmount, remaining: supply.currentMissiles };
  }

  /**
   * 빔 공격 시 처리 (물자 소모 없음 - 에너지만)
   * 매뉴얼: 빔 공격은 에너지 충전 시간이 필요하지만 물자는 소모하지 않음
   */
  public processBeamAttack(
    sessionId: string,
    unitId: string,
  ): { success: boolean; message: string } {
    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'ATTACK',
      weaponType: WeaponType.BEAM,
      supplyType: SupplyType.AMMUNITION,
      amount: 0,
      description: '빔 공격 - 에너지 소모 (물자 소모 없음)',
    });

    this.emit('supply:beamFired', { sessionId, unitId });
    
    return { success: true, message: '빔 공격 실행. 물자 소모 없음.' };
  }

  /**
   * 전투정 발진 시 물자 소모
   * 매뉴얼: "戦闘艇を出撃させると、一律10の軍需物資を消費します"
   * 
   * 소모 규칙:
   * - 전투정(FIGHTER): 10 물자/대
   * - 뇌격정(TORPEDO): 15 물자/대 (제국군 전용)
   * 
   * 반환값:
   * - success: 출격 성공 여부
   * - consumed: 실제 소모된 물자량
   * - remaining: 출격 후 잔여 연료
   * - error: 실패 시 에러 메시지
   * 
   * @example
   * // 성공 케이스: 전투정 5대 출격 (50 물자 소모)
   * const result = consumeFighterLaunch(sessionId, unitId, 5, false);
   * // { success: true, consumed: 50, remaining: 950 }
   * 
   * // 실패 케이스: 연료 부족
   * const result = consumeFighterLaunch(sessionId, unitId, 100, false);
   * // { success: false, consumed: 0, remaining: 30, error: '연료 부족! (필요: 1000, 보유: 30)' }
   */
  public consumeFighterLaunch(
    sessionId: string,
    unitId: string,
    fighterCount: number = 1,
    isTorpedo: boolean = false,
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      logger.warn(`[CombatSupplyService] Fighter launch failed: Unit ${unitId} supply not found in session ${sessionId}`);
      return { success: false, consumed: 0, remaining: 0, error: '유닛 물자 정보를 찾을 수 없습니다.' };
    }

    const costPerUnit = isTorpedo ? TORPEDO_LAUNCH_COST : FIGHTER_LAUNCH_COST;
    const consumeAmount = costPerUnit * fighterCount;
    const fighterType = isTorpedo ? '뇌격정' : '전투정';

    // 연료에서 소모
    if (supply.currentFuel < consumeAmount) {
      logger.info(
        `[CombatSupplyService] ${fighterType} launch FAILED: ` +
        `Unit ${unitId}, Required: ${consumeAmount}, Available: ${supply.currentFuel}`
      );
      return { 
        success: false, 
        consumed: 0, 
        remaining: supply.currentFuel, 
        error: `연료 부족! (필요: ${consumeAmount}, 보유: ${supply.currentFuel})` 
      };
    }

    const previousFuel = supply.currentFuel;
    supply.currentFuel -= consumeAmount;
    supply.isFuelLow = supply.currentFuel < supply.maxFuel * 0.2;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'FIGHTER_LAUNCH',
      weaponType: isTorpedo ? WeaponType.TORPEDO : WeaponType.FIGHTER,
      supplyType: SupplyType.FUEL,
      amount: consumeAmount,
      description: `${fighterType} ${fighterCount}대 발진 - 물자 ${consumeAmount} 소모 (일률 ${costPerUnit}/대)`,
    });

    if (supply.isFuelLow) {
      logger.warn(`[CombatSupplyService] Unit ${unitId} fuel LOW: ${supply.currentFuel}/${supply.maxFuel}`);
      this.emit('supply:fuelLow', { sessionId, unitId, remaining: supply.currentFuel });
    }

    this.emit('supply:consumed', { 
      sessionId, 
      unitId, 
      type: 'FIGHTER', 
      amount: consumeAmount, 
      remaining: supply.currentFuel 
    });

    logger.info(
      `[CombatSupplyService] ${fighterType} launch SUCCESS: ` +
      `Unit ${unitId}, Count: ${fighterCount}, Consumed: ${consumeAmount}, ` +
      `Fuel: ${previousFuel} → ${supply.currentFuel}`
    );

    return { success: true, consumed: consumeAmount, remaining: supply.currentFuel };
  }

  /**
   * 요새포 발사 시 물자 소모
   */
  public consumeFortressCannon(
    sessionId: string,
    fortressId: string,
  ): { success: boolean; consumed: number; error?: string } {
    // 요새는 별도 관리되므로 이벤트만 발생
    this.logConsumption(sessionId, {
      unitId: fortressId,
      consumptionType: 'ATTACK',
      weaponType: WeaponType.FORTRESS_CANNON,
      supplyType: SupplyType.AMMUNITION,
      amount: FORTRESS_CANNON_COST,
      description: `요새포 발사 - 물자 ${FORTRESS_CANNON_COST} 소모`,
    });

    this.emit('supply:consumed', { 
      sessionId, 
      unitId: fortressId, 
      type: 'FORTRESS_CANNON', 
      amount: FORTRESS_CANNON_COST 
    });

    logger.info(`[CombatSupplyService] Fortress ${fortressId} cannon fired: ${FORTRESS_CANNON_COST} supply consumed`);

    return { success: true, consumed: FORTRESS_CANNON_COST };
  }

  // ==================== 이동 연료 소모 ====================

  /**
   * 이동 시 연료 소모
   */
  public consumeMovementFuel(
    sessionId: string,
    unitId: string,
    distance: number,
    speed: number,
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      return { success: false, consumed: 0, remaining: 0, error: '유닛 물자 정보를 찾을 수 없습니다.' };
    }

    // 이동 연료 계산: 거리 * 속도 계수
    const fuelConsumption = Math.floor(distance * (1 + speed / 100));

    if (supply.currentFuel < fuelConsumption) {
      return { 
        success: false, 
        consumed: 0, 
        remaining: supply.currentFuel, 
        error: `연료 부족! (필요: ${fuelConsumption}, 보유: ${supply.currentFuel})` 
      };
    }

    supply.currentFuel -= fuelConsumption;
    supply.isFuelLow = supply.currentFuel < supply.maxFuel * 0.2;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'MOVEMENT',
      supplyType: SupplyType.FUEL,
      amount: fuelConsumption,
      description: `이동 ${distance}km - 연료 ${fuelConsumption} 소모`,
    });

    if (supply.isFuelLow) {
      this.emit('supply:fuelLow', { sessionId, unitId, remaining: supply.currentFuel });
    }

    return { success: true, consumed: fuelConsumption, remaining: supply.currentFuel };
  }

  // ==================== 수리 물자 소모 ====================

  /**
   * 수리 시 물자 소모
   */
  public consumeRepair(
    sessionId: string,
    unitId: string,
    damagePercentage: number, // 수리할 손상 비율 (0-100)
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      return { success: false, consumed: 0, remaining: 0, error: '유닛 물자 정보를 찾을 수 없습니다.' };
    }

    // 수리 부품 소모 계산
    const partsConsumption = Math.ceil(damagePercentage * 0.5);

    if (supply.currentRepairParts < partsConsumption) {
      return { 
        success: false, 
        consumed: 0, 
        remaining: supply.currentRepairParts, 
        error: `수리 부품 부족! (필요: ${partsConsumption}, 보유: ${supply.currentRepairParts})` 
      };
    }

    supply.currentRepairParts -= partsConsumption;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'REPAIR',
      supplyType: SupplyType.REPAIR_PARTS,
      amount: partsConsumption,
      description: `${damagePercentage}% 손상 수리 - 수리 부품 ${partsConsumption} 소모`,
    });

    return { success: true, consumed: partsConsumption, remaining: supply.currentRepairParts };
  }

  // ==================== 보급 ====================

  /**
   * 유닛 보급
   */
  public resupplyUnit(
    sessionId: string,
    unitId: string,
    supplies: Partial<{
      ammunition: number;
      missiles: number;
      fuel: number;
      repairParts: number;
    }>,
  ): { success: boolean; supplied: typeof supplies } {
    const supply = this.getUnitSupply(sessionId, unitId);
    if (!supply) {
      return { success: false, supplied: {} };
    }

    const actualSupplied: typeof supplies = {};

    if (supplies.ammunition) {
      const added = Math.min(supplies.ammunition, supply.maxAmmunition - supply.currentAmmunition);
      supply.currentAmmunition += added;
      actualSupplied.ammunition = added;
    }

    if (supplies.missiles) {
      const added = Math.min(supplies.missiles, supply.maxMissiles - supply.currentMissiles);
      supply.currentMissiles += added;
      actualSupplied.missiles = added;
    }

    if (supplies.fuel) {
      const added = Math.min(supplies.fuel, supply.maxFuel - supply.currentFuel);
      supply.currentFuel += added;
      actualSupplied.fuel = added;
    }

    if (supplies.repairParts) {
      const added = Math.min(supplies.repairParts, supply.maxRepairParts - supply.currentRepairParts);
      supply.currentRepairParts += added;
      actualSupplied.repairParts = added;
    }

    // 경고 상태 갱신
    supply.isAmmoLow = supply.currentAmmunition < supply.maxAmmunition * 0.2;
    supply.isMissileLow = supply.currentMissiles < supply.maxMissiles * 0.2;
    supply.isFuelLow = supply.currentFuel < supply.maxFuel * 0.2;
    supply.lastUpdated = new Date();

    this.logConsumption(sessionId, {
      unitId,
      consumptionType: 'RESUPPLY',
      supplyType: SupplyType.AMMUNITION, // 대표로
      amount: 0, // 보급은 마이너스
      description: `보급 완료: 탄약 +${actualSupplied.ammunition || 0}, 미사일 +${actualSupplied.missiles || 0}, 연료 +${actualSupplied.fuel || 0}`,
    });

    this.emit('supply:resupplied', { sessionId, unitId, supplied: actualSupplied });
    logger.info(`[CombatSupplyService] Unit ${unitId} resupplied`);

    return { success: true, supplied: actualSupplied };
  }

  // ==================== 유틸리티 ====================

  private getUnitSupply(sessionId: string, unitId: string): UnitSupplyStatus | undefined {
    return this.unitSupplies.get(sessionId)?.find(s => s.unitId === unitId);
  }

  private logConsumption(
    sessionId: string,
    log: Omit<SupplyConsumptionLog, 'logId' | 'sessionId' | 'timestamp'>,
  ): void {
    const fullLog: SupplyConsumptionLog = {
      logId: `SUPPLY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      ...log,
      timestamp: new Date(),
    };
    this.consumptionLogs.get(sessionId)?.push(fullLog);
  }

  // ==================== 조회 ====================

  public getUnitSupplyStatus(sessionId: string, unitId: string): UnitSupplyStatus | undefined {
    return this.getUnitSupply(sessionId, unitId);
  }

  public getAllUnitSupplies(sessionId: string): UnitSupplyStatus[] {
    return this.unitSupplies.get(sessionId) || [];
  }

  public getConsumptionLogs(sessionId: string, unitId?: string, limit: number = 100): SupplyConsumptionLog[] {
    const logs = this.consumptionLogs.get(sessionId) || [];
    const filtered = unitId ? logs.filter(l => l.unitId === unitId) : logs;
    return filtered.slice(-limit);
  }

  public getShipConsumptionSpecs(shipClass: string): ShipWeaponConsumption | undefined {
    return SHIP_CONSUMPTION_TABLE[shipClass];
  }

  public getTotalConsumption(sessionId: string, battleId?: string): {
    totalAmmo: number;
    totalMissiles: number;
    totalFuel: number;
  } {
    const logs = this.consumptionLogs.get(sessionId) || [];
    const filtered = battleId ? logs.filter(l => l.battleId === battleId) : logs;

    return filtered.reduce((acc, log) => {
      switch (log.supplyType) {
        case SupplyType.AMMUNITION:
          acc.totalAmmo += log.amount;
          break;
        case SupplyType.MISSILES:
          acc.totalMissiles += log.amount;
          break;
        case SupplyType.FUEL:
          acc.totalFuel += log.amount;
          break;
      }
      return acc;
    }, { totalAmmo: 0, totalMissiles: 0, totalFuel: 0 });
  }
}

export const combatSupplyService = CombatSupplyService.getInstance();
export default CombatSupplyService;





