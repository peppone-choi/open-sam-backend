/**
 * DamageSystemExtension - 피해 시스템 확장
 * 매뉴얼 기반 구현
 *
 * 기능:
 * - 기함 피해 처리
 * - 함대 유닛 피해 처리
 * - 화물 손실 처리
 * - 전장 수리 / 도크 수리
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum DamageType {
  KINETIC = 'KINETIC',           // 운동에너지 (주포)
  ENERGY = 'ENERGY',             // 에너지 (레이저)
  MISSILE = 'MISSILE',           // 미사일
  TORPEDO = 'TORPEDO',           // 어뢰
  EXPLOSION = 'EXPLOSION',       // 폭발
  COLLISION = 'COLLISION',       // 충돌
  FIGHTER = 'FIGHTER',           // 함재기
}

export enum ComponentType {
  HULL = 'HULL',                 // 선체
  SHIELD = 'SHIELD',             // 방어막
  ENGINE = 'ENGINE',             // 엔진
  WEAPON = 'WEAPON',             // 무장
  SENSOR = 'SENSOR',             // 센서
  CARGO = 'CARGO',               // 화물창
  BRIDGE = 'BRIDGE',             // 함교
  REACTOR = 'REACTOR',           // 반응로
}

export interface DamageEvent {
  sessionId: string;
  targetId: string;              // 유닛 ID
  targetType: 'FLAGSHIP' | 'UNIT' | 'FIGHTER';
  damageType: DamageType;
  rawDamage: number;
  actualDamage: number;
  componentHit?: ComponentType;
  isCritical: boolean;
  sourceId?: string;
  timestamp: Date;
}

export interface RepairRequest {
  sessionId: string;
  fleetId: string;
  unitId?: string;               // 특정 유닛만 수리
  repairType: 'FIELD' | 'DOCK';
  maxCredits?: number;           // 최대 비용 제한
}

export interface RepairResult {
  success: boolean;
  unitsRepaired: number;
  totalCredits: number;
  totalMaterials: number;
  totalTime: number;             // 틱 단위
  details: Array<{
    unitId: string;
    hpRestored: number;
    cost: number;
  }>;
}

// 부위별 치명타 효과
const CRITICAL_EFFECTS: Record<ComponentType, {
  damageMultiplier: number;
  debuff?: string;
}> = {
  [ComponentType.HULL]: { damageMultiplier: 1.5 },
  [ComponentType.SHIELD]: { damageMultiplier: 1.2, debuff: 'SHIELD_DOWN' },
  [ComponentType.ENGINE]: { damageMultiplier: 1.3, debuff: 'SPEED_REDUCED' },
  [ComponentType.WEAPON]: { damageMultiplier: 1.2, debuff: 'FIREPOWER_REDUCED' },
  [ComponentType.SENSOR]: { damageMultiplier: 1.1, debuff: 'SENSOR_JAMMED' },
  [ComponentType.CARGO]: { damageMultiplier: 1.0, debuff: 'CARGO_LOSS' },
  [ComponentType.BRIDGE]: { damageMultiplier: 2.0, debuff: 'COMMAND_DISABLED' },
  [ComponentType.REACTOR]: { damageMultiplier: 3.0, debuff: 'CRITICAL_FAILURE' },
};

// 장갑 유형별 피해 감소율
const ARMOR_RESISTANCE: Record<string, Record<DamageType, number>> = {
  LIGHT: {
    [DamageType.KINETIC]: 0.1,
    [DamageType.ENERGY]: 0.05,
    [DamageType.MISSILE]: 0.15,
    [DamageType.TORPEDO]: 0.2,
    [DamageType.EXPLOSION]: 0.1,
    [DamageType.COLLISION]: 0.3,
    [DamageType.FIGHTER]: 0.05,
  },
  MEDIUM: {
    [DamageType.KINETIC]: 0.2,
    [DamageType.ENERGY]: 0.15,
    [DamageType.MISSILE]: 0.25,
    [DamageType.TORPEDO]: 0.3,
    [DamageType.EXPLOSION]: 0.2,
    [DamageType.COLLISION]: 0.4,
    [DamageType.FIGHTER]: 0.1,
  },
  HEAVY: {
    [DamageType.KINETIC]: 0.35,
    [DamageType.ENERGY]: 0.25,
    [DamageType.MISSILE]: 0.4,
    [DamageType.TORPEDO]: 0.45,
    [DamageType.EXPLOSION]: 0.35,
    [DamageType.COLLISION]: 0.5,
    [DamageType.FIGHTER]: 0.2,
  },
  FORTRESS: {
    [DamageType.KINETIC]: 0.5,
    [DamageType.ENERGY]: 0.4,
    [DamageType.MISSILE]: 0.55,
    [DamageType.TORPEDO]: 0.6,
    [DamageType.EXPLOSION]: 0.5,
    [DamageType.COLLISION]: 0.7,
    [DamageType.FIGHTER]: 0.3,
  },
};

// ============================================================
// DamageSystemExtension Class
// ============================================================

export class DamageSystemExtension extends EventEmitter {
  private static instance: DamageSystemExtension;
  
  // 피해 로그
  private damageLogs: Map<string, DamageEvent[]> = new Map();

  private constructor() {
    super();
    logger.info('[DamageSystemExtension] Initialized');
  }

  public static getInstance(): DamageSystemExtension {
    if (!DamageSystemExtension.instance) {
      DamageSystemExtension.instance = new DamageSystemExtension();
    }
    return DamageSystemExtension.instance;
  }

  // ============================================================
  // 피해 계산
  // ============================================================

  /**
   * 피해 계산 및 적용
   */
  public async applyDamage(
    sessionId: string,
    targetId: string,
    targetType: 'FLAGSHIP' | 'UNIT' | 'FIGHTER',
    damageType: DamageType,
    rawDamage: number,
    sourceId?: string,
    armorType: string = 'MEDIUM',
  ): Promise<DamageEvent> {
    // 1. 장갑 저항 계산
    const resistance = ARMOR_RESISTANCE[armorType]?.[damageType] || 0;
    let actualDamage = Math.floor(rawDamage * (1 - resistance));

    // 2. 치명타 판정
    const isCritical = Math.random() < 0.1; // 10% 확률
    let componentHit: ComponentType | undefined;

    if (isCritical) {
      componentHit = this.rollComponentHit();
      const critEffect = CRITICAL_EFFECTS[componentHit];
      actualDamage = Math.floor(actualDamage * critEffect.damageMultiplier);
    }

    // 3. 피해 이벤트 생성
    const event: DamageEvent = {
      sessionId,
      targetId,
      targetType,
      damageType,
      rawDamage,
      actualDamage,
      componentHit,
      isCritical,
      sourceId,
      timestamp: new Date(),
    };

    // 4. 로그 저장
    const key = `${sessionId}-${targetId}`;
    const logs = this.damageLogs.get(key) || [];
    logs.push(event);
    if (logs.length > 100) logs.shift(); // 최근 100개만 유지
    this.damageLogs.set(key, logs);

    // 5. 이벤트 발생
    this.emit('damage:applied', event);

    // 6. 치명타 디버프 적용
    if (isCritical && componentHit) {
      const debuff = CRITICAL_EFFECTS[componentHit].debuff;
      if (debuff) {
        this.emit('damage:debuff', {
          sessionId,
          targetId,
          debuffType: debuff,
          duration: 30, // 30틱 지속
        });
      }
    }

    logger.debug(`[DamageSystemExtension] Applied ${actualDamage} damage to ${targetId} (raw: ${rawDamage}, critical: ${isCritical})`);

    return event;
  }

  /**
   * 부위 명중 판정
   */
  private rollComponentHit(): ComponentType {
    const weights: Record<ComponentType, number> = {
      [ComponentType.HULL]: 40,
      [ComponentType.SHIELD]: 15,
      [ComponentType.ENGINE]: 15,
      [ComponentType.WEAPON]: 10,
      [ComponentType.SENSOR]: 8,
      [ComponentType.CARGO]: 5,
      [ComponentType.BRIDGE]: 5,
      [ComponentType.REACTOR]: 2,
    };

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;

    for (const [component, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        return component as ComponentType;
      }
    }

    return ComponentType.HULL;
  }

  // ============================================================
  // 기함 피해
  // ============================================================

  /**
   * 기함 피해 처리
   */
  public async applyFlagshipDamage(
    sessionId: string,
    characterId: string,
    damageType: DamageType,
    rawDamage: number,
    sourceId?: string,
  ): Promise<{
    event: DamageEvent;
    flagshipDestroyed: boolean;
    commanderStatus: 'SAFE' | 'INJURED' | 'DEAD';
  }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      throw new Error('Character not found');
    }

    // 기함 HP 확인
    const flagshipHp = character.data?.flagshipHp || 100;
    const flagshipMaxHp = character.data?.flagshipMaxHp || 100;
    const flagshipArmor = character.data?.flagshipArmor || 'MEDIUM';

    // 피해 적용
    const event = await this.applyDamage(
      sessionId,
      characterId,
      'FLAGSHIP',
      damageType,
      rawDamage,
      sourceId,
      flagshipArmor
    );

    const newHp = Math.max(0, flagshipHp - event.actualDamage);
    const flagshipDestroyed = newHp <= 0;

    // HP 업데이트
    if (!character.data) character.data = {};
    character.data.flagshipHp = newHp;

    // 지휘관 상태 판정
    let commanderStatus: 'SAFE' | 'INJURED' | 'DEAD' = 'SAFE';

    if (flagshipDestroyed) {
      // 기함 격침 시 지휘관 생존 확률
      const survivalChance = 0.7; // 70% 생존
      const survived = Math.random() < survivalChance;

      if (survived) {
        const injuryChance = 0.5; // 50% 부상
        commanderStatus = Math.random() < injuryChance ? 'INJURED' : 'SAFE';
        
        if (commanderStatus === 'INJURED') {
          character.status = 'INJURED';
          character.data.injuredAt = new Date();
        }
      } else {
        commanderStatus = 'DEAD';
        character.status = 'DEAD';
        character.data.deathReason = 'FLAGSHIP_DESTROYED';
      }

      // 기함 상실
      character.data.flagshipId = undefined;
      character.data.flagshipType = undefined;
    }

    await character.save();

    this.emit('flagship:damaged', {
      sessionId,
      characterId,
      characterName: character.name,
      damage: event.actualDamage,
      newHp,
      flagshipDestroyed,
      commanderStatus,
    });

    return { event, flagshipDestroyed, commanderStatus };
  }

  // ============================================================
  // 함대 유닛 피해
  // ============================================================

  /**
   * 함대 유닛 피해 처리
   */
  public async applyUnitDamage(
    sessionId: string,
    fleetId: string,
    unitId: string,
    damageType: DamageType,
    rawDamage: number,
    sourceId?: string,
  ): Promise<{
    event: DamageEvent;
    unitDestroyed: boolean;
    shipsLost: number;
    crewCasualties: number;
  }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      throw new Error('Fleet not found');
    }

    const unit = fleet.units?.find(u => u.unitId === unitId);
    if (!unit) {
      throw new Error('Unit not found');
    }

    // 피해 적용
    const armorType = this.getUnitArmorType(unit.shipClass);
    const event = await this.applyDamage(
      sessionId,
      unitId,
      'UNIT',
      damageType,
      rawDamage,
      sourceId,
      armorType
    );

    // HP 감소
    const newHp = Math.max(0, unit.currentHp - event.actualDamage);
    const hpLostPercent = event.actualDamage / unit.maxHp;

    // 함선 손실 계산 (HP 손실 비율에 따라)
    const shipsLost = Math.floor(unit.currentShipCount * hpLostPercent * 0.5);
    const crewCasualties = Math.floor(shipsLost * 100); // 함선당 100명 가정

    unit.currentHp = newHp;
    unit.currentShipCount = Math.max(0, unit.currentShipCount - shipsLost);

    const unitDestroyed = unit.currentShipCount <= 0;

    if (unitDestroyed) {
      // 유닛 제거
      const unitIndex = fleet.units!.indexOf(unit);
      fleet.units!.splice(unitIndex, 1);
    }

    await fleet.save();

    this.emit('unit:damaged', {
      sessionId,
      fleetId,
      unitId,
      damage: event.actualDamage,
      newHp,
      shipsLost,
      crewCasualties,
      unitDestroyed,
    });

    return { event, unitDestroyed, shipsLost, crewCasualties };
  }

  /**
   * 유닛 장갑 유형 결정
   */
  private getUnitArmorType(shipClass: string): string {
    const heavyShips = ['BATTLESHIP', 'CARRIER', 'FORTRESS'];
    const lightShips = ['DESTROYER', 'FIGHTER', 'TRANSPORT'];

    if (heavyShips.some(s => shipClass.includes(s))) return 'HEAVY';
    if (lightShips.some(s => shipClass.includes(s))) return 'LIGHT';
    return 'MEDIUM';
  }

  // ============================================================
  // 화물 손실
  // ============================================================

  /**
   * 화물 손실 처리
   */
  public async applyCargoLoss(
    sessionId: string,
    fleetId: string,
    lossPercent: number,
  ): Promise<{
    creditsLost: number;
    fuelLost: number;
    ammoLost: number;
    materialsLost: number;
  }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet || !fleet.cargo) {
      return { creditsLost: 0, fuelLost: 0, ammoLost: 0, materialsLost: 0 };
    }

    const lossRate = Math.min(1, Math.max(0, lossPercent));

    const creditsLost = Math.floor((fleet.cargo.credits || 0) * lossRate);
    const fuelLost = Math.floor((fleet.cargo.fuel || 0) * lossRate);
    const ammoLost = Math.floor((fleet.cargo.ammo || 0) * lossRate);
    const materialsLost = Math.floor((fleet.cargo.materials || 0) * lossRate);

    fleet.cargo.credits = (fleet.cargo.credits || 0) - creditsLost;
    fleet.cargo.fuel = (fleet.cargo.fuel || 0) - fuelLost;
    fleet.cargo.ammo = (fleet.cargo.ammo || 0) - ammoLost;
    fleet.cargo.materials = (fleet.cargo.materials || 0) - materialsLost;

    await fleet.save();

    this.emit('cargo:lost', {
      sessionId,
      fleetId,
      creditsLost,
      fuelLost,
      ammoLost,
      materialsLost,
    });

    return { creditsLost, fuelLost, ammoLost, materialsLost };
  }

  // ============================================================
  // 수리 시스템
  // ============================================================

  /**
   * 전장 수리 (Field Repair)
   */
  public async fieldRepair(request: RepairRequest): Promise<RepairResult> {
    const { sessionId, fleetId, unitId, maxCredits } = request;

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, unitsRepaired: 0, totalCredits: 0, totalMaterials: 0, totalTime: 0, details: [] };
    }

    // 전장 수리 제한: 최대 50%까지만 회복
    const maxRepairPercent = 0.5;
    const details: RepairResult['details'] = [];
    let totalCredits = 0;
    let totalMaterials = 0;
    let totalTime = 0;

    const unitsToRepair = unitId 
      ? fleet.units?.filter(u => u.unitId === unitId) 
      : fleet.units;

    for (const unit of unitsToRepair || []) {
      if (unit.currentHp >= unit.maxHp) continue;

      const maxRecoverable = Math.floor(unit.maxHp * maxRepairPercent);
      const currentDamage = unit.maxHp - unit.currentHp;
      const repairAmount = Math.min(currentDamage, maxRecoverable - (unit.maxHp - unit.currentHp));

      if (repairAmount <= 0) continue;

      // 비용 계산 (전장 수리는 도크의 2배)
      const costPerHp = 10;
      const repairCost = repairAmount * costPerHp * 2;
      const materialCost = Math.floor(repairAmount * 0.5);
      const repairTime = Math.floor(repairAmount / 10);

      if (maxCredits && totalCredits + repairCost > maxCredits) continue;

      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + repairAmount);
      totalCredits += repairCost;
      totalMaterials += materialCost;
      totalTime = Math.max(totalTime, repairTime);

      details.push({
        unitId: unit.unitId,
        hpRestored: repairAmount,
        cost: repairCost,
      });
    }

    await fleet.save();

    this.emit('repair:field', {
      sessionId,
      fleetId,
      unitsRepaired: details.length,
      totalCredits,
      totalMaterials,
    });

    return {
      success: true,
      unitsRepaired: details.length,
      totalCredits,
      totalMaterials,
      totalTime,
      details,
    };
  }

  /**
   * 도크 수리 (Dock Repair)
   */
  public async dockRepair(request: RepairRequest): Promise<RepairResult> {
    const { sessionId, fleetId, unitId, maxCredits } = request;

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, unitsRepaired: 0, totalCredits: 0, totalMaterials: 0, totalTime: 0, details: [] };
    }

    // 도킹 상태 확인
    if (!fleet.dockedAt) {
      return { success: false, unitsRepaired: 0, totalCredits: 0, totalMaterials: 0, totalTime: 0, details: [] };
    }

    // 도크 수리: 100%까지 회복 가능
    const details: RepairResult['details'] = [];
    let totalCredits = 0;
    let totalMaterials = 0;
    let totalTime = 0;

    const unitsToRepair = unitId 
      ? fleet.units?.filter(u => u.unitId === unitId) 
      : fleet.units;

    for (const unit of unitsToRepair || []) {
      if (unit.currentHp >= unit.maxHp) continue;

      const repairAmount = unit.maxHp - unit.currentHp;

      // 비용 계산
      const costPerHp = 10;
      const repairCost = repairAmount * costPerHp;
      const materialCost = Math.floor(repairAmount * 0.3);
      const repairTime = Math.floor(repairAmount / 20);

      if (maxCredits && totalCredits + repairCost > maxCredits) continue;

      unit.currentHp = unit.maxHp;
      totalCredits += repairCost;
      totalMaterials += materialCost;
      totalTime = Math.max(totalTime, repairTime);

      details.push({
        unitId: unit.unitId,
        hpRestored: repairAmount,
        cost: repairCost,
      });
    }

    await fleet.save();

    this.emit('repair:dock', {
      sessionId,
      fleetId,
      unitsRepaired: details.length,
      totalCredits,
      totalMaterials,
    });

    return {
      success: true,
      unitsRepaired: details.length,
      totalCredits,
      totalMaterials,
      totalTime,
      details,
    };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 피해 로그 조회
   */
  public getDamageLogs(sessionId: string, targetId: string): DamageEvent[] {
    const key = `${sessionId}-${targetId}`;
    return this.damageLogs.get(key) || [];
  }

  /**
   * 세션별 총 피해 통계
   */
  public getSessionDamageStats(sessionId: string): {
    totalDamageDealt: number;
    totalDamageReceived: number;
    criticalHits: number;
    unitsDestroyed: number;
  } {
    let totalDamageDealt = 0;
    let totalDamageReceived = 0;
    let criticalHits = 0;
    let unitsDestroyed = 0;

    for (const [key, logs] of this.damageLogs) {
      if (key.startsWith(sessionId)) {
        for (const log of logs) {
          totalDamageReceived += log.actualDamage;
          if (log.sourceId) totalDamageDealt += log.actualDamage;
          if (log.isCritical) criticalHits++;
        }
      }
    }

    return {
      totalDamageDealt,
      totalDamageReceived,
      criticalHits,
      unitsDestroyed,
    };
  }
}

export const damageSystemExtension = DamageSystemExtension.getInstance();
export default DamageSystemExtension;

