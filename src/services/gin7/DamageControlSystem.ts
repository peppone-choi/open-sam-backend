/**
 * DamageControlSystem - 함선 부위별 데미지, 수리, 유폭 시스템
 * 
 * gin7-damage-control 에이전트 구현
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Vector3,
  UnitState,
  ShipComponent,
  ShipComponents,
  ComponentHealth,
  DEFAULT_COMPONENTS,
  DEFAULT_CARRIER_COMPONENTS,
  DebuffType,
  DebuffEffect,
  DEBUFF_EFFECTS,
  ActiveDebuff,
  RepairType,
  RepairTask,
  REPAIR_COSTS,
  EXPLOSION_RADIUS,
  EXPLOSION_DAMAGE,
  ChainExplosionEvent,
} from '../../types/gin7/tactical.types';
import { ShipClass, SHIP_SPECS } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

// ============================================================
// Extended UnitState with Components
// ============================================================

/**
 * 부위별 데미지를 포함한 확장 유닛 상태
 */
export interface ExtendedUnitState extends UnitState {
  components: ShipComponents;
  activeDebuffs: ActiveDebuff[];
  isUncontrollable: boolean;  // 함교 파괴 시
  repairTask?: RepairTask;    // 현재 수리 작업
}

// ============================================================
// Component Hit Probability
// ============================================================

/**
 * 부위별 피격 확률 (기본)
 */
const COMPONENT_HIT_PROBABILITY: Record<ShipComponent, number> = {
  HULL: 0.40,       // 40% - 가장 큰 면적
  ENGINE: 0.20,     // 20% - 후방
  BRIDGE: 0.15,     // 15% - 상부
  MAIN_WEAPON: 0.20,// 20% - 전방
  HANGAR: 0.05,     // 5% - 항모 전용
};

/**
 * 후방 공격 시 부위별 피격 확률
 */
const REAR_HIT_PROBABILITY: Record<ShipComponent, number> = {
  HULL: 0.30,
  ENGINE: 0.45,     // 후방 공격 시 엔진 피격률 증가
  BRIDGE: 0.10,
  MAIN_WEAPON: 0.10,
  HANGAR: 0.05,
};

/**
 * 전방 공격 시 부위별 피격 확률
 */
const FRONT_HIT_PROBABILITY: Record<ShipComponent, number> = {
  HULL: 0.30,
  ENGINE: 0.05,
  BRIDGE: 0.20,
  MAIN_WEAPON: 0.40,  // 전방 공격 시 주포 피격률 증가
  HANGAR: 0.05,
};

// ============================================================
// DamageControlSystem Class
// ============================================================

export class DamageControlSystem extends EventEmitter {
  private units: Map<string, ExtendedUnitState> = new Map();
  private repairTasks: Map<string, RepairTask> = new Map();
  private currentTick: number = 0;

  constructor() {
    super();
  }

  /**
   * 유닛 초기화 (부위별 HP 설정)
   */
  initializeUnit(unit: UnitState): ExtendedUnitState {
    const isCarrier = unit.shipClass === 'carrier';
    
    const extendedUnit: ExtendedUnitState = {
      ...unit,
      components: isCarrier 
        ? { ...DEFAULT_CARRIER_COMPONENTS }
        : { ...DEFAULT_COMPONENTS },
      activeDebuffs: [],
      isUncontrollable: false,
    };

    this.units.set(unit.id, extendedUnit);
    return extendedUnit;
  }

  /**
   * 유닛 상태 조회
   */
  getUnit(unitId: string): ExtendedUnitState | undefined {
    return this.units.get(unitId);
  }

  /**
   * 현재 틱 업데이트
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  // ============================================================
  // Damage Processing
  // ============================================================

  /**
   * 부위별 데미지 적용
   * @param targetId 피격 유닛 ID
   * @param damage 총 데미지
   * @param attackDirection 공격 방향 ('FRONT' | 'REAR' | 'SIDE')
   * @param sourceId 공격자 ID
   * @returns 실제 적용된 데미지 및 피격 부위
   */
  applyComponentDamage(
    targetId: string,
    damage: number,
    attackDirection: 'FRONT' | 'REAR' | 'SIDE',
    sourceId: string
  ): { 
    appliedDamage: number; 
    hitComponent: ShipComponent;
    componentDestroyed: boolean;
    unitDestroyed: boolean;
  } {
    const unit = this.units.get(targetId);
    if (!unit || unit.isDestroyed) {
      return { 
        appliedDamage: 0, 
        hitComponent: 'HULL', 
        componentDestroyed: false,
        unitDestroyed: false 
      };
    }

    // 1. 피격 부위 결정
    const hitComponent = this.determineHitComponent(unit, attackDirection);
    
    // 2. 부위에 데미지 적용
    const componentDamage = this.calculateComponentDamage(unit, hitComponent, damage);
    this.applyDamageToComponent(unit, hitComponent, componentDamage);

    // 3. 부위 파괴 확인 및 디버프 적용
    const componentDestroyed = this.checkComponentDestruction(unit, hitComponent);
    
    // 4. 선체 HP 감소 (부위 데미지의 일부가 선체로 전달)
    const hullDamage = Math.floor(componentDamage * 0.3);
    unit.hp = Math.max(0, unit.hp - hullDamage);

    // 5. 유닛 파괴 확인
    const unitDestroyed = unit.hp <= 0 || unit.components.hull.current <= 0;
    if (unitDestroyed) {
      unit.isDestroyed = true;
    }

    // 이벤트 발생
    this.emit('COMPONENT_DAMAGE', {
      targetId,
      sourceId,
      hitComponent,
      damage: componentDamage,
      remainingHp: unit.components[this.componentKeyMap(hitComponent)].current,
      componentDestroyed,
      unitDestroyed,
      tick: this.currentTick,
    });

    logger.debug('[DamageControl] Component damage applied', {
      targetId,
      hitComponent,
      damage: componentDamage,
      componentDestroyed,
    });

    return {
      appliedDamage: componentDamage,
      hitComponent,
      componentDestroyed,
      unitDestroyed,
    };
  }

  /**
   * 피격 부위 결정 (확률 기반)
   */
  private determineHitComponent(
    unit: ExtendedUnitState,
    attackDirection: 'FRONT' | 'REAR' | 'SIDE'
  ): ShipComponent {
    let probabilities: Record<ShipComponent, number>;
    
    switch (attackDirection) {
      case 'FRONT':
        probabilities = { ...FRONT_HIT_PROBABILITY };
        break;
      case 'REAR':
        probabilities = { ...REAR_HIT_PROBABILITY };
        break;
      default:
        probabilities = { ...COMPONENT_HIT_PROBABILITY };
    }

    // 항모가 아니면 격납고 확률을 선체에 합산
    if (unit.shipClass !== 'carrier') {
      probabilities.HULL += probabilities.HANGAR;
      probabilities.HANGAR = 0;
    }

    // 이미 파괴된 부위의 확률을 선체에 재분배
    const components = unit.components;
    if (components.engine.isDestroyed) {
      probabilities.HULL += probabilities.ENGINE;
      probabilities.ENGINE = 0;
    }
    if (components.bridge.isDestroyed) {
      probabilities.HULL += probabilities.BRIDGE;
      probabilities.BRIDGE = 0;
    }
    if (components.mainWeapon.isDestroyed) {
      probabilities.HULL += probabilities.MAIN_WEAPON;
      probabilities.MAIN_WEAPON = 0;
    }
    if (components.hangar?.isDestroyed) {
      probabilities.HULL += probabilities.HANGAR;
      probabilities.HANGAR = 0;
    }

    // 확률 기반 선택
    const roll = Math.random();
    let cumulative = 0;

    for (const [component, prob] of Object.entries(probabilities)) {
      cumulative += prob;
      if (roll < cumulative) {
        return component as ShipComponent;
      }
    }

    return 'HULL';
  }

  /**
   * 부위별 데미지 계산 (함급/부위에 따른 보정)
   */
  private calculateComponentDamage(
    unit: ExtendedUnitState,
    component: ShipComponent,
    baseDamage: number
  ): number {
    // 함급별 내구도 배율
    const durabilityMultiplier: Record<ShipClass, number> = {
      flagship: 1.5,
      battleship: 1.3,
      carrier: 1.1,
      cruiser: 1.0,
      destroyer: 0.8,
      frigate: 0.7,
      corvette: 0.6,
      transport: 0.9,
      engineering: 0.8,
    };

    // 부위별 데미지 배율
    const componentMultiplier: Record<ShipComponent, number> = {
      HULL: 1.0,
      ENGINE: 1.2,      // 엔진은 더 취약
      BRIDGE: 1.5,      // 함교는 가장 취약
      MAIN_WEAPON: 1.1,
      HANGAR: 1.3,
    };

    const shipDurability = durabilityMultiplier[unit.shipClass] ?? 1.0;
    const componentVulnerability = componentMultiplier[component] ?? 1.0;

    // 최종 데미지 = 기본 데미지 / 함급 내구도 * 부위 취약성
    return Math.floor((baseDamage / shipDurability) * componentVulnerability);
  }

  /**
   * 부위에 데미지 적용
   */
  private applyDamageToComponent(
    unit: ExtendedUnitState,
    component: ShipComponent,
    damage: number
  ): void {
    const key = this.componentKeyMap(component);
    const comp = unit.components[key];
    
    if (comp && !comp.isDestroyed) {
      comp.current = Math.max(0, comp.current - damage);
    }
  }

  /**
   * 부위 파괴 확인 및 디버프 적용
   */
  private checkComponentDestruction(
    unit: ExtendedUnitState,
    component: ShipComponent
  ): boolean {
    const key = this.componentKeyMap(component);
    const comp = unit.components[key];
    
    if (!comp || comp.isDestroyed) return false;

    // 50% 이하면 손상 디버프
    if (comp.current <= 50 && comp.current > 0) {
      this.applyDamagedDebuff(unit, component);
    }

    // 0%면 파괴
    if (comp.current <= 0) {
      comp.isDestroyed = true;
      this.applyDestroyedDebuff(unit, component);
      
      // 함교 파괴 시 Uncontrollable 상태
      if (component === 'BRIDGE') {
        unit.isUncontrollable = true;
      }

      this.emit('COMPONENT_DESTROYED', {
        unitId: unit.id,
        component,
        tick: this.currentTick,
      });

      return true;
    }

    return false;
  }

  /**
   * 손상 디버프 적용 (50% 이하)
   */
  private applyDamagedDebuff(unit: ExtendedUnitState, component: ShipComponent): void {
    const debuffMap: Record<ShipComponent, DebuffType> = {
      HULL: 'ENGINE_DAMAGED',  // 선체 손상 → 기관 영향
      ENGINE: 'ENGINE_DAMAGED',
      BRIDGE: 'BRIDGE_DAMAGED',
      MAIN_WEAPON: 'WEAPON_DAMAGED',
      HANGAR: 'HANGAR_DAMAGED',
    };

    const debuffType = debuffMap[component];
    if (!debuffType) return;

    // 이미 해당 디버프가 있으면 스킵
    if (unit.activeDebuffs.some(d => d.type === debuffType)) return;

    unit.activeDebuffs.push({
      type: debuffType,
      appliedAt: this.currentTick,
    });

    this.emit('DEBUFF_APPLIED', {
      unitId: unit.id,
      debuffType,
      tick: this.currentTick,
    });
  }

  /**
   * 파괴 디버프 적용 (0%)
   */
  private applyDestroyedDebuff(unit: ExtendedUnitState, component: ShipComponent): void {
    const debuffMap: Record<ShipComponent, DebuffType> = {
      HULL: 'ENGINE_DESTROYED',
      ENGINE: 'ENGINE_DESTROYED',
      BRIDGE: 'BRIDGE_DESTROYED',
      MAIN_WEAPON: 'WEAPON_DESTROYED',
      HANGAR: 'HANGAR_DESTROYED',
    };

    const debuffType = debuffMap[component];
    if (!debuffType) return;

    // 손상 디버프 제거 후 파괴 디버프 추가
    const damagedDebuff = debuffType.replace('_DESTROYED', '_DAMAGED') as DebuffType;
    unit.activeDebuffs = unit.activeDebuffs.filter(d => d.type !== damagedDebuff);

    unit.activeDebuffs.push({
      type: debuffType,
      appliedAt: this.currentTick,
    });

    this.emit('DEBUFF_APPLIED', {
      unitId: unit.id,
      debuffType,
      tick: this.currentTick,
    });
  }

  /**
   * ShipComponent → components 키 매핑
   */
  private componentKeyMap(component: ShipComponent): keyof ShipComponents {
    const map: Record<ShipComponent, keyof ShipComponents> = {
      HULL: 'hull',
      ENGINE: 'engine',
      BRIDGE: 'bridge',
      MAIN_WEAPON: 'mainWeapon',
      HANGAR: 'hangar',
    };
    return map[component];
  }

  // ============================================================
  // Debuff Effects
  // ============================================================

  /**
   * 유닛의 모든 디버프 효과 합산 계산
   */
  calculateDebuffEffects(unit: ExtendedUnitState): DebuffEffect {
    const combined: DebuffEffect = {
      type: 'ENGINE_DAMAGED',  // placeholder
      speedMultiplier: 1.0,
      attackMultiplier: 1.0,
      accuracyMultiplier: 1.0,
      evasionMultiplier: 1.0,
      canReceiveOrders: true,
      canLaunchFighters: true,
    };

    for (const debuff of unit.activeDebuffs) {
      const effect = DEBUFF_EFFECTS[debuff.type];
      if (!effect) continue;

      // 가장 낮은 배율 적용 (누적)
      combined.speedMultiplier = Math.min(combined.speedMultiplier, effect.speedMultiplier);
      combined.attackMultiplier = Math.min(combined.attackMultiplier, effect.attackMultiplier);
      combined.accuracyMultiplier = Math.min(combined.accuracyMultiplier, effect.accuracyMultiplier);
      combined.evasionMultiplier = Math.min(combined.evasionMultiplier, effect.evasionMultiplier);
      
      // 불리한 조건은 하나라도 있으면 적용
      if (!effect.canReceiveOrders) combined.canReceiveOrders = false;
      if (!effect.canLaunchFighters) combined.canLaunchFighters = false;
    }

    return combined;
  }

  /**
   * 유닛이 명령을 받을 수 있는지 확인
   */
  canReceiveOrders(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    
    if (unit.isUncontrollable) return false;
    
    const effects = this.calculateDebuffEffects(unit);
    return effects.canReceiveOrders;
  }

  // ============================================================
  // Repair System
  // ============================================================

  /**
   * 수리 작업 시작
   */
  startRepair(
    targetUnitId: string,
    repairShipId: string,
    targetComponent: ShipComponent,
    repairType: RepairType = 'FIELD'
  ): { success: boolean; message: string; task?: RepairTask } {
    const target = this.units.get(targetUnitId);
    const repairShip = this.units.get(repairShipId);

    // 검증
    if (!target) {
      return { success: false, message: '수리 대상 유닛을 찾을 수 없습니다.' };
    }
    if (!repairShip || repairShip.shipClass !== 'engineering') {
      return { success: false, message: '공작함이 아닙니다.' };
    }
    if (repairShip.isDestroyed) {
      return { success: false, message: '공작함이 파괴되었습니다.' };
    }
    if (target.isDestroyed) {
      return { success: false, message: '대상 유닛이 파괴되었습니다.' };
    }

    // 이미 수리 중인지 확인
    if (target.repairTask) {
      return { success: false, message: '이미 수리 중입니다.' };
    }

    // 부위 상태 확인
    const componentKey = this.componentKeyMap(targetComponent);
    const component = target.components[componentKey];
    if (!component) {
      return { success: false, message: '해당 부위가 없습니다.' };
    }
    if (component.current >= component.max) {
      return { success: false, message: '해당 부위는 손상되지 않았습니다.' };
    }

    // 수리 비용 계산
    const cost = REPAIR_COSTS[targetComponent];
    const damageAmount = component.max - component.current;
    const repairTime = Math.ceil((damageAmount / 100) * cost.time);
    const materialCost = Math.ceil((damageAmount / 100) * cost.materials);

    // 야전 수리 시 페널티
    const timeMultiplier = repairType === 'EMERGENCY' ? 2.0 : repairType === 'FIELD' ? 1.0 : 0.5;
    const adjustedTime = Math.ceil(repairTime * timeMultiplier);

    // 수리 작업 생성
    const task: RepairTask = {
      targetUnitId,
      repairShipId,
      repairType,
      targetComponent,
      startTick: this.currentTick,
      estimatedEndTick: this.currentTick + adjustedTime,
      repairRate: damageAmount / adjustedTime,
      materialCost,
      progress: 0,
    };

    target.repairTask = task;
    this.repairTasks.set(targetUnitId, task);

    // 수리 중 디버프 적용
    target.activeDebuffs.push({
      type: 'REPAIRING',
      appliedAt: this.currentTick,
      duration: adjustedTime,
    });

    this.emit('REPAIR_STARTED', {
      targetUnitId,
      repairShipId,
      targetComponent,
      estimatedTime: adjustedTime,
      tick: this.currentTick,
    });

    logger.info('[DamageControl] Repair started', {
      targetUnitId,
      repairShipId,
      targetComponent,
      estimatedTime: adjustedTime,
    });

    return { success: true, message: '수리를 시작합니다.', task };
  }

  /**
   * 수리 작업 처리 (매 틱 호출)
   */
  processRepairTasks(): void {
    for (const [unitId, task] of this.repairTasks) {
      const unit = this.units.get(unitId);
      if (!unit || unit.isDestroyed) {
        this.cancelRepair(unitId);
        continue;
      }

      // 수리 진행
      const componentKey = this.componentKeyMap(task.targetComponent);
      const component = unit.components[componentKey];
      if (!component) {
        this.cancelRepair(unitId);
        continue;
      }

      // HP 회복
      component.current = Math.min(component.max, component.current + task.repairRate);
      task.progress = ((component.current / component.max) * 100);

      // 완료 확인
      if (component.current >= component.max || this.currentTick >= task.estimatedEndTick) {
        this.completeRepair(unitId);
      }
    }
  }

  /**
   * 수리 완료
   */
  private completeRepair(unitId: string): void {
    const unit = this.units.get(unitId);
    const task = this.repairTasks.get(unitId);
    
    if (!unit || !task) return;

    // 부위 완전 복구
    const componentKey = this.componentKeyMap(task.targetComponent);
    const component = unit.components[componentKey];
    if (component) {
      component.current = component.max;
      component.isDestroyed = false;
    }

    // 관련 디버프 제거
    this.removeComponentDebuffs(unit, task.targetComponent);

    // 수리 중 디버프 제거
    unit.activeDebuffs = unit.activeDebuffs.filter(d => d.type !== 'REPAIRING');

    // 함교 복구 시 Uncontrollable 해제
    if (task.targetComponent === 'BRIDGE') {
      unit.isUncontrollable = false;
    }

    // 정리
    delete unit.repairTask;
    this.repairTasks.delete(unitId);

    this.emit('REPAIR_COMPLETED', {
      targetUnitId: unitId,
      targetComponent: task.targetComponent,
      tick: this.currentTick,
    });

    logger.info('[DamageControl] Repair completed', {
      targetUnitId: unitId,
      targetComponent: task.targetComponent,
    });
  }

  /**
   * 수리 취소
   */
  cancelRepair(unitId: string): void {
    const unit = this.units.get(unitId);
    const task = this.repairTasks.get(unitId);

    if (!task) return;

    if (unit) {
      // 수리 중 디버프 제거
      unit.activeDebuffs = unit.activeDebuffs.filter(d => d.type !== 'REPAIRING');
      delete unit.repairTask;
    }

    this.repairTasks.delete(unitId);

    this.emit('REPAIR_CANCELLED', {
      targetUnitId: unitId,
      tick: this.currentTick,
    });
  }

  /**
   * 부위 관련 디버프 제거
   */
  private removeComponentDebuffs(unit: ExtendedUnitState, component: ShipComponent): void {
    const debuffPrefixMap: Record<ShipComponent, string> = {
      HULL: 'ENGINE',
      ENGINE: 'ENGINE',
      BRIDGE: 'BRIDGE',
      MAIN_WEAPON: 'WEAPON',
      HANGAR: 'HANGAR',
    };

    const prefix = debuffPrefixMap[component];
    unit.activeDebuffs = unit.activeDebuffs.filter(
      d => !d.type.startsWith(prefix)
    );
  }

  // ============================================================
  // Chain Reaction (유폭)
  // ============================================================

  /**
   * 유폭 처리
   */
  processChainExplosion(
    destroyedUnitId: string,
    battleId: string
  ): ChainExplosionEvent | null {
    const unit = this.units.get(destroyedUnitId);
    if (!unit) return null;

    const explosionDamage = EXPLOSION_DAMAGE[unit.shipClass] || 50;
    const explosionRadius = EXPLOSION_RADIUS;
    const affectedUnits: string[] = [];

    // 주변 유닛에 피해
    for (const [otherId, otherUnit] of this.units) {
      if (otherId === destroyedUnitId || otherUnit.isDestroyed) continue;

      const distance = this.calculateDistance(unit.position, otherUnit.position);
      if (distance <= explosionRadius) {
        // 거리에 따른 데미지 감소
        const distanceMultiplier = 1 - (distance / explosionRadius);
        const actualDamage = Math.floor(explosionDamage * distanceMultiplier);

        // 아군이든 적이든 피해 (유폭은 가리지 않음)
        this.applyComponentDamage(otherId, actualDamage, 'SIDE', destroyedUnitId);
        affectedUnits.push(otherId);

        logger.debug('[DamageControl] Chain explosion damage', {
          sourceId: destroyedUnitId,
          targetId: otherId,
          damage: actualDamage,
          distance,
        });
      }
    }

    if (affectedUnits.length === 0) return null;

    const event: ChainExplosionEvent = {
      battleId,
      sourceUnitId: destroyedUnitId,
      position: { ...unit.position },
      radius: explosionRadius,
      damage: explosionDamage,
      affectedUnits,
      timestamp: Date.now(),
    };

    this.emit('CHAIN_EXPLOSION', event);

    logger.info('[DamageControl] Chain explosion processed', {
      sourceId: destroyedUnitId,
      affectedCount: affectedUnits.length,
    });

    return event;
  }

  /**
   * 두 위치 간 거리 계산
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ============================================================
  // Line of Fire Check (아군 오사 방지)
  // ============================================================

  /**
   * 사선 차단 확인 (아군 오사 방지)
   */
  checkLineOfFire(
    attackerId: string,
    targetId: string,
    allUnits: Map<string, ExtendedUnitState>
  ): { blocked: boolean; blockedBy?: string } {
    const attacker = allUnits.get(attackerId);
    const target = allUnits.get(targetId);

    if (!attacker || !target) {
      return { blocked: false };
    }

    const attackerPos = attacker.position;
    const targetPos = target.position;
    const factionId = attacker.factionId;

    // 사선 상의 아군 유닛 확인
    for (const [unitId, unit] of allUnits) {
      if (unitId === attackerId || unitId === targetId) continue;
      if (unit.factionId !== factionId) continue;  // 적은 상관없음
      if (unit.isDestroyed) continue;

      // 사선과 유닛 위치 간 거리 확인
      const distanceToLine = this.pointToLineDistance(
        unit.position,
        attackerPos,
        targetPos
      );

      // 일정 거리 이내면 사선 차단으로 판정
      const collisionRadius = 30;  // 유닛 충돌 반경
      if (distanceToLine < collisionRadius) {
        return { blocked: true, blockedBy: unitId };
      }
    }

    return { blocked: false };
  }

  /**
   * 점에서 직선까지의 거리 계산
   */
  private pointToLineDistance(
    point: Vector3,
    lineStart: Vector3,
    lineEnd: Vector3
  ): number {
    const lineVec = {
      x: lineEnd.x - lineStart.x,
      y: lineEnd.y - lineStart.y,
      z: lineEnd.z - lineStart.z,
    };
    const pointVec = {
      x: point.x - lineStart.x,
      y: point.y - lineStart.y,
      z: point.z - lineStart.z,
    };

    const lineLength = Math.sqrt(
      lineVec.x * lineVec.x + lineVec.y * lineVec.y + lineVec.z * lineVec.z
    );

    if (lineLength === 0) return Infinity;

    // 외적 계산
    const crossProduct = {
      x: pointVec.y * lineVec.z - pointVec.z * lineVec.y,
      y: pointVec.z * lineVec.x - pointVec.x * lineVec.z,
      z: pointVec.x * lineVec.y - pointVec.y * lineVec.x,
    };

    const crossLength = Math.sqrt(
      crossProduct.x * crossProduct.x +
      crossProduct.y * crossProduct.y +
      crossProduct.z * crossProduct.z
    );

    return crossLength / lineLength;
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * 유닛 제거
   */
  removeUnit(unitId: string): void {
    this.cancelRepair(unitId);
    this.units.delete(unitId);
  }

  /**
   * 모든 유닛 초기화
   */
  clear(): void {
    this.units.clear();
    this.repairTasks.clear();
    this.currentTick = 0;
    this.removeAllListeners();
  }

  /**
   * 유닛 목록 조회
   */
  getAllUnits(): ExtendedUnitState[] {
    return Array.from(this.units.values());
  }

  /**
   * 수리 중인 유닛 목록
   */
  getRepairingUnits(): string[] {
    return Array.from(this.repairTasks.keys());
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const damageControlSystem = new DamageControlSystem();








