/**
 * FighterCombatService - 전투정 시스템
 * 매뉴얼 2282-2286행: "戦闘艇は現在未実装となっております"
 *
 * 전투정의 공격:
 * - 공격 능력 자체는 크지 않지만, 적 함선의 이동 속도를 저하시키는 효과
 * - 자함을 공격하는 적 전투정을 요격 가능
 * - 전투정 출격 시 일률 10의 군수물자를 소비
 *
 * 또한 매뉴얼 2266행: "攻撃による物資の減少は現在未実装"
 * - 공격 시 물자 소비 시스템 구현
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import { combatSupplyService, CombatSupplyService } from './CombatSupplyService';

/**
 * 전투정 상태
 */
export enum FighterStatus {
  DOCKED = 'DOCKED',           // 모함에 수용
  LAUNCHING = 'LAUNCHING',     // 발진 중
  COMBAT = 'COMBAT',           // 전투 중
  RETURNING = 'RETURNING',     // 귀환 중
  DESTROYED = 'DESTROYED',     // 격추
}

/**
 * 전투정 종류
 */
export enum FighterType {
  FIGHTER = 'FIGHTER',         // 전투정 (戦闘艇)
  TORPEDO = 'TORPEDO',         // 뇌격정 (雷撃艇) - 제국군 전용
}

/**
 * 전투정 유닛
 */
export interface FighterUnit {
  fighterId: string;
  sessionId: string;
  battleId: string;
  carrierUnitId: string;       // 모함 유닛 ID
  ownerCharacterId: string;
  faction: string;
  type: FighterType;
  status: FighterStatus;
  
  // 전투 능력
  count: number;               // 현재 전투정 수
  maxCount: number;            // 최대 전투정 수
  attackPower: number;         // 공격력
  defense: number;             // 방어력
  speed: number;               // 속도
  
  // 위치
  positionX: number;
  positionY: number;
  targetUnitId?: string;       // 공격 대상
  
  // 물자
  ammoRemaining: number;       // 남은 탄약
  fuelRemaining: number;       // 남은 연료
  
  launchTime?: Date;
  returnTime?: Date;
}

/**
 * 모함 전투정 수용 능력
 */
export interface CarrierCapacity {
  unitId: string;
  shipClass: string;
  fighterCapacity: number;     // 전투정 수용량
  torpedoCapacity: number;     // 뇌격정 수용량 (제국)
  currentFighters: number;
  currentTorpedoes: number;
  launchRate: number;          // 발진 속도 (대/분)
  recoveryRate: number;        // 수용 속도 (대/분)
}

/**
 * 공격 물자 소모 정의
 */
export interface AmmoConsumption {
  weaponType: 'BEAM' | 'GUN' | 'MISSILE' | 'FIGHTER' | 'TORPEDO';
  baseConsumption: number;     // 기본 소모량
  description: string;
}

// 무기별 물자 소모량 (매뉴얼 기반)
const AMMO_CONSUMPTION: Record<string, AmmoConsumption> = {
  BEAM: {
    weaponType: 'BEAM',
    baseConsumption: 0,        // 빔은 에너지 소모 (물자X)
    description: '레이저 병기 - 에너지만 소모',
  },
  GUN: {
    weaponType: 'GUN',
    baseConsumption: 5,        // 건 공격당 5 물자
    description: '건 병기 - 탄약 소모',
  },
  MISSILE: {
    weaponType: 'MISSILE',
    baseConsumption: 10,       // 미사일 발사당 10 물자
    description: '미사일 병기 - 미사일 소모',
  },
  FIGHTER: {
    weaponType: 'FIGHTER',
    baseConsumption: 10,       // 전투정 출격당 10 물자 (매뉴얼 명시)
    description: '전투정 출격 - 연료/탄약 소모',
  },
  TORPEDO: {
    weaponType: 'TORPEDO',
    baseConsumption: 15,       // 뇌격정 출격당 15 물자
    description: '뇌격정 출격 - 어뢰/연료 소모',
  },
};

// 전투정 스펙
const FIGHTER_SPECS: Record<FighterType, {
  attackPower: number;
  defense: number;
  speed: number;
  ammo: number;
  fuel: number;
  slowdownEffect: number;      // 적 이동속도 감소율 (%)
}> = {
  [FighterType.FIGHTER]: {
    attackPower: 5,
    defense: 2,
    speed: 150,
    ammo: 50,
    fuel: 100,
    slowdownEffect: 10,        // 10% 속도 감소
  },
  [FighterType.TORPEDO]: {
    attackPower: 15,           // 어뢰는 강력
    defense: 1,
    speed: 100,
    ammo: 20,                  // 적은 어뢰
    fuel: 80,
    slowdownEffect: 5,
  },
};

/**
 * FighterCombatService 클래스
 */
export class FighterCombatService extends EventEmitter {
  private static instance: FighterCombatService;
  
  private fighters: Map<string, FighterUnit[]> = new Map(); // battleId -> FighterUnit[]
  private carrierCapacities: Map<string, CarrierCapacity[]> = new Map(); // battleId -> CarrierCapacity[]

  private constructor() {
    super();
    logger.info('[FighterCombatService] Initialized - 매뉴얼 미구현 기능 완성');
  }

  public static getInstance(): FighterCombatService {
    if (!FighterCombatService.instance) {
      FighterCombatService.instance = new FighterCombatService();
    }
    return FighterCombatService.instance;
  }

  // ==================== 초기화 ====================

  public initializeBattle(battleId: string): void {
    this.fighters.set(battleId, []);
    this.carrierCapacities.set(battleId, []);
    logger.info(`[FighterCombatService] Battle ${battleId} initialized`);
  }

  public cleanupBattle(battleId: string): void {
    this.fighters.delete(battleId);
    this.carrierCapacities.delete(battleId);
    logger.info(`[FighterCombatService] Battle ${battleId} cleaned up`);
  }

  // ==================== 모함 등록 ====================

  /**
   * 모함 전투정 수용 능력 등록
   */
  public registerCarrier(
    battleId: string,
    unitId: string,
    shipClass: string,
    fighterCapacity: number,
    torpedoCapacity: number = 0,
  ): void {
    const capacity: CarrierCapacity = {
      unitId,
      shipClass,
      fighterCapacity,
      torpedoCapacity,
      currentFighters: fighterCapacity,  // 초기에는 만재
      currentTorpedoes: torpedoCapacity,
      launchRate: 10,                     // 분당 10대
      recoveryRate: 5,                    // 분당 5대
    };

    this.carrierCapacities.get(battleId)?.push(capacity);
    logger.info(`[FighterCombatService] Carrier ${unitId} registered with ${fighterCapacity} fighters`);
  }

  // ==================== 전투정 발진 ====================

  /**
   * 전투정 발진 (戦闘艇の出撃)
   * 매뉴얼: "戦闘艇を出撃させると、一律10の軍需物資を消費します"
   * 
   * 물자 소모 흐름:
   * 1. 모함 수용량 확인 (전투정/뇌격정 보유 확인)
   * 2. CombatSupplyService.consumeFighterLaunch 호출 → 연료 차감
   * 3. 연료 부족 시 출격 실패 반환
   * 4. 성공 시 전투정 스폰 (모함 위치 + 오프셋)
   * 
   * @param carrierPosition 모함의 현재 위치 (미제공 시 기본값 0,0)
   */
  public launchFighters(
    battleId: string,
    sessionId: string,
    carrierUnitId: string,
    ownerCharacterId: string,
    faction: string,
    type: FighterType,
    count: number,
    targetUnitId?: string,
    carrierPosition?: { x: number; y: number },
  ): { 
    success: boolean; 
    fighter?: FighterUnit; 
    ammoConsumed: number; 
    remainingSupply?: number;
    error?: string;
  } {
    const carriers = this.carrierCapacities.get(battleId);
    const carrier = carriers?.find(c => c.unitId === carrierUnitId);

    if (!carrier) {
      logger.warn(`[FighterCombatService] Launch failed: Carrier ${carrierUnitId} not found in battle ${battleId}`);
      return { success: false, ammoConsumed: 0, error: '모함을 찾을 수 없습니다.' };
    }

    // 수용량 확인
    const available = type === FighterType.FIGHTER 
      ? carrier.currentFighters 
      : carrier.currentTorpedoes;

    if (available < count) {
      logger.warn(`[FighterCombatService] Launch failed: Not enough ${type}. Available: ${available}, Requested: ${count}`);
      return { success: false, ammoConsumed: 0, error: `전투정이 부족합니다. (보유: ${available}, 요청: ${count})` };
    }

    // 물자 소모 계산
    const consumption = AMMO_CONSUMPTION[type];
    const ammoConsumed = consumption.baseConsumption * count;

    // 실제 유닛 물자에서 차감 (CombatSupplyService 연동)
    const isTorpedo = type === FighterType.TORPEDO;
    const supplyResult = combatSupplyService.consumeFighterLaunch(
      sessionId,
      carrierUnitId,
      count,
      isTorpedo,
    );

    if (!supplyResult.success) {
      logger.warn(`[FighterCombatService] Launch failed: Supply insufficient. Required: ${ammoConsumed}, Error: ${supplyResult.error}`);
      return { 
        success: false, 
        ammoConsumed: 0, 
        remainingSupply: supplyResult.remaining,
        error: supplyResult.error || `물자 부족으로 ${isTorpedo ? '뇌격정' : '전투정'} 출격 불가. (필요: ${ammoConsumed})` 
      };
    }

    // 전투정 생성 - 모함 위치에서 시작 (약간의 랜덤 오프셋 적용)
    const spec = FIGHTER_SPECS[type];
    const baseX = carrierPosition?.x ?? 0;
    const baseY = carrierPosition?.y ?? 0;
    // 겹침 방지를 위한 랜덤 오프셋 (-10 ~ +10)
    const offsetX = (Math.random() - 0.5) * 20;
    const offsetY = (Math.random() - 0.5) * 20;

    const fighter: FighterUnit = {
      fighterId: `FIGHTER-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      battleId,
      carrierUnitId,
      ownerCharacterId,
      faction,
      type,
      status: FighterStatus.LAUNCHING,
      count,
      maxCount: count,
      attackPower: spec.attackPower,
      defense: spec.defense,
      speed: spec.speed,
      positionX: baseX + offsetX,
      positionY: baseY + offsetY,
      targetUnitId,
      ammoRemaining: spec.ammo * count,
      fuelRemaining: spec.fuel * count,
      launchTime: new Date(),
    };

    this.fighters.get(battleId)?.push(fighter);

    // 모함 수용량 감소
    if (type === FighterType.FIGHTER) {
      carrier.currentFighters -= count;
    } else {
      carrier.currentTorpedoes -= count;
    }

    this.emit('fighter:launched', { 
      battleId, 
      fighter, 
      ammoConsumed,
      remainingSupply: supplyResult.remaining,
    });
    
    logger.info(
      `[FighterCombatService] ${count} ${type} launched from ${carrierUnitId}. ` +
      `Ammo consumed: ${ammoConsumed}, Remaining supply: ${supplyResult.remaining}, ` +
      `Position: (${fighter.positionX.toFixed(1)}, ${fighter.positionY.toFixed(1)})`
    );

    return { 
      success: true, 
      fighter, 
      ammoConsumed,
      remainingSupply: supplyResult.remaining,
    };
  }

  // ==================== 전투정 전투 처리 ====================

  /**
   * 전투정 공격 처리
   * 매뉴얼: "攻撃対象が艦艇ユニットであった場合、そのユニットの移動速度を低下させる効果"
   */
  public processFighterCombat(
    battleId: string,
    fighterId: string,
    targetUnitId: string,
  ): { 
    success: boolean; 
    damage: number; 
    speedReduction: number;
    fighterLosses: number;
    error?: string;
  } {
    const fighters = this.fighters.get(battleId);
    const fighter = fighters?.find(f => f.fighterId === fighterId);

    if (!fighter) {
      return { success: false, damage: 0, speedReduction: 0, fighterLosses: 0, error: '전투정을 찾을 수 없습니다.' };
    }

    if (fighter.status !== FighterStatus.COMBAT && fighter.status !== FighterStatus.LAUNCHING) {
      return { success: false, damage: 0, speedReduction: 0, fighterLosses: 0, error: '전투 가능 상태가 아닙니다.' };
    }

    fighter.status = FighterStatus.COMBAT;
    fighter.targetUnitId = targetUnitId;

    // 데미지 계산
    const baseDamage = fighter.attackPower * fighter.count;
    const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4)); // 80-120% 변동

    // 속도 감소 효과
    const spec = FIGHTER_SPECS[fighter.type];
    const speedReduction = spec.slowdownEffect * (fighter.count / fighter.maxCount);

    // 전투정 손실 (적 대공 방어에 의해)
    const lossRate = 0.1 + Math.random() * 0.1; // 10-20% 손실
    const fighterLosses = Math.floor(fighter.count * lossRate);
    fighter.count = Math.max(0, fighter.count - fighterLosses);

    // 탄약 소모
    fighter.ammoRemaining -= fighter.count * 2;

    // 전투정 전멸 시
    if (fighter.count <= 0) {
      fighter.status = FighterStatus.DESTROYED;
      this.emit('fighter:destroyed', { battleId, fighter });
    }

    this.emit('fighter:attacked', { 
      battleId, 
      fighterId, 
      targetUnitId, 
      damage, 
      speedReduction, 
      fighterLosses 
    });

    logger.info(`[FighterCombatService] Fighter ${fighterId} attacked ${targetUnitId}. Damage: ${damage}, Speed -${speedReduction}%`);

    return { success: true, damage, speedReduction, fighterLosses };
  }

  /**
   * 적 전투정 요격
   * 매뉴얼: "自艦を攻撃している敵戦闘艇を攻撃対象にすれば、これの撃退を行います"
   */
  public interceptFighters(
    battleId: string,
    interceptorId: string,
    targetFighterId: string,
  ): { success: boolean; targetLosses: number; interceptorLosses: number; error?: string } {
    const fighters = this.fighters.get(battleId);
    const interceptor = fighters?.find(f => f.fighterId === interceptorId);
    const target = fighters?.find(f => f.fighterId === targetFighterId);

    if (!interceptor || !target) {
      return { success: false, targetLosses: 0, interceptorLosses: 0, error: '전투정을 찾을 수 없습니다.' };
    }

    if (interceptor.faction === target.faction) {
      return { success: false, targetLosses: 0, interceptorLosses: 0, error: '아군 전투정은 요격할 수 없습니다.' };
    }

    // 공중전 계산
    const interceptorPower = interceptor.attackPower * interceptor.count;
    const targetPower = target.attackPower * target.count;
    
    const powerRatio = interceptorPower / (interceptorPower + targetPower);
    
    // 피해 계산
    const targetLossRate = powerRatio * 0.3;
    const interceptorLossRate = (1 - powerRatio) * 0.2;

    const targetLosses = Math.floor(target.count * targetLossRate);
    const interceptorLosses = Math.floor(interceptor.count * interceptorLossRate);

    target.count = Math.max(0, target.count - targetLosses);
    interceptor.count = Math.max(0, interceptor.count - interceptorLosses);

    if (target.count <= 0) {
      target.status = FighterStatus.DESTROYED;
    }
    if (interceptor.count <= 0) {
      interceptor.status = FighterStatus.DESTROYED;
    }

    this.emit('fighter:intercepted', { 
      battleId, 
      interceptorId, 
      targetFighterId, 
      targetLosses, 
      interceptorLosses 
    });

    logger.info(`[FighterCombatService] Interception: ${interceptorId} vs ${targetFighterId}. Losses: ${targetLosses} / ${interceptorLosses}`);

    return { success: true, targetLosses, interceptorLosses };
  }

  // ==================== 전투정 귀환 ====================

  /**
   * 전투정 귀환 명령
   */
  public recallFighters(
    battleId: string,
    fighterId: string,
  ): { success: boolean; error?: string } {
    const fighters = this.fighters.get(battleId);
    const fighter = fighters?.find(f => f.fighterId === fighterId);

    if (!fighter) {
      return { success: false, error: '전투정을 찾을 수 없습니다.' };
    }

    if (fighter.status === FighterStatus.DESTROYED) {
      return { success: false, error: '격추된 전투정입니다.' };
    }

    fighter.status = FighterStatus.RETURNING;
    fighter.targetUnitId = undefined;
    fighter.returnTime = new Date();

    this.emit('fighter:returning', { battleId, fighterId });
    logger.info(`[FighterCombatService] Fighter ${fighterId} returning to carrier`);

    return { success: true };
  }

  /**
   * 전투정 수용 처리
   */
  public dockFighters(
    battleId: string,
    fighterId: string,
  ): { success: boolean; recovered: number; error?: string } {
    const fighters = this.fighters.get(battleId);
    const fighter = fighters?.find(f => f.fighterId === fighterId);
    const carriers = this.carrierCapacities.get(battleId);
    const carrier = carriers?.find(c => c.unitId === fighter?.carrierUnitId);

    if (!fighter || !carrier) {
      return { success: false, recovered: 0, error: '전투정 또는 모함을 찾을 수 없습니다.' };
    }

    if (fighter.status !== FighterStatus.RETURNING) {
      return { success: false, recovered: 0, error: '귀환 중이 아닙니다.' };
    }

    // 모함에 수용
    const recovered = fighter.count;
    if (fighter.type === FighterType.FIGHTER) {
      carrier.currentFighters = Math.min(
        carrier.fighterCapacity,
        carrier.currentFighters + recovered
      );
    } else {
      carrier.currentTorpedoes = Math.min(
        carrier.torpedoCapacity,
        carrier.currentTorpedoes + recovered
      );
    }

    fighter.status = FighterStatus.DOCKED;

    // 전투정 목록에서 제거
    const index = fighters.indexOf(fighter);
    if (index > -1) {
      fighters.splice(index, 1);
    }

    this.emit('fighter:docked', { battleId, fighterId, recovered });
    logger.info(`[FighterCombatService] Fighter ${fighterId} docked. Recovered: ${recovered}`);

    return { success: true, recovered };
  }

  // ==================== 물자 소모 계산 ====================

  /**
   * 무기 발사 시 물자 소모 계산
   * 매뉴얼 2266행: "攻撃による物資の減少は現在未実装"
   */
  public calculateAmmoConsumption(
    weaponType: 'BEAM' | 'GUN' | 'MISSILE',
    fireCount: number = 1,
  ): number {
    const consumption = AMMO_CONSUMPTION[weaponType];
    return consumption.baseConsumption * fireCount;
  }

  /**
   * 유닛 물자 차감 (CombatSupplyService 연동)
   */
  public consumeAmmo(
    sessionId: string,
    battleId: string,
    unitId: string,
    shipClass: string,
    weaponType: 'BEAM' | 'GUN' | 'MISSILE',
    fireCount: number = 1,
  ): { success: boolean; consumed: number; remaining: number; error?: string } {
    // 빔은 물자 소모 없음
    if (weaponType === 'BEAM') {
      combatSupplyService.processBeamAttack(sessionId, unitId);
      this.emit('ammo:consumed', { battleId, unitId, amount: 0, type: 'BEAM' });
      logger.debug(`[FighterCombatService] Unit ${unitId} beam attack - no ammo consumed`);
      return { success: true, consumed: 0, remaining: 0 };
    }

    // 건 공격
    if (weaponType === 'GUN') {
      const result = combatSupplyService.consumeGunAttack(sessionId, unitId, shipClass, fireCount);
      if (result.success) {
        this.emit('ammo:consumed', { battleId, unitId, amount: result.consumed, type: 'GUN' });
        logger.debug(`[FighterCombatService] Unit ${unitId} gun attack: ${result.consumed} ammo consumed`);
      }
      return result;
    }

    // 미사일 공격
    if (weaponType === 'MISSILE') {
      const result = combatSupplyService.consumeMissileAttack(sessionId, unitId, shipClass, fireCount);
      if (result.success) {
        this.emit('ammo:consumed', { battleId, unitId, amount: result.consumed, type: 'MISSILE' });
        logger.debug(`[FighterCombatService] Unit ${unitId} missile attack: ${result.consumed} missiles consumed`);
      }
      return result;
    }

    return { success: false, consumed: 0, remaining: 0, error: '알 수 없는 무기 유형입니다.' };
  }

  // ==================== 조회 ====================

  public getFighters(battleId: string): FighterUnit[] {
    return this.fighters.get(battleId) || [];
  }

  public getFightersByCarrier(battleId: string, carrierUnitId: string): FighterUnit[] {
    return (this.fighters.get(battleId) || []).filter(f => f.carrierUnitId === carrierUnitId);
  }

  public getCarrierCapacity(battleId: string, carrierUnitId: string): CarrierCapacity | undefined {
    return this.carrierCapacities.get(battleId)?.find(c => c.unitId === carrierUnitId);
  }

  public getAmmoConsumptionInfo(): Record<string, AmmoConsumption> {
    return AMMO_CONSUMPTION;
  }
}

export const fighterCombatService = FighterCombatService.getInstance();
export default FighterCombatService;

