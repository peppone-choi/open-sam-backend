/**
 * FortressService - 요새(Fortress) 시스템 관리
 * 
 * 은하영웅전설의 이제르론 요새, 가이에스부르크 요새 등 전략적 요새를 관리합니다.
 * - 요새 생성/조회
 * - 주포 발사 (토르 해머 등)
 * - 수비 함대 배치
 * - 포위전 (공방전)
 * - 요새 점령
 * - 이동 (가이에스부르크만)
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { Fortress, IFortress, IFortressComponentState } from '../../models/gin7/Fortress';
import { Fleet, IFleet, SHIP_SPECS } from '../../models/gin7/Fleet';
import {
  FortressType,
  FortressStatus,
  FortressComponent,
  FORTRESS_SPECS,
  FORTRESS_COMPONENT_HP_RATIO,
  FORTRESS_COMPONENT_EFFECTS,
  MainCannonFireResult,
  FortressDamageResult,
  SiegeState,
  SiegeResult,
  FortressRepairRequest,
  FortressRepairResult,
} from '../../types/gin7/fortress.types';
import { FleetService } from './FleetService';
import { logger } from '../../common/logger';

/**
 * 포위전 세션 관리
 */
interface ActiveSiege extends SiegeState {
  lastUpdateTurn: number;
}

/**
 * 요새 생성 요청
 */
export interface CreateFortressRequest {
  sessionId: string;
  type: FortressType;
  ownerId: string;
  location: IFortress['location'];
  customName?: string;
  commanderId?: string;
}

/**
 * 주포 발사 요청
 */
export interface FireMainCannonRequest {
  sessionId: string;
  fortressId: string;
  targetFleetId: string;
  executedBy: string;
}

/**
 * 포위전 시작 요청
 */
export interface BeginSiegeRequest {
  sessionId: string;
  fortressId: string;
  attackingFleetIds: string[];
  executedBy: string;
}

/**
 * 요새 이동 요청 (가이에스부르크만)
 */
export interface MoveFortressRequest {
  sessionId: string;
  fortressId: string;
  targetSystemId?: string;
  targetCoordinates?: { x: number; y: number };
  executedBy: string;
}

export class FortressService extends EventEmitter {
  // 활성 포위전 세션
  private activeSieges: Map<string, ActiveSiege> = new Map();
  
  constructor() {
    super();
  }
  
  // ============================================================
  // 요새 생성 및 조회
  // ============================================================
  
  /**
   * 새 요새 생성
   */
  async createFortress(request: CreateFortressRequest): Promise<IFortress> {
    const fortressId = `FORT-${uuidv4().slice(0, 8)}`;
    
    const spec = FORTRESS_SPECS[request.type];
    if (!spec) {
      throw new Error(`Invalid fortress type: ${request.type}`);
    }
    
    // 부위별 HP 초기화
    const components: IFortressComponentState[] = Object.entries(FORTRESS_COMPONENT_HP_RATIO)
      .filter(([component]) => {
        // 이동형이 아닌 요새는 ENGINE 부위 제외
        if (component === 'ENGINE' && !spec.canMove) {
          return false;
        }
        return true;
      })
      .map(([component, ratio]) => {
        const componentMaxHp = Math.floor(spec.maxHp * ratio);
        return {
          component: component as FortressComponent,
          hp: componentMaxHp,
          maxHp: componentMaxHp,
          isDestroyed: false,
        };
      });
    
    const fortress = new Fortress({
      fortressId,
      sessionId: request.sessionId,
      type: request.type,
      name: spec.nameKo,
      customName: request.customName,
      ownerId: request.ownerId,
      commanderId: request.commanderId,
      location: request.location,
      status: 'OPERATIONAL',
      currentHp: spec.maxHp,
      maxHp: spec.maxHp,
      currentShield: spec.maxShield,
      maxShield: spec.maxShield,
      shieldRegenRate: spec.shieldRegenRate,
      armor: spec.armor,
      mainCannonReady: true,
      mainCannonCooldown: 0,
      mainCannonPower: spec.mainCannonPower,
      components,
      garrisonFleetIds: [],
      garrisonCapacity: spec.garrisonCapacity,
      fighterCount: 0,
      fighterCapacity: spec.fighterCapacity,
      troopCount: 0,
      troopCapacity: spec.troopCapacity,
      canMove: spec.canMove,
      isMoving: false,
      data: {},
    });
    
    await fortress.save();
    
    logger.info('[FortressService] Fortress created', {
      fortressId,
      type: request.type,
      ownerId: request.ownerId,
    });
    
    this.emit('FORTRESS_CREATED', {
      fortressId,
      type: request.type,
      name: fortress.name,
      ownerId: request.ownerId,
    });
    
    return fortress;
  }
  
  /**
   * 요새 조회
   */
  async getFortress(sessionId: string, fortressId: string): Promise<IFortress | null> {
    return Fortress.findOne({ sessionId, fortressId });
  }
  
  /**
   * 세력 소유 요새 목록
   */
  async getFortressesByOwner(sessionId: string, ownerId: string): Promise<IFortress[]> {
    return Fortress.find({ sessionId, ownerId });
  }
  
  /**
   * 특정 성계의 요새 목록
   */
  async getFortressesInSystem(sessionId: string, systemId: string): Promise<IFortress[]> {
    return Fortress.find({ sessionId, 'location.systemId': systemId });
  }
  
  /**
   * 회랑의 요새 목록
   */
  async getFortressesInCorridor(sessionId: string, corridorId: string): Promise<IFortress[]> {
    return Fortress.find({ sessionId, 'location.corridorId': corridorId });
  }
  
  // ============================================================
  // 주포 시스템 (토르 해머, 가이어파우스트)
  // ============================================================
  
  /**
   * 주포 발사
   */
  async fireMainCannon(request: FireMainCannonRequest): Promise<MainCannonFireResult> {
    const fortress = await Fortress.findOne({
      sessionId: request.sessionId,
      fortressId: request.fortressId,
    });
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    // 주포 사용 가능 여부 체크
    const mainCannonComponent = fortress.components.find(
      c => c.component === 'MAIN_CANNON'
    );
    
    if (!mainCannonComponent || mainCannonComponent.isDestroyed) {
      throw new Error('Main cannon is destroyed');
    }
    
    if (!fortress.mainCannonReady || fortress.mainCannonCooldown > 0) {
      throw new Error(`Main cannon is cooling down (${fortress.mainCannonCooldown} turns remaining)`);
    }
    
    // 대상 함대 조회
    const targetFleet = await Fleet.findOne({
      sessionId: request.sessionId,
      fleetId: request.targetFleetId,
    });
    
    if (!targetFleet) {
      throw new Error('Target fleet not found');
    }
    
    // 사거리 체크 (간소화)
    const spec = FORTRESS_SPECS[fortress.type];
    // TODO: 실제 거리 계산 로직 추가
    
    // 명중 확률 계산 (기본 85%, 대형함 +10%, 소형함 -20%)
    let hitChance = 85;
    const targetHasLargeShips = targetFleet.units.some(
      u => ['battleship', 'carrier', 'flagship'].includes(u.shipClass)
    );
    const targetHasSmallShips = targetFleet.units.some(
      u => ['corvette', 'frigate', 'destroyer'].includes(u.shipClass)
    );
    
    if (targetHasLargeShips) hitChance += 10;
    if (targetHasSmallShips) hitChance -= 10;
    
    // 주포 손상 시 명중률 감소
    const cannonHpRatio = mainCannonComponent.hp / mainCannonComponent.maxHp;
    hitChance *= cannonHpRatio;
    
    const hit = Math.random() * 100 < hitChance;
    const criticalHit = hit && Math.random() < 0.15; // 15% 크리티컬
    
    let damage = 0;
    let shipsDestroyed = 0;
    
    if (hit) {
      // 데미지 계산
      damage = fortress.mainCannonPower * (criticalHit ? 1.5 : 1);
      
      // 반응로 손상 시 화력 감소
      const reactorComponent = fortress.components.find(c => c.component === 'REACTOR');
      if (reactorComponent && reactorComponent.hp < reactorComponent.maxHp) {
        const reactorRatio = reactorComponent.hp / reactorComponent.maxHp;
        damage *= (0.7 + reactorRatio * 0.3);
      }
      
      // 함대에 데미지 적용
      shipsDestroyed = await this.applyDamageToFleet(
        request.sessionId,
        targetFleet,
        damage,
        'FORTRESS_CANNON'
      );
    }
    
    // 주포 쿨다운 설정
    fortress.mainCannonReady = false;
    fortress.mainCannonCooldown = spec.mainCannonCooldown;
    await fortress.save();
    
    const result: MainCannonFireResult = {
      fortressId: fortress.fortressId,
      targetFleetId: request.targetFleetId,
      damage,
      shipsDestroyed,
      hit,
      criticalHit,
      cooldownTurns: spec.mainCannonCooldown,
    };
    
    logger.info('[FortressService] Main cannon fired', {
      fortressId: fortress.fortressId,
      targetFleetId: request.targetFleetId,
      hit,
      damage,
      shipsDestroyed,
    });
    
    this.emit('MAIN_CANNON_FIRED', {
      ...result,
      fortressName: fortress.name,
      cannonType: spec.mainCannonType,
    });
    
    return result;
  }
  
  /**
   * 주포 쿨다운 처리 (턴 종료 시 호출)
   */
  async processMainCannonCooldowns(sessionId: string): Promise<void> {
    const fortresses = await Fortress.find({
      sessionId,
      mainCannonCooldown: { $gt: 0 },
    });
    
    for (const fortress of fortresses) {
      fortress.mainCannonCooldown = Math.max(0, fortress.mainCannonCooldown - 1);
      if (fortress.mainCannonCooldown === 0) {
        fortress.mainCannonReady = true;
        
        this.emit('MAIN_CANNON_READY', {
          fortressId: fortress.fortressId,
          fortressName: fortress.name,
        });
      }
      await fortress.save();
    }
  }
  
  // ============================================================
  // 수비 함대 관리
  // ============================================================
  
  /**
   * 수비 함대 배치
   */
  async assignDefenseFleet(
    sessionId: string,
    fortressId: string,
    fleetId: string
  ): Promise<void> {
    const [fortress, fleet] = await Promise.all([
      Fortress.findOne({ sessionId, fortressId }),
      Fleet.findOne({ sessionId, fleetId }),
    ]);
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    if (!fleet) {
      throw new Error('Fleet not found');
    }
    
    // 이미 배치된 함대인지 확인
    if (fortress.garrisonFleetIds.includes(fleetId)) {
      throw new Error('Fleet is already assigned to this fortress');
    }
    
    // 수용량 확인
    if (fortress.garrisonFleetIds.length >= fortress.garrisonCapacity) {
      throw new Error(`Fortress garrison capacity reached (${fortress.garrisonCapacity})`);
    }
    
    // 같은 세력인지 확인
    if (fortress.ownerId !== fleet.factionId) {
      throw new Error('Fleet belongs to different faction');
    }
    
    // 도킹 베이 상태 확인
    const dockComponent = fortress.components.find(c => c.component === 'DOCK');
    if (dockComponent?.isDestroyed) {
      throw new Error('Fortress dock is destroyed');
    }
    
    // 함대 배치
    fortress.garrisonFleetIds.push(fleetId);
    fleet.status = 'DOCKED';
    fleet.location = {
      type: 'SYSTEM',
      systemId: fortress.location.systemId,
    };
    fleet.statusData = { dockedAt: 'FORTRESS', fortressId };
    
    await Promise.all([fortress.save(), fleet.save()]);
    
    logger.info('[FortressService] Defense fleet assigned', {
      fortressId,
      fleetId,
      totalGarrison: fortress.garrisonFleetIds.length,
    });
    
    this.emit('DEFENSE_FLEET_ASSIGNED', {
      fortressId,
      fleetId,
      fleetName: fleet.name,
      totalGarrison: fortress.garrisonFleetIds.length,
    });
  }
  
  /**
   * 수비 함대 철수
   */
  async removeDefenseFleet(
    sessionId: string,
    fortressId: string,
    fleetId: string
  ): Promise<void> {
    const [fortress, fleet] = await Promise.all([
      Fortress.findOne({ sessionId, fortressId }),
      Fleet.findOne({ sessionId, fleetId }),
    ]);
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    if (!fleet) {
      throw new Error('Fleet not found');
    }
    
    const fleetIndex = fortress.garrisonFleetIds.indexOf(fleetId);
    if (fleetIndex === -1) {
      throw new Error('Fleet is not assigned to this fortress');
    }
    
    // 포위 중에는 철수 불가 (특수 조건 제외)
    if (fortress.status === 'UNDER_SIEGE') {
      throw new Error('Cannot remove fleet while fortress is under siege');
    }
    
    // 함대 철수
    fortress.garrisonFleetIds.splice(fleetIndex, 1);
    fleet.status = 'IDLE';
    fleet.statusData = {};
    
    await Promise.all([fortress.save(), fleet.save()]);
    
    logger.info('[FortressService] Defense fleet removed', {
      fortressId,
      fleetId,
    });
    
    this.emit('DEFENSE_FLEET_REMOVED', {
      fortressId,
      fleetId,
      fleetName: fleet.name,
    });
  }
  
  /**
   * 수비 함대 목록 조회
   */
  async getGarrisonFleets(sessionId: string, fortressId: string): Promise<IFleet[]> {
    const fortress = await Fortress.findOne({ sessionId, fortressId });
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    if (fortress.garrisonFleetIds.length === 0) {
      return [];
    }
    
    return Fleet.find({
      sessionId,
      fleetId: { $in: fortress.garrisonFleetIds },
    });
  }
  
  // ============================================================
  // 포위전 (공방전)
  // ============================================================
  
  /**
   * 포위전 시작
   */
  async beginSiege(request: BeginSiegeRequest): Promise<SiegeState> {
    const fortress = await Fortress.findOne({
      sessionId: request.sessionId,
      fortressId: request.fortressId,
    });
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    if (fortress.status === 'UNDER_SIEGE') {
      throw new Error('Fortress is already under siege');
    }
    
    if (fortress.status === 'DESTROYED') {
      throw new Error('Fortress is destroyed');
    }
    
    // 공격 함대 검증
    const attackingFleets = await Fleet.find({
      sessionId: request.sessionId,
      fleetId: { $in: request.attackingFleetIds },
    });
    
    if (attackingFleets.length === 0) {
      throw new Error('No valid attacking fleets');
    }
    
    // 공격자가 요새 소유자가 아닌지 확인
    const attackerFaction = attackingFleets[0].factionId;
    if (attackerFaction === fortress.ownerId) {
      throw new Error('Cannot siege own fortress');
    }
    
    // 수비 함대 조회
    const defendingFleets = await this.getGarrisonFleets(
      request.sessionId,
      request.fortressId
    );
    
    // 포위전 세션 생성
    const siegeId = `SIEGE-${uuidv4().slice(0, 8)}`;
    const siege: ActiveSiege = {
      siegeId,
      fortressId: request.fortressId,
      attackingFleetIds: request.attackingFleetIds,
      defendingFleetIds: defendingFleets.map(f => f.fleetId),
      progress: 0,
      startTurn: 0, // TODO: 현재 턴 정보 연동
      currentTurn: 0,
      status: 'ACTIVE',
      attackerLosses: { shipsLost: 0, casualtiesTotal: 0 },
      defenderLosses: { shipsLost: 0, casualtiesTotal: 0, shieldDamage: 0, hpDamage: 0 },
      lastUpdateTurn: 0,
    };
    
    // 상태 업데이트
    fortress.status = 'UNDER_SIEGE';
    fortress.siegeId = siegeId;
    await fortress.save();
    
    // 공격 함대 상태 업데이트
    await Fleet.updateMany(
      { sessionId: request.sessionId, fleetId: { $in: request.attackingFleetIds } },
      { status: 'COMBAT', statusData: { siegeId, role: 'ATTACKER' } }
    );
    
    // 수비 함대 상태 업데이트
    await Fleet.updateMany(
      { sessionId: request.sessionId, fleetId: { $in: fortress.garrisonFleetIds } },
      { status: 'COMBAT', statusData: { siegeId, role: 'DEFENDER' } }
    );
    
    this.activeSieges.set(siegeId, siege);
    
    logger.info('[FortressService] Siege begun', {
      siegeId,
      fortressId: request.fortressId,
      attackerCount: attackingFleets.length,
      defenderCount: defendingFleets.length,
    });
    
    this.emit('SIEGE_BEGUN', {
      siegeId,
      fortressId: request.fortressId,
      fortressName: fortress.name,
      attackingFleetIds: request.attackingFleetIds,
      defendingFleetIds: fortress.garrisonFleetIds,
    });
    
    return siege;
  }
  
  /**
   * 포위전 턴 처리
   */
  async processSiegeTurn(sessionId: string, siegeId: string): Promise<SiegeResult | null> {
    const siege = this.activeSieges.get(siegeId);
    if (!siege || siege.status !== 'ACTIVE') {
      return null;
    }
    
    const fortress = await Fortress.findOne({ sessionId, fortressId: siege.fortressId });
    if (!fortress) {
      return this.endSiege(sessionId, siegeId, 'DEFENDED');
    }
    
    // 공격 함대 조회
    const attackingFleets = await Fleet.find({
      sessionId,
      fleetId: { $in: siege.attackingFleetIds },
    });
    
    // 수비 함대 조회
    const defendingFleets = await Fleet.find({
      sessionId,
      fleetId: { $in: siege.defendingFleetIds },
    });
    
    // 공격자 전멸 체크
    const attackerPower = attackingFleets.reduce(
      (sum, f) => sum + FleetService.calculateCombatPower(f),
      0
    );
    
    if (attackerPower === 0 || attackingFleets.length === 0) {
      return this.endSiege(sessionId, siegeId, 'DEFENDED');
    }
    
    // 포위전 전투 처리
    siege.currentTurn++;
    
    // 1. 요새 주포 발사 (쿨다운이면 스킵)
    if (fortress.mainCannonReady && fortress.mainCannonCooldown === 0) {
      // 가장 큰 함대 타겟팅
      const largestAttacker = attackingFleets.reduce((prev, curr) =>
        FleetService.calculateCombatPower(curr) > FleetService.calculateCombatPower(prev) ? curr : prev
      );
      
      try {
        await this.fireMainCannon({
          sessionId,
          fortressId: fortress.fortressId,
          targetFleetId: largestAttacker.fleetId,
          executedBy: 'SIEGE_AUTO',
        });
      } catch {
        // 주포 발사 실패 (쿨다운 등) - 무시
      }
    }
    
    // 2. 요새 자체 포격 (방어 화력)
    const fortressDefenseDamage = Math.floor(fortress.mainCannonPower * 0.1);
    for (const fleet of attackingFleets) {
      const shipsLost = await this.applyDamageToFleet(
        sessionId,
        fleet,
        fortressDefenseDamage / attackingFleets.length,
        'FORTRESS_DEFENSE'
      );
      siege.attackerLosses.shipsLost += shipsLost;
    }
    
    // 3. 수비 함대 vs 공격 함대 교전
    // (간소화: 총 전투력 비교 기반 피해 계산)
    const defenderPower = defendingFleets.reduce(
      (sum, f) => sum + FleetService.calculateCombatPower(f),
      0
    );
    
    // 공격자 → 수비자 데미지
    const attackerDamageToDefender = attackerPower * 0.05;
    for (const fleet of defendingFleets) {
      const shipsLost = await this.applyDamageToFleet(
        sessionId,
        fleet,
        attackerDamageToDefender / Math.max(1, defendingFleets.length),
        'FLEET_COMBAT'
      );
      siege.defenderLosses.shipsLost += shipsLost;
    }
    
    // 수비자 → 공격자 데미지
    const defenderDamageToAttacker = defenderPower * 0.05;
    for (const fleet of attackingFleets) {
      const shipsLost = await this.applyDamageToFleet(
        sessionId,
        fleet,
        defenderDamageToAttacker / Math.max(1, attackingFleets.length),
        'FLEET_COMBAT'
      );
      siege.attackerLosses.shipsLost += shipsLost;
    }
    
    // 4. 공격자 → 요새 데미지
    const damageToFortress = attackerPower * 0.02;
    const fortressDamage = await this.applyDamageToFortress(
      sessionId,
      fortress,
      damageToFortress
    );
    
    siege.defenderLosses.shieldDamage += fortressDamage.shieldDamage;
    siege.defenderLosses.hpDamage += fortressDamage.hpDamage;
    
    // 5. 포위 진행도 업데이트
    // 방어막이 0이면 진행도 증가 속도 2배
    const progressRate = fortress.currentShield <= 0 ? 10 : 5;
    const powerRatio = attackerPower / Math.max(1, defenderPower + fortress.mainCannonPower * 0.1);
    siege.progress = Math.min(100, siege.progress + progressRate * Math.min(2, powerRatio));
    
    // 6. 방어막 재생
    await this.regenerateFortressShield(sessionId, fortress.fortressId);
    
    // 7. 종료 조건 체크
    // 요새 HP 0 또는 진행도 100%
    if (fortress.currentHp <= 0 || siege.progress >= 100) {
      return this.endSiege(sessionId, siegeId, 'CAPTURED', attackingFleets[0]?.factionId);
    }
    
    // 수비자 전멸 시 진행도 가속
    const remainingDefenders = await Fleet.countDocuments({
      sessionId,
      fleetId: { $in: siege.defendingFleetIds },
      status: { $ne: 'DESTROYED' },
    });
    
    if (remainingDefenders === 0 && siege.progress >= 50) {
      siege.progress = Math.min(100, siege.progress + 20);
    }
    
    this.emit('SIEGE_TURN_PROCESSED', {
      siegeId,
      fortressId: siege.fortressId,
      turn: siege.currentTurn,
      progress: siege.progress,
      attackerLosses: siege.attackerLosses,
      defenderLosses: siege.defenderLosses,
    });
    
    return null; // 전투 계속
  }
  
  /**
   * 포위전 종료
   */
  private async endSiege(
    sessionId: string,
    siegeId: string,
    outcome: SiegeResult['outcome'],
    newOwnerId?: string
  ): Promise<SiegeResult> {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error('Siege not found');
    }
    
    const fortress = await Fortress.findOne({ sessionId, fortressId: siege.fortressId });
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    // 포위전 상태 업데이트
    siege.status = outcome === 'CAPTURED' ? 'BREACHED' :
                   outcome === 'DEFENDED' ? 'BROKEN' : 'SURRENDERED';
    
    // 결과 생성
    const result: SiegeResult = {
      siegeId,
      fortressId: siege.fortressId,
      outcome,
      fortressHpPercent: Math.floor((fortress.currentHp / fortress.maxHp) * 100),
      fortressShieldPercent: Math.floor((fortress.currentShield / fortress.maxShield) * 100),
      attackerLosses: {
        ...siege.attackerLosses,
        creditsLost: siege.attackerLosses.shipsLost * 5000, // 추정치
      },
      defenderLosses: {
        ...siege.defenderLosses,
        creditsLost: siege.defenderLosses.shipsLost * 5000,
      },
      newOwnerId: outcome === 'CAPTURED' ? newOwnerId : undefined,
    };
    
    // 점령 성공 시 소유권 이전
    if (outcome === 'CAPTURED' && newOwnerId) {
      await this.captureFortress(sessionId, fortress.fortressId, newOwnerId);
    } else {
      // 포위 해제
      fortress.status = 'OPERATIONAL';
      fortress.siegeId = undefined;
      await fortress.save();
    }
    
    // 함대 상태 복구
    await Fleet.updateMany(
      { sessionId, 'statusData.siegeId': siegeId },
      { $set: { status: 'IDLE' }, $unset: { statusData: '' } }
    );
    
    this.activeSieges.delete(siegeId);
    
    logger.info('[FortressService] Siege ended', {
      siegeId,
      outcome,
      newOwnerId,
    });
    
    this.emit('SIEGE_ENDED', {
      siegeId,
      fortressId: fortress.fortressId,
      fortressName: fortress.name,
      outcome,
      result,
    });
    
    return result;
  }
  
  /**
   * 포위전 철수
   */
  async retreatFromSiege(
    sessionId: string,
    siegeId: string,
    fleetId: string
  ): Promise<void> {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error('Siege not found');
    }
    
    const fleetIndex = siege.attackingFleetIds.indexOf(fleetId);
    if (fleetIndex === -1) {
      throw new Error('Fleet is not part of this siege');
    }
    
    // 철수
    siege.attackingFleetIds.splice(fleetIndex, 1);
    
    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { status: 'IDLE', statusData: {} }
    );
    
    // 모든 공격자 철수 시 포위 종료
    if (siege.attackingFleetIds.length === 0) {
      await this.endSiege(sessionId, siegeId, 'RETREAT');
    }
    
    logger.info('[FortressService] Fleet retreated from siege', {
      siegeId,
      fleetId,
    });
  }
  
  // ============================================================
  // 요새 점령
  // ============================================================
  
  /**
   * 요새 점령 (소유권 이전)
   */
  async captureFortress(
    sessionId: string,
    fortressId: string,
    newOwnerId: string
  ): Promise<void> {
    const fortress = await Fortress.findOne({ sessionId, fortressId });
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    const previousOwner = fortress.ownerId;
    
    // 기존 수비 함대 전원 철수/파괴 처리
    for (const fleetId of fortress.garrisonFleetIds) {
      await Fleet.findOneAndUpdate(
        { sessionId, fleetId },
        { status: 'IDLE', statusData: {} }
      );
    }
    
    // 소유권 이전
    fortress.ownerId = newOwnerId;
    fortress.commanderId = undefined;
    fortress.garrisonFleetIds = [];
    fortress.status = 'OPERATIONAL';
    fortress.siegeId = undefined;
    
    await fortress.save();
    
    logger.info('[FortressService] Fortress captured', {
      fortressId,
      previousOwner,
      newOwnerId,
    });
    
    this.emit('FORTRESS_CAPTURED', {
      fortressId,
      fortressName: fortress.name,
      previousOwner,
      newOwnerId,
    });
  }
  
  // ============================================================
  // 요새 이동 (가이에스부르크 전용)
  // ============================================================
  
  /**
   * 요새 이동 시작
   */
  async beginFortressMovement(request: MoveFortressRequest): Promise<void> {
    const fortress = await Fortress.findOne({
      sessionId: request.sessionId,
      fortressId: request.fortressId,
    });
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    if (!fortress.canMove) {
      throw new Error(`${fortress.name} cannot move`);
    }
    
    if (fortress.status === 'UNDER_SIEGE') {
      throw new Error('Cannot move fortress while under siege');
    }
    
    if (fortress.isMoving) {
      throw new Error('Fortress is already moving');
    }
    
    // ENGINE 부위 상태 확인
    const engineComponent = fortress.components.find(c => c.component === 'ENGINE');
    if (engineComponent?.isDestroyed) {
      throw new Error('Fortress engine is destroyed');
    }
    
    fortress.isMoving = true;
    fortress.status = 'MOVING';
    fortress.movementTarget = {
      systemId: request.targetSystemId,
      coordinates: request.targetCoordinates,
    };
    fortress.movementProgress = 0;
    
    await fortress.save();
    
    logger.info('[FortressService] Fortress movement begun', {
      fortressId: request.fortressId,
      targetSystemId: request.targetSystemId,
    });
    
    this.emit('FORTRESS_MOVEMENT_BEGUN', {
      fortressId: request.fortressId,
      fortressName: fortress.name,
      targetSystemId: request.targetSystemId,
    });
  }
  
  /**
   * 요새 이동 진행 (턴당 처리)
   */
  async processFortressMovement(sessionId: string): Promise<void> {
    const movingFortresses = await Fortress.find({
      sessionId,
      isMoving: true,
      status: 'MOVING',
    });
    
    for (const fortress of movingFortresses) {
      const spec = FORTRESS_SPECS[fortress.type];
      const speed = spec.speed || 1;
      
      // ENGINE 손상 시 속도 감소
      const engineComponent = fortress.components.find(c => c.component === 'ENGINE');
      const engineRatio = engineComponent ? 
        engineComponent.hp / engineComponent.maxHp : 1;
      const actualSpeed = speed * engineRatio;
      
      fortress.movementProgress = Math.min(100, 
        (fortress.movementProgress || 0) + actualSpeed * 20);
      
      if (fortress.movementProgress >= 100) {
        // 도착
        fortress.location = {
          type: fortress.movementTarget?.systemId ? 'SYSTEM' : 'DEEP_SPACE',
          systemId: fortress.movementTarget?.systemId,
          coordinates: fortress.movementTarget?.coordinates,
        };
        fortress.isMoving = false;
        fortress.status = 'OPERATIONAL';
        fortress.movementTarget = undefined;
        fortress.movementProgress = undefined;
        
        this.emit('FORTRESS_ARRIVED', {
          fortressId: fortress.fortressId,
          fortressName: fortress.name,
          systemId: fortress.location.systemId,
        });
      }
      
      await fortress.save();
    }
  }
  
  // ============================================================
  // 데미지 및 수리
  // ============================================================
  
  /**
   * 요새에 데미지 적용
   */
  async applyDamageToFortress(
    sessionId: string,
    fortress: IFortress,
    damage: number
  ): Promise<FortressDamageResult> {
    let remainingDamage = damage;
    let shieldDamage = 0;
    let hpDamage = 0;
    const componentDamage: FortressDamageResult['componentDamage'] = [];
    
    // 1. 방어막 흡수
    if (fortress.currentShield > 0) {
      shieldDamage = Math.min(fortress.currentShield, remainingDamage * 0.8);
      fortress.currentShield -= shieldDamage;
      remainingDamage -= shieldDamage;
    }
    
    // 2. 장갑 감소
    if (fortress.armor > 0) {
      remainingDamage *= (1 - fortress.armor / 1000);
    }
    
    // 3. HP 데미지
    hpDamage = Math.floor(remainingDamage);
    fortress.currentHp = Math.max(0, fortress.currentHp - hpDamage);
    
    // 4. 부위 데미지 (확률적)
    if (hpDamage > 0) {
      for (const component of fortress.components) {
        if (component.isDestroyed) continue;
        
        // 20% 확률로 부위 피격
        if (Math.random() < 0.2) {
          const componentDmg = Math.floor(hpDamage * 0.3);
          component.hp = Math.max(0, component.hp - componentDmg);
          
          const destroyed = component.hp <= 0;
          if (destroyed) {
            component.isDestroyed = true;
            
            this.emit('FORTRESS_COMPONENT_DESTROYED', {
              fortressId: fortress.fortressId,
              component: component.component,
              effects: FORTRESS_COMPONENT_EFFECTS[component.component],
            });
          }
          
          componentDamage.push({
            component: component.component,
            damage: componentDmg,
            destroyed,
          });
        }
      }
    }
    
    // 5. 상태 업데이트
    if (fortress.currentHp <= 0) {
      fortress.status = 'DESTROYED';
    } else if (fortress.currentHp < fortress.maxHp * 0.3) {
      if (fortress.status !== 'UNDER_SIEGE') {
        fortress.status = 'DAMAGED';
      }
    }
    
    await fortress.save();
    
    return {
      fortressId: fortress.fortressId,
      totalDamage: damage,
      shieldDamage,
      hpDamage,
      componentDamage,
      isDestroyed: fortress.currentHp <= 0,
    };
  }
  
  /**
   * 요새 방어막 재생
   */
  async regenerateFortressShield(sessionId: string, fortressId: string): Promise<void> {
    const fortress = await Fortress.findOne({ sessionId, fortressId });
    if (!fortress || fortress.status === 'DESTROYED') return;
    
    // SHIELD_GENERATOR 상태 확인
    const shieldGen = fortress.components.find(c => c.component === 'SHIELD_GENERATOR');
    if (shieldGen?.isDestroyed) return;
    
    const regenRatio = shieldGen ? shieldGen.hp / shieldGen.maxHp : 1;
    const regen = fortress.shieldRegenRate * regenRatio;
    
    fortress.currentShield = Math.min(fortress.maxShield, fortress.currentShield + regen);
    await fortress.save();
  }
  
  /**
   * 요새 수리
   */
  async repairFortress(request: FortressRepairRequest): Promise<FortressRepairResult> {
    const fortress = await Fortress.findOne({
      sessionId: request.sessionId,
      fortressId: request.fortressId,
    });
    
    if (!fortress) {
      throw new Error('Fortress not found');
    }
    
    if (fortress.status === 'UNDER_SIEGE') {
      throw new Error('Cannot repair fortress while under siege');
    }
    
    const repaired: FortressRepairResult['repaired'] = [];
    let totalCreditsCost = 0;
    let totalMineralsCost = 0;
    let totalShipPartsCost = 0;
    
    const componentsToRepair = request.components || 
      fortress.components.map(c => c.component);
    
    for (const comp of componentsToRepair) {
      const component = fortress.components.find(c => c.component === comp);
      if (!component || component.hp >= component.maxHp) continue;
      
      const previousHp = component.hp;
      const repairAmount = request.priority === 'EMERGENCY' ?
        component.maxHp - component.hp :
        Math.min(component.maxHp * 0.2, component.maxHp - component.hp);
      
      component.hp = Math.min(component.maxHp, component.hp + repairAmount);
      component.isDestroyed = false;
      
      // 비용 계산
      const repairRatio = repairAmount / component.maxHp;
      totalCreditsCost += Math.floor(10000 * repairRatio);
      totalMineralsCost += Math.floor(5000 * repairRatio);
      totalShipPartsCost += Math.floor(2000 * repairRatio);
      
      repaired.push({
        component: component.component,
        previousHp,
        currentHp: component.hp,
        maxHp: component.maxHp,
      });
    }
    
    // HP 수리
    if (fortress.currentHp < fortress.maxHp) {
      const hpRepair = request.priority === 'EMERGENCY' ?
        fortress.maxHp - fortress.currentHp :
        Math.min(fortress.maxHp * 0.1, fortress.maxHp - fortress.currentHp);
      
      fortress.currentHp = Math.min(fortress.maxHp, fortress.currentHp + hpRepair);
      
      totalCreditsCost += Math.floor(hpRepair * 0.5);
      totalMineralsCost += Math.floor(hpRepair * 0.3);
    }
    
    // 상태 업데이트
    if (fortress.currentHp >= fortress.maxHp * 0.5) {
      fortress.status = 'OPERATIONAL';
    }
    
    await fortress.save();
    
    logger.info('[FortressService] Fortress repaired', {
      fortressId: request.fortressId,
      componentsRepaired: repaired.length,
    });
    
    return {
      fortressId: fortress.fortressId,
      repaired,
      totalCost: {
        credits: totalCreditsCost,
        minerals: totalMineralsCost,
        shipParts: totalShipPartsCost,
      },
      turnsRemaining: request.priority === 'EMERGENCY' ? 0 : Math.ceil(repaired.length / 2),
    };
  }
  
  // ============================================================
  // 유틸리티
  // ============================================================
  
  /**
   * 함대에 데미지 적용 (주포/방어 화력)
   */
  private async applyDamageToFleet(
    sessionId: string,
    fleet: IFleet,
    damage: number,
    source: 'FORTRESS_CANNON' | 'FORTRESS_DEFENSE' | 'FLEET_COMBAT'
  ): Promise<number> {
    let totalShipsDestroyed = 0;
    let remainingDamage = damage;
    
    for (const unit of fleet.units) {
      if (unit.count <= 0 || remainingDamage <= 0) continue;
      
      const spec = SHIP_SPECS[unit.shipClass];
      const shipHp = spec.maxHp * (unit.hp / 100);
      
      // 함선당 데미지
      const damagePerShip = remainingDamage / Math.max(1, unit.count);
      const shipsDestroyed = Math.floor(damagePerShip / shipHp * unit.count);
      
      if (shipsDestroyed > 0) {
        unit.destroyed += Math.min(shipsDestroyed, unit.count);
        unit.count = Math.max(0, unit.count - shipsDestroyed);
        totalShipsDestroyed += shipsDestroyed;
      }
      
      // 남은 함선 HP 감소
      const hpDamage = (damagePerShip / shipHp) * 100;
      unit.hp = Math.max(0, unit.hp - hpDamage);
      unit.morale = Math.max(0, unit.morale - 10);
      
      remainingDamage *= 0.7; // 데미지 감쇠
    }
    
    // 함대 총 함선 수 재계산
    fleet.totalShips = fleet.units.reduce((sum, u) => sum + u.count, 0);
    
    await fleet.save();
    
    return totalShipsDestroyed;
  }
  
  /**
   * 활성 포위전 목록 조회
   */
  getActiveSieges(sessionId?: string): ActiveSiege[] {
    const sieges = Array.from(this.activeSieges.values());
    // sessionId 필터링은 fortress를 조회해야 하므로 현재는 전체 반환
    return sieges;
  }
  
  /**
   * 포위전 상태 조회
   */
  getSiege(siegeId: string): ActiveSiege | undefined {
    return this.activeSieges.get(siegeId);
  }
}

// 싱글톤 인스턴스
export const fortressService = new FortressService();





