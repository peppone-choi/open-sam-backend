/**
 * FighterService - 전투정(Fighter) 운용 서비스
 * 
 * 기능:
 * - 전투정 그룹 생성 및 관리
 * - 사출(Launch) 및 귀환(Recovery) 처리
 * - 공전(Dogfight) 및 대함 공격 로직
 * - 보급 및 재보충
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FighterGroup,
  IFighterGroup,
  IFighterSquadron,
  FighterType,
  FighterMission,
  FIGHTER_SPECS,
  HANGAR_CAPACITY,
  ANTI_AIR_POWER,
  LAUNCH_DELAY_TICKS,
  RECOVERY_DELAY_TICKS,
  LAUNCH_DEFENSE_PENALTY,
  FIGHTER_FUEL_CONSUMPTION_PER_TICK,
  FIGHTER_AMMO_CONSUMPTION_PER_ATTACK,
  ANTI_SHIP_SPEED_DEBUFF,
  ANTI_SHIP_DEBUFF_DURATION_TICKS,
  getDefaultFighterType,
  canCarryFighters,
  getHangarCapacity,
  calculateDogfightResult,
  calculateAntiShipDamage,
} from '../../models/gin7/Fighter';
import { Fleet, IFleet, IShipUnit, ShipClass } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

// ============================================================================
// 타입 정의
// ============================================================================

export interface LaunchFightersRequest {
  sessionId: string;
  fleetId: string;
  squadronId: string;
  mission: FighterMission;
  targetId?: string;          // 공격 대상 ID
  count?: number;             // 출격 수량 (미지정 시 전체)
  currentTick: number;
}

export interface RecoverFightersRequest {
  sessionId: string;
  fleetId: string;
  squadronId: string;
  currentTick: number;
}

export interface DogfightRequest {
  sessionId: string;
  attackerFleetId: string;
  attackerSquadronId: string;
  defenderFleetId: string;
  defenderSquadronId: string;
  currentTick: number;
}

export interface AntiShipAttackRequest {
  sessionId: string;
  attackerFleetId: string;
  squadronId: string;
  targetFleetId: string;
  targetUnitId: string;
  currentTick: number;
}

export interface FighterActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// FighterService 클래스
// ============================================================================

export class FighterService {
  /**
   * 함대에 전투정 그룹 생성/초기화
   */
  static async initializeFighterGroup(
    sessionId: string,
    fleet: IFleet,
    isEmpire: boolean
  ): Promise<IFighterGroup> {
    const existingGroup = await FighterGroup.findOne({
      sessionId,
      fleetId: fleet.fleetId,
    });
    
    if (existingGroup) {
      return existingGroup;
    }
    
    const groupId = `FG-${uuidv4().slice(0, 8)}`;
    const fighterType = getDefaultFighterType(fleet.factionId, isEmpire);
    const spec = FIGHTER_SPECS[fighterType];
    
    // 각 모함별로 편대 생성
    const squadrons: IFighterSquadron[] = [];
    
    for (const unit of fleet.units) {
      const hangarCapacity = getHangarCapacity(unit.shipClass, isEmpire);
      
      if (hangarCapacity > 0) {
        const squadronId = `SQ-${uuidv4().slice(0, 8)}`;
        
        squadrons.push({
          squadronId,
          type: fighterType,
          motherShipId: unit.unitId,
          fleetId: fleet.fleetId,
          factionId: fleet.factionId,
          
          count: hangarCapacity * unit.count, // 함선 수 * 격납고 용량
          maxCount: hangarCapacity * unit.count,
          activeCount: 0,
          
          mission: 'IDLE',
          
          fuel: spec.fuelCapacity,
          maxFuel: spec.fuelCapacity,
          ammo: spec.ammoCapacity,
          maxAmmo: spec.ammoCapacity,
          
          veterancy: unit.veterancy,
          morale: unit.morale,
          
          losses: { destroyed: 0, pilots: 0 },
        });
      }
    }
    
    const group = new FighterGroup({
      groupId,
      sessionId,
      fleetId: fleet.fleetId,
      factionId: fleet.factionId,
      squadrons,
    });
    
    await group.save();
    
    logger.info('[FighterService] Fighter group initialized', {
      groupId,
      fleetId: fleet.fleetId,
      squadronCount: squadrons.length,
      totalFighters: group.totalFighters,
    });
    
    return group;
  }
  
  /**
   * 전투정 그룹 조회
   */
  static async getFighterGroup(
    sessionId: string,
    fleetId: string
  ): Promise<IFighterGroup | null> {
    return FighterGroup.findOne({ sessionId, fleetId });
  }
  
  /**
   * 전투정 사출 (Launch)
   */
  static async launchFighters(request: LaunchFightersRequest): Promise<FighterActionResult> {
    const { sessionId, fleetId, squadronId, mission, targetId, count, currentTick } = request;
    
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    // 출격 가능한 전투정 수 확인
    const availableCount = squadron.count - squadron.activeCount;
    if (availableCount <= 0) {
      return { success: false, message: '출격 가능한 전투정이 없습니다.' };
    }
    
    // 연료/탄약 확인
    if (squadron.fuel <= 0) {
      return { success: false, message: '연료가 부족합니다.' };
    }
    if (mission === 'ATTACK' && squadron.ammo <= 0) {
      return { success: false, message: '탄약이 부족합니다.' };
    }
    
    // 출격 수량 결정
    const launchCount = Math.min(count || availableCount, availableCount);
    
    // 상태 업데이트
    squadron.activeCount += launchCount;
    squadron.mission = 'LAUNCHING';
    squadron.targetId = targetId;
    squadron.launchStartTick = currentTick;
    squadron.missionStartTick = currentTick + LAUNCH_DELAY_TICKS;
    
    await group.save();
    
    logger.info('[FighterService] Fighters launched', {
      fleetId,
      squadronId,
      launchCount,
      mission,
      targetId,
    });
    
    return {
      success: true,
      message: `${launchCount}대의 전투정이 ${mission} 임무를 위해 출격합니다.`,
      data: {
        launchCount,
        mission,
        targetId,
        launchCompleteTick: currentTick + LAUNCH_DELAY_TICKS,
      },
    };
  }
  
  /**
   * 전투정 귀환 (Recovery)
   */
  static async recoverFighters(request: RecoverFightersRequest): Promise<FighterActionResult> {
    const { sessionId, fleetId, squadronId, currentTick } = request;
    
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    if (squadron.activeCount <= 0) {
      return { success: false, message: '귀환할 전투정이 없습니다.' };
    }
    
    if (squadron.mission === 'RETURNING') {
      return { success: false, message: '이미 귀환 중입니다.' };
    }
    
    // 귀환 시작
    squadron.mission = 'RETURNING';
    squadron.returnETA = currentTick + RECOVERY_DELAY_TICKS;
    squadron.targetId = undefined;
    
    await group.save();
    
    logger.info('[FighterService] Fighters returning', {
      fleetId,
      squadronId,
      activeCount: squadron.activeCount,
      returnETA: squadron.returnETA,
    });
    
    return {
      success: true,
      message: `${squadron.activeCount}대의 전투정이 귀환합니다.`,
      data: {
        activeCount: squadron.activeCount,
        returnETA: squadron.returnETA,
      },
    };
  }
  
  /**
   * 귀환 완료 처리
   */
  static async completeRecovery(
    sessionId: string,
    fleetId: string,
    squadronId: string
  ): Promise<FighterActionResult> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    const recoveredCount = squadron.activeCount;
    
    // 귀환 완료 - 상태 초기화
    squadron.activeCount = 0;
    squadron.mission = 'IDLE';
    squadron.returnETA = undefined;
    squadron.missionStartTick = undefined;
    
    await group.save();
    
    logger.info('[FighterService] Recovery completed', {
      fleetId,
      squadronId,
      recoveredCount,
    });
    
    return {
      success: true,
      message: `${recoveredCount}대의 전투정이 귀환 완료했습니다.`,
      data: { recoveredCount },
    };
  }
  
  /**
   * 사출 완료 처리 - 실제 임무 시작
   */
  static async completeLaunch(
    sessionId: string,
    fleetId: string,
    squadronId: string
  ): Promise<FighterActionResult> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron || squadron.mission !== 'LAUNCHING') {
      return { success: false, message: '사출 중인 편대가 없습니다.' };
    }
    
    // 예약된 임무로 전환
    const targetMission = squadron.targetId ? 'ATTACK' : 'PATROL';
    squadron.mission = targetMission as FighterMission;
    squadron.launchStartTick = undefined;
    
    await group.save();
    
    return {
      success: true,
      message: `전투정이 ${targetMission} 임무를 시작했습니다.`,
      data: {
        mission: targetMission,
        activeCount: squadron.activeCount,
      },
    };
  }
  
  /**
   * 공전 (Dogfight) 실행
   */
  static async executeDogfight(request: DogfightRequest): Promise<FighterActionResult> {
    const {
      sessionId,
      attackerFleetId,
      attackerSquadronId,
      defenderFleetId,
      defenderSquadronId,
    } = request;
    
    // 양측 전투정 그룹 조회
    const [attackerGroup, defenderGroup] = await Promise.all([
      FighterGroup.findOne({ sessionId, fleetId: attackerFleetId }),
      FighterGroup.findOne({ sessionId, fleetId: defenderFleetId }),
    ]);
    
    if (!attackerGroup || !defenderGroup) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const attackerSq = attackerGroup.squadrons.find(sq => sq.squadronId === attackerSquadronId);
    const defenderSq = defenderGroup.squadrons.find(sq => sq.squadronId === defenderSquadronId);
    
    if (!attackerSq || !defenderSq) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    if (attackerSq.activeCount <= 0 || defenderSq.activeCount <= 0) {
      return { success: false, message: '전투 가능한 전투정이 없습니다.' };
    }
    
    // 공전 결과 계산
    const result = calculateDogfightResult(
      attackerSq.type,
      attackerSq.activeCount,
      attackerSq.veterancy,
      defenderSq.type,
      defenderSq.activeCount,
      defenderSq.veterancy
    );
    
    // 손실 적용
    attackerSq.activeCount = Math.max(0, attackerSq.activeCount - result.attackerLosses);
    attackerSq.count = Math.max(0, attackerSq.count - result.attackerLosses);
    attackerSq.losses.destroyed += result.attackerLosses;
    attackerSq.losses.pilots += result.attackerLosses * FIGHTER_SPECS[attackerSq.type].pilotCount;
    
    defenderSq.activeCount = Math.max(0, defenderSq.activeCount - result.defenderLosses);
    defenderSq.count = Math.max(0, defenderSq.count - result.defenderLosses);
    defenderSq.losses.destroyed += result.defenderLosses;
    defenderSq.losses.pilots += result.defenderLosses * FIGHTER_SPECS[defenderSq.type].pilotCount;
    
    // 탄약 소모
    attackerSq.ammo = Math.max(0, attackerSq.ammo - FIGHTER_AMMO_CONSUMPTION_PER_ATTACK);
    defenderSq.ammo = Math.max(0, defenderSq.ammo - FIGHTER_AMMO_CONSUMPTION_PER_ATTACK);
    
    // 사기 감소
    if (result.attackerLosses > 0) {
      attackerSq.morale = Math.max(0, attackerSq.morale - result.attackerLosses * 0.5);
    }
    if (result.defenderLosses > 0) {
      defenderSq.morale = Math.max(0, defenderSq.morale - result.defenderLosses * 0.5);
    }
    
    // 숙련도 증가 (생존자)
    if (attackerSq.activeCount > 0) {
      attackerSq.veterancy = Math.min(100, attackerSq.veterancy + 1);
    }
    if (defenderSq.activeCount > 0) {
      defenderSq.veterancy = Math.min(100, defenderSq.veterancy + 1);
    }
    
    await Promise.all([attackerGroup.save(), defenderGroup.save()]);
    
    const attackerSpec = FIGHTER_SPECS[attackerSq.type];
    const defenderSpec = FIGHTER_SPECS[defenderSq.type];
    
    logger.info('[FighterService] Dogfight executed', {
      attackerFleetId,
      defenderFleetId,
      attackerType: attackerSpec.nameKo,
      defenderType: defenderSpec.nameKo,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
    });
    
    return {
      success: true,
      message: `공전 결과: ${attackerSpec.nameKo} ${result.attackerLosses}기 손실, ` +
               `${defenderSpec.nameKo} ${result.defenderLosses}기 손실`,
      data: {
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        attackerRemaining: attackerSq.activeCount,
        defenderRemaining: defenderSq.activeCount,
      },
    };
  }
  
  /**
   * 대함 공격 실행
   */
  static async executeAntiShipAttack(request: AntiShipAttackRequest): Promise<FighterActionResult> {
    const {
      sessionId,
      attackerFleetId,
      squadronId,
      targetFleetId,
      targetUnitId,
    } = request;
    
    // 공격측 전투정 그룹 조회
    const attackerGroup = await FighterGroup.findOne({ sessionId, fleetId: attackerFleetId });
    if (!attackerGroup) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = attackerGroup.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron || squadron.activeCount <= 0) {
      return { success: false, message: '전투 가능한 전투정이 없습니다.' };
    }
    
    if (squadron.ammo <= 0) {
      return { success: false, message: '탄약이 부족합니다.' };
    }
    
    // 목표 함선 조회
    const targetFleet = await Fleet.findOne({ sessionId, fleetId: targetFleetId });
    if (!targetFleet) {
      return { success: false, message: '목표 함대를 찾을 수 없습니다.' };
    }
    
    const targetUnit = targetFleet.units.find(u => u.unitId === targetUnitId);
    if (!targetUnit || targetUnit.count <= 0) {
      return { success: false, message: '목표 함선을 찾을 수 없습니다.' };
    }
    
    // 대공 화력 계산
    const targetAntiAir = ANTI_AIR_POWER[targetUnit.shipClass] || 20;
    
    // 대함 공격 결과 계산
    const result = calculateAntiShipDamage(
      squadron.type,
      squadron.activeCount,
      squadron.veterancy,
      targetUnit.shipClass,
      targetAntiAir
    );
    
    // 전투정 손실 적용
    squadron.activeCount = Math.max(0, squadron.activeCount - result.fighterLosses);
    squadron.count = Math.max(0, squadron.count - result.fighterLosses);
    squadron.losses.destroyed += result.fighterLosses;
    squadron.losses.pilots += result.fighterLosses * FIGHTER_SPECS[squadron.type].pilotCount;
    
    // 탄약 소모
    squadron.ammo = Math.max(0, squadron.ammo - FIGHTER_AMMO_CONSUMPTION_PER_ATTACK);
    
    // 목표 함선 피해 적용 (HP 비율 감소)
    const hpDamagePercent = Math.min(100, result.damage / 100);
    targetUnit.hp = Math.max(0, targetUnit.hp - hpDamagePercent);
    
    // 속도 감소 디버프 적용
    if (result.speedDebuff) {
      // Fleet의 data 필드에 디버프 정보 저장
      if (!targetFleet.data) {
        targetFleet.data = {};
      }
      targetFleet.data.speedDebuff = {
        value: ANTI_SHIP_SPEED_DEBUFF,
        expiresAtTick: request.currentTick + ANTI_SHIP_DEBUFF_DURATION_TICKS,
      };
    }
    
    // 숙련도 증가
    squadron.veterancy = Math.min(100, squadron.veterancy + 2);
    
    await Promise.all([attackerGroup.save(), targetFleet.save()]);
    
    const fighterSpec = FIGHTER_SPECS[squadron.type];
    
    logger.info('[FighterService] Anti-ship attack executed', {
      attackerFleetId,
      targetFleetId,
      targetUnitId,
      damage: result.damage,
      fighterLosses: result.fighterLosses,
      speedDebuff: result.speedDebuff,
    });
    
    return {
      success: true,
      message: `${fighterSpec.nameKo} ${squadron.activeCount}대가 ${targetUnit.shipClass}에 ` +
               `${result.damage} 피해를 입혔습니다. 손실: ${result.fighterLosses}대` +
               (result.speedDebuff ? ' (속도 감소 적용)' : ''),
      data: {
        damage: result.damage,
        fighterLosses: result.fighterLosses,
        speedDebuff: result.speedDebuff,
        targetHpRemaining: targetUnit.hp,
        activeFightersRemaining: squadron.activeCount,
      },
    };
  }
  
  /**
   * 연료 소모 처리 (매 틱 호출)
   */
  static async consumeFuel(
    sessionId: string,
    fleetId: string
  ): Promise<void> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) return;
    
    let hasChanges = false;
    
    for (const squadron of group.squadrons) {
      if (squadron.activeCount > 0 && squadron.mission !== 'IDLE') {
        squadron.fuel = Math.max(0, squadron.fuel - FIGHTER_FUEL_CONSUMPTION_PER_TICK);
        hasChanges = true;
        
        // 연료 고갈 시 강제 귀환
        if (squadron.fuel <= 0) {
          squadron.mission = 'RETURNING';
          logger.warn('[FighterService] Squadron out of fuel, forcing return', {
            fleetId,
            squadronId: squadron.squadronId,
          });
        }
      }
    }
    
    if (hasChanges) {
      await group.save();
    }
  }
  
  /**
   * 보급 (착함 후 연료/탄약 보충)
   */
  static async resupplySquadron(
    sessionId: string,
    fleetId: string,
    squadronId: string
  ): Promise<FighterActionResult> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    if (squadron.mission !== 'IDLE') {
      return { success: false, message: '대기 중인 편대만 보급할 수 있습니다.' };
    }
    
    const fuelResupplied = squadron.maxFuel - squadron.fuel;
    const ammoResupplied = squadron.maxAmmo - squadron.ammo;
    
    squadron.fuel = squadron.maxFuel;
    squadron.ammo = squadron.maxAmmo;
    
    await group.save();
    
    return {
      success: true,
      message: `보급 완료: 연료 ${fuelResupplied.toFixed(1)}, 탄약 ${ammoResupplied}`,
      data: {
        fuelResupplied,
        ammoResupplied,
      },
    };
  }
  
  /**
   * 전투정 보충 (신규 전투정 배치)
   */
  static async reinforceSquadron(
    sessionId: string,
    fleetId: string,
    squadronId: string,
    additionalCount: number
  ): Promise<FighterActionResult> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return { success: false, message: '전투정 그룹을 찾을 수 없습니다.' };
    }
    
    const squadron = group.squadrons.find(sq => sq.squadronId === squadronId);
    if (!squadron) {
      return { success: false, message: '편대를 찾을 수 없습니다.' };
    }
    
    const currentTotal = squadron.count;
    const canAdd = squadron.maxCount - currentTotal;
    
    if (canAdd <= 0) {
      return { success: false, message: '격납고가 가득 찼습니다.' };
    }
    
    const actualAdd = Math.min(additionalCount, canAdd);
    squadron.count += actualAdd;
    
    await group.save();
    
    return {
      success: true,
      message: `${actualAdd}대의 전투정이 배치되었습니다.`,
      data: {
        added: actualAdd,
        currentCount: squadron.count,
        maxCount: squadron.maxCount,
      },
    };
  }
  
  /**
   * 함대의 모든 전투정 현황 조회
   */
  static async getFleetFighterStatus(
    sessionId: string,
    fleetId: string
  ): Promise<{
    totalFighters: number;
    activeFighters: number;
    squadrons: Array<{
      squadronId: string;
      type: FighterType;
      typeName: string;
      motherShipId: string;
      count: number;
      maxCount: number;
      activeCount: number;
      mission: FighterMission;
      fuel: number;
      maxFuel: number;
      ammo: number;
      maxAmmo: number;
      veterancy: number;
      morale: number;
      losses: { destroyed: number; pilots: number };
    }>;
  } | null> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) {
      return null;
    }
    
    return {
      totalFighters: group.totalFighters,
      activeFighters: group.totalActive,
      squadrons: group.squadrons.map(sq => ({
        squadronId: sq.squadronId,
        type: sq.type,
        typeName: FIGHTER_SPECS[sq.type].nameKo,
        motherShipId: sq.motherShipId,
        count: sq.count,
        maxCount: sq.maxCount,
        activeCount: sq.activeCount,
        mission: sq.mission,
        fuel: sq.fuel,
        maxFuel: sq.maxFuel,
        ammo: sq.ammo,
        maxAmmo: sq.maxAmmo,
        veterancy: sq.veterancy,
        morale: sq.morale,
        losses: sq.losses,
      })),
    };
  }
  
  /**
   * 모함 격추 시 탑재 전투정 손실 처리
   */
  static async handleMotherShipDestroyed(
    sessionId: string,
    fleetId: string,
    motherShipId: string
  ): Promise<void> {
    const group = await FighterGroup.findOne({ sessionId, fleetId });
    if (!group) return;
    
    const squadron = group.squadrons.find(sq => sq.motherShipId === motherShipId);
    if (!squadron) return;
    
    // 격납고 내 전투정 전멸
    const lostInHangar = squadron.count - squadron.activeCount;
    
    squadron.losses.destroyed += lostInHangar;
    squadron.losses.pilots += lostInHangar * FIGHTER_SPECS[squadron.type].pilotCount;
    squadron.count = squadron.activeCount; // 출격 중인 것만 남음
    squadron.maxCount = 0; // 모함이 없으므로 더 이상 수용 불가
    
    // 출격 중인 전투정은 궤도를 잃음 (일정 시간 후 귀환 불가)
    if (squadron.activeCount > 0) {
      squadron.mission = 'DESTROYED'; // 특수 상태: 모함 상실
    }
    
    await group.save();
    
    logger.warn('[FighterService] Mother ship destroyed', {
      fleetId,
      motherShipId,
      lostInHangar,
      strandedInSpace: squadron.activeCount,
    });
  }
}

export default FighterService;













