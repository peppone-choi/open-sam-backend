import { IBattleUnit, IBattleMap } from '../../models/battle.model';
import { UnitType } from '../../core/battle-calculator';
import { AStarPathfinder, GridPos } from '../../utils/AStarPathfinder';
import {
  Formation,
  AttackDirection,
  calculateAttackDirection,
  getFormationModifier,
  FORMATION_BASE_BONUS
} from './FormationSystem';
import {
  UnitTrait,
  FatigueLevel,
  calculateFatigue,
  getFatigueLevel,
  FATIGUE_EFFECTS,
  checkChargeReflect,
  hasChargeDefense,
  calculateMoraleModifier,
  TRAIT_EFFECTS,
  DEFAULT_UNIT_TRAITS
} from './TraitSystem';

export interface PhysicsConfig {
  deltaTime: number; // ms
  mapWidth: number;
  mapHeight: number;
}

export class BattlePhysics {
  private config: PhysicsConfig;
  private pathfinder?: AStarPathfinder;

  constructor(config: PhysicsConfig) {
    this.config = config;
  }

  /**
   * Pathfinding initialization
   */
  private ensurePathfinder(map: IBattleMap): AStarPathfinder {
    if (this.pathfinder) return this.pathfinder;

    this.pathfinder = new AStarPathfinder({
      width: Math.ceil(map.width / 20),
      height: Math.ceil(map.height / 20),
      cellSize: 20,
      getTerrainCost: (pos: GridPos) => {
        const worldPos = { x: pos.x * 20 + 10, y: pos.y * 20 + 10 };
        
        // 성벽/성문 체크
        if (map.castle) {
          const { center, radius, gates } = map.castle;
          const dx = worldPos.x - center.x;
          const dy = worldPos.y - center.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // 성벽 내부/경계 (단, 성문 위치는 제외)
          if (Math.abs(dist - radius) < 15) {
            const isGate = gates.some(g => {
              const gdx = worldPos.x - g.position.x;
              const gdy = worldPos.y - g.position.y;
              return Math.abs(gdx) < g.width / 2 + 10 && Math.abs(gdy) < g.height / 2 + 10;
            });
            if (!isGate) return Infinity; // 성벽은 통과 불가
          }
        }

        // 지형별 이동 비용
        if (map.terrain) {
          for (const t of map.terrain) {
            if (t.area) {
              const inX = worldPos.x >= t.area.x && worldPos.x <= t.area.x + t.area.width;
              const inY = worldPos.y >= t.area.y && worldPos.y <= t.area.y + t.area.height;
              if (inX && inY) {
                switch (t.type) {
                  case 'forest': return 1.5;
                  case 'hill': return 2.0;
                  case 'river': return 3.0;
                }
              }
            }
          }
        }

        return 1.0; // 기본 비용
      }
    });

    return this.pathfinder;
  }

  /**
   * 유닛 이동 업데이트
   * deltaTime 동안 목표 지점으로 이동
   */
  updateMovement(unit: IBattleUnit, map: IBattleMap, currentTime?: number): void {
    if (!unit.targetPosition) {
      unit.path = undefined;
      unit.pathTarget = undefined;
      return;
    }
    if (unit.moveSpeed === 0) return;

    // 경로 재생성 필요 여부 확인 (목표가 바뀌었거나 경로가 없는 경우)
    if (!unit.path || !unit.pathTarget || 
        unit.pathTarget.x !== unit.targetPosition.x || 
        unit.pathTarget.y !== unit.targetPosition.y) {
      
      const pf = this.ensurePathfinder(map);
      const newPath = pf.findPath(unit.position, unit.targetPosition);
      
      if (newPath && newPath.length > 0) {
        unit.path = newPath;
        unit.pathTarget = { ...unit.targetPosition };
      } else {
        // 경로를 찾을 수 없는 경우 직선 이동 시도 (또는 정지)
        unit.path = [ { ...unit.targetPosition } ];
        unit.pathTarget = { ...unit.targetPosition };
      }
    }

    // 경로 따라가기
    if (unit.path && unit.path.length > 0) {
      const nextWaypoint = unit.path[0];
      const dx = nextWaypoint.x - unit.position.x;
      const dy = nextWaypoint.y - unit.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 웨이포인트 도달
      if (distance < 10) {
        unit.path.shift();
        if (unit.path.length === 0) {
          unit.targetPosition = undefined;
          unit.pathTarget = undefined;
          unit.velocity = { x: 0, y: 0 };
          return;
        }
        // 다음 웨이포인트로 계속 진행
        this.updateMovement(unit, map, currentTime);
        return;
      }

      // 이동 방향 계산
      const dirX = dx / distance;
      const dirY = dy / distance;

      // 속도 보정
      let effectiveSpeed = unit.moveSpeed;
      if (currentTime !== undefined) {
        const formationSpeedMod = this.getFormationSpeedMultiplier(unit, currentTime);
        effectiveSpeed *= formationSpeedMod;
      }
      if (unit.fatigueLevel) {
        effectiveSpeed *= FATIGUE_EFFECTS[unit.fatigueLevel].speed;
      }

      // 실제 이동
      const moveDistance = (effectiveSpeed * this.config.deltaTime) / 1000;
      const actualDistance = Math.min(moveDistance, distance);

      unit.position.x += dirX * actualDistance;
      unit.position.y += dirY * actualDistance;

      unit.velocity = { x: dirX * effectiveSpeed, y: dirY * effectiveSpeed };
      unit.facing = Math.atan2(dy, dx) * (180 / Math.PI);

      // 기병 돌격 처리
      if (unit.unitType === UnitType.CAVALRY) {
        const speed = Math.sqrt(unit.velocity.x * unit.velocity.x + unit.velocity.y * unit.velocity.y);
        const threshold = unit.moveSpeed * 0.7;
        if (speed >= threshold && unit.stance !== 'retreat') {
          unit.isCharging = true;
        } else if (speed < threshold * 0.3) {
          unit.isCharging = false;
        }
      }

      this.updateFatigue(unit, true, false);
      this.clampToMapBounds(unit);
    }
  }

  /**
   * 맵 경계 제한
   */
  private clampToMapBounds(unit: IBattleUnit): void {
    const radius = unit.collisionRadius;
    unit.position.x = Math.max(radius, Math.min(this.config.mapWidth - radius, unit.position.x));
    unit.position.y = Math.max(radius, Math.min(this.config.mapHeight - radius, unit.position.y));
  }

  /**
   * 두 유닛 간 충돌 감지
   */
  checkCollision(unit1: IBattleUnit, unit2: IBattleUnit): boolean {
    const dx = unit2.position.x - unit1.position.x;
    const dy = unit2.position.y - unit1.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = unit1.collisionRadius + unit2.collisionRadius;

    return distance < minDistance;
  }

  /**
   * 충돌 시 유닛 밀어내기 (elastic collision)
   */
  resolveCollision(unit1: IBattleUnit, unit2: IBattleUnit): void {
    const dx = unit2.position.x - unit1.position.x;
    const dy = unit2.position.y - unit1.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const minDistance = unit1.collisionRadius + unit2.collisionRadius;
    const overlap = minDistance - distance;

    if (overlap <= 0) return;

    // 밀어내기 방향
    const pushX = (dx / distance) * overlap * 0.5;
    const pushY = (dy / distance) * overlap * 0.5;

    // 양쪽 모두 이동 가능한 경우
    if (unit1.moveSpeed > 0 && unit2.moveSpeed > 0) {
      unit1.position.x -= pushX;
      unit1.position.y -= pushY;
      unit2.position.x += pushX;
      unit2.position.y += pushY;
    } 
    // unit2가 고정 (성문)
    else if (unit2.moveSpeed === 0 && unit1.moveSpeed > 0) {
      unit1.position.x -= pushX * 2;
      unit1.position.y -= pushY * 2;
    }
    // unit1이 고정
    else if (unit1.moveSpeed === 0 && unit2.moveSpeed > 0) {
      unit2.position.x += pushX * 2;
      unit2.position.y += pushY * 2;
    }

    this.clampToMapBounds(unit1);
    this.clampToMapBounds(unit2);
  }

  /**
   * 공격 범위 체크
   * - 거리 + 병종별 시야각(FOV) 적용
   */
  isInAttackRange(attacker: IBattleUnit, target: IBattleUnit): boolean {
    const dx = target.position.x - attacker.position.x;
    const dy = target.position.y - attacker.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 충돌 반경 고려한 거리 체크
    const effectiveRange = attacker.attackRange + target.collisionRadius;
    if (distance > effectiveRange) {
      return false;
    }

    // 병종별 시야각 (궁병/마법/공성만 제한, 근접은 360도)
    const fov = this.getAttackFov(attacker); // 도 단위
    if (fov >= 360 || fov <= 0) {
      return true;
    }

    // 공격자가 바라보는 방향과 목표 방향의 각도 차이 계산
    const facing = attacker.facing ?? 0;
    const angleToTarget = Math.atan2(dy, dx) * (180 / Math.PI);
    let diff = Math.abs(angleToTarget - facing);
    if (diff > 180) diff = 360 - diff;

    return diff <= fov / 2;
  }

  /**
   * 병종별 시야각(FOV) 설정 (도 단위)
   * - 근접 계열: 360도
   * - 궁병/마법/공성: 전방 120도 정도로 제한
   */
  private getAttackFov(attacker: IBattleUnit): number {
    switch (attacker.unitType) {
      case UnitType.ARCHER:
      case UnitType.WIZARD:
      case UnitType.SIEGE:
        return 120;
      default:
        return 360;
    }
  }


  /**
   * 공격 처리
   * @returns 데미지량 또는 null (공격 불가)
   */
  processAttack(attacker: IBattleUnit, target: IBattleUnit, currentTime: number): number | null {
    // 쿨다운 체크
    const timeSinceLastAttack = currentTime - (attacker.lastAttackTime || 0);
    if (timeSinceLastAttack < (attacker.attackCooldown || 2000)) {
      return null;
    }

    // 사거리 체크
    if (!this.isInAttackRange(attacker, target)) {
      return null;
    }

    // 데미지 계산
    const damage = this.calculateDamage(attacker, target);

    // Volley는 한 번 사용 후 해제
    if (attacker.isVolleyMode) {
      attacker.isVolleyMode = false;
    }
 
    // 쿨다운 적용
    attacker.lastAttackTime = currentTime;
 
    return damage;
  }


  /**
   * 데미지 계산 (병종 상성 + 포메이션 + 방향 + 특성 + 피로도 포함)
   */
  calculateDamage(attacker: IBattleUnit, defender: IBattleUnit): number {
    // 기본 데미지 = (병력 * 능력치 가중평균) / 10
    const attackerPower = 
      attacker.troops * 
      (attacker.strength * 0.4 + attacker.leadership * 0.3 + attacker.intelligence * 0.3) / 
      100;

    let baseDamage = attackerPower / 10;

    // 병종 상성 보너스
    const typeAdvantage = this.getTypeAdvantage(attacker.unitType, defender.unitType);
    baseDamage *= typeAdvantage;

    // 사기 영향 (0.5 ~ 1.5배)
    const moraleMultiplier = attacker.morale / 100;
    baseDamage *= moraleMultiplier;

    // 훈련도 영향 (0.5 ~ 1.5배)
    const trainingMultiplier = attacker.training / 100;
    baseDamage *= trainingMultiplier;

    // === 특성 기반 공격 보정 ===
    const attackerTraits = attacker.traits || [];
    const defenderTraits = defender.traits || [];
    
    // 피로도 효과
    if (attacker.fatigueLevel) {
      const fatigueEffect = FATIGUE_EFFECTS[attacker.fatigueLevel];
      baseDamage *= fatigueEffect.attack;
    }
    
    // 특성 공격 배수
    for (const trait of attackerTraits) {
      const effect = TRAIT_EFFECTS[trait];
      if (effect.attackMultiplier) {
        baseDamage *= effect.attackMultiplier;
      }
    }

    // Volley(일제 사격) 보너스 - 원거리 계열에 한해 약간의 추가 화력
    if (attacker.isVolleyMode && (attacker.unitType === UnitType.ARCHER || attacker.unitType === UnitType.WIZARD || attacker.unitType === UnitType.SIEGE)) {
      baseDamage *= 1.3;
    }

    // 돌격 보너스
    if (attacker.isCharging) {
      let chargeBonus = 1.5; // 기본 돌격 보너스
      
      // 특성 기반 돌격 보너스
      for (const trait of attackerTraits) {
        const effect = TRAIT_EFFECTS[trait];
        if (effect.chargeBonus) {
          chargeBonus *= effect.chargeBonus;
        }
      }
      
      // 돌격 방어 특성 확인
      const isFrontalCharge = calculateAttackDirection(
        attacker.position.x,
        attacker.position.y,
        defender.position.x,
        defender.position.y,
        defender.facing || 0
      ) === AttackDirection.FRONT;
      
      if (hasChargeDefense(defenderTraits) && isFrontalCharge) {
        chargeBonus = 1.0; // 돌격 방어로 무효화
      }
      
      baseDamage *= chargeBonus;
    }

    // === 포메이션 & 방향 보너스 ===
    const attackerFormation = attacker.formation || Formation.LINE;
    const defenderFormation = defender.formation || Formation.LINE;
    
    // 공격 방향 계산 (공격자 → 방어자)
    const attackDirection = calculateAttackDirection(
      attacker.position.x,
      attacker.position.y,
      defender.position.x,
      defender.position.y,
      defender.facing || 0
    );
    
    // 공격자 포메이션 공격 보정
    const attackerMod = getFormationModifier(attackerFormation, attackDirection, true);
    baseDamage *= attackerMod;
    
    // 방어자 포메이션 방어 보정
    const defenderMod = getFormationModifier(defenderFormation, attackDirection, false);
    baseDamage *= defenderMod;
    
    // 포메이션 전환 중 취약 상태
    if (defender.formationVulnerable) {
      baseDamage *= 1.3; // 30% 추가 피해
    }

    // === 특성 기반 방어 보정 ===
    // 피로도 효과 (방어)
    if (defender.fatigueLevel) {
      const fatigueEffect = FATIGUE_EFFECTS[defender.fatigueLevel];
      baseDamage /= fatigueEffect.defense; // 방어력 감소 = 피해 증가
    }
    
    // 특성 방어 배수
    for (const trait of defenderTraits) {
      const effect = TRAIT_EFFECTS[trait];
      if (effect.defenseMultiplier) {
        baseDamage /= effect.defenseMultiplier;
      }
      if (effect.armorBonus) {
        // 장갑 보너스 = 피해 감소 (간단 계산)
        baseDamage *= (1 - effect.armorBonus / 200);
      }
    }

    // 방어 측 훈련도 방어력
    const defenseMultiplier = defender.training / 150;
    baseDamage *= (1 - defenseMultiplier);

    // 최소 1 데미지
    return Math.max(1, Math.floor(baseDamage));
  }

  /**
   * 병종 상성표 (삼국지 11 완전 재현)
   * 
   * 5병종 시스템:
   * - FOOTMAN (보병/도검병): 범용 병종
   * - SPEARMAN (창병): 기병 카운터
   * - HALBERD (극병): 창병 카운터, 최고 방어력
   * - CAVALRY (기병): 극병 카운터, 고기동
   * - ARCHER (궁병): 원거리, 상성 없음
   * 
   * 핵심 상성:
   * - 창병 → 기병: 2.5배 (압도적)
   * - 극병 → 창병: 1.7배 (압도적)
   * - 기병 → 극병: 1.6배 (우세)
   */
  private getTypeAdvantage(attackerType: UnitType, defenderType: UnitType): number {
    // 타입 문자열로 변환 (UnitType enum → string)
    const attackerTypeStr = String(attackerType);
    const defenderTypeStr = String(defenderType);
    
    // 삼국지 11 기반 상성표
    const advantages: Record<string, Record<string, number>> = {
      // 보병 (도검병) - 범용
      'FOOTMAN': {
        'FOOTMAN': 1.0,
        'SPEARMAN': 1.1,   // 창병에 약간 유리
        'HALBERD': 0.9,    // 극병과 호각
        'ARCHER': 1.1,
        'CAVALRY': 0.8,    // 기병에 불리
        'WIZARD': 1.0,
        'SIEGE': 1.2
      },
      // 창병 - 기병 카운터
      'SPEARMAN': {
        'FOOTMAN': 0.9,    // 보병에 약간 불리
        'SPEARMAN': 1.0,
        'HALBERD': 0.6,    // 극병에 매우 약함
        'ARCHER': 0.9,
        'CAVALRY': 2.5,    // 기병에 압도적
        'WIZARD': 0.9,
        'SIEGE': 1.0
      },
      // 극병 - 창병 카운터, 최고 방어력
      'HALBERD': {
        'FOOTMAN': 0.9,    // 보병과 호각
        'SPEARMAN': 1.7,   // 창병에 압도적
        'HALBERD': 1.0,
        'ARCHER': 1.1,
        'CAVALRY': 0.7,    // 기병에 불리
        'WIZARD': 1.0,
        'SIEGE': 1.2
      },
      // 기병 - 극병 카운터, 고기동
      'CAVALRY': {
        'FOOTMAN': 1.2,    // 보병에 유리
        'SPEARMAN': 0.4,   // 창병에 자살 공격
        'HALBERD': 1.6,    // 극병에 우세
        'ARCHER': 1.6,     // 궁병에 압도적
        'CAVALRY': 1.0,
        'WIZARD': 1.2,
        'SIEGE': 1.5
      },
      // 궁병 - 원거리, 상성 없음
      'ARCHER': {
        'FOOTMAN': 1.0,    // 상성 없음
        'SPEARMAN': 1.0,   // 상성 없음
        'HALBERD': 1.0,    // 상성 없음
        'ARCHER': 1.0,
        'CAVALRY': 1.0,    // 상성 없음
        'WIZARD': 0.8,
        'SIEGE': 0.8
      },
      // 계략병
      'WIZARD': {
        'FOOTMAN': 1.1,
        'SPEARMAN': 1.1,
        'HALBERD': 1.0,
        'ARCHER': 1.2,
        'CAVALRY': 0.9,
        'WIZARD': 1.0,
        'SIEGE': 1.0
      },
      // 공성병
      'SIEGE': {
        'FOOTMAN': 0.7,
        'SPEARMAN': 0.6,
        'HALBERD': 0.7,
        'ARCHER': 0.6,
        'CAVALRY': 0.5,
        'WIZARD': 0.8,
        'SIEGE': 2.0     // 충차 vs 성문
      }
    };

    return advantages[attackerTypeStr]?.[defenderTypeStr] || 1.0;
  }

  /**
   * 가장 가까운 적 찾기
   */
  findNearestEnemy(unit: IBattleUnit, enemies: IBattleUnit[]): IBattleUnit | null {
    let nearest: IBattleUnit | null = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      if (enemy.troops <= 0) continue;

      const dx = enemy.position.x - unit.position.x;
      const dy = enemy.position.y - unit.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * 특정 타입의 가장 가까운 적 찾기 (충차 → 성문 우선)
   */
  findNearestEnemyByType(unit: IBattleUnit, enemies: IBattleUnit[], targetType: UnitType): IBattleUnit | null {
    let nearest: IBattleUnit | null = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      if (enemy.troops <= 0) continue;
      if (enemy.unitType !== targetType) continue;

      const dx = enemy.position.x - unit.position.x;
      const dy = enemy.position.y - unit.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * 유닛 간 거리 계산
   */
  getDistance(unit1: IBattleUnit, unit2: IBattleUnit): number {
    const dx = unit2.position.x - unit1.position.x;
    const dy = unit2.position.y - unit1.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 점과 점 사이 거리
   */
  getDistanceToPoint(unit: IBattleUnit, point: { x: number; y: number }): number {
    const dx = point.x - unit.position.x;
    const dy = point.y - unit.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 포메이션 전환 시작
   * @param unit 유닛
   * @param newFormation 새 포메이션
   * @param currentTime 현재 시간 (ms)
   */
  startFormationTransition(unit: IBattleUnit, newFormation: Formation, currentTime: number): void {
    // 이미 같은 포메이션이면 무시
    if (unit.formation === newFormation) return;

    // 포메이션 변경
    unit.formation = newFormation;
    
    // 전환 타이머 시작 (3초 = 3000ms)
    unit.formationTransitionTimer = currentTime + 3000;
    
    // 1.5초 후부터 취약 상태 시작
    unit.formationVulnerable = false;
  }

  /**
   * 포메이션 전환 업데이트
   * @param unit 유닛
   * @param currentTime 현재 시간 (ms)
   */
  updateFormationTransition(unit: IBattleUnit, currentTime: number): void {
    if (!unit.formationTransitionTimer) return;
    if (currentTime < unit.formationTransitionTimer) {
      // 전환 중
      const remainingTime = unit.formationTransitionTimer - currentTime;
      
      // 마지막 1.5초 동안 취약 상태
      if (remainingTime <= 1500) {
        unit.formationVulnerable = true;
      }
      
      // 이동 제한 (전환 중에는 속도 50% 감소)
      // 이 부분은 updateMovement에서 처리
    } else {
      // 전환 완료
      unit.formationTransitionTimer = 0;
      unit.formationVulnerable = false;
    }
  }

  /**
   * 포메이션 전환 중인지 확인
   */
  isFormationTransitioning(unit: IBattleUnit, currentTime: number): boolean {
    return !!unit.formationTransitionTimer && currentTime < unit.formationTransitionTimer;
  }

  /**
   * 포메이션별 이동 속도 보정 적용
   */
  getFormationSpeedMultiplier(unit: IBattleUnit, currentTime: number): number {
    const formation = unit.formation || Formation.LINE;
    let speedMultiplier = FORMATION_BASE_BONUS[formation].speedMultiplier;
    
    // 전환 중에는 추가로 50% 감소
    if (this.isFormationTransitioning(unit, currentTime)) {
      speedMultiplier *= 0.5;
    }
    
    return speedMultiplier;
  }

  /**
   * 피로도 업데이트
   */
  updateFatigue(unit: IBattleUnit, isRunning: boolean, isFighting: boolean): void {
    const traits = unit.traits || [];
    const currentFatigue = unit.fatigue || 0;
    
    // 피로도 계산
    const newFatigue = calculateFatigue(
      currentFatigue,
      isRunning,
      isFighting,
      traits,
      this.config.deltaTime
    );
    
    unit.fatigue = newFatigue;
    unit.fatigueLevel = getFatigueLevel(newFatigue);
  }

  /**
   * 돌격 피해 반사 계산
   */
  calculateChargeReflectDamage(
    attacker: IBattleUnit,
    defender: IBattleUnit,
    chargeDamage: number
  ): number {
    const defenderTraits = defender.traits || [];
    
    // 정면 돌격인지 확인
    const attackDirection = calculateAttackDirection(
      attacker.position.x,
      attacker.position.y,
      defender.position.x,
      defender.position.y,
      defender.facing || 0
    );
    
    const isFrontalCharge = attackDirection === AttackDirection.FRONT;
    
    // 반사율 계산
    const reflectRatio = checkChargeReflect(
      defenderTraits,
      attacker.unitType,
      isFrontalCharge
    );
    
    return Math.floor(chargeDamage * reflectRatio);
  }

  /**
   * 부대 초기화 시 기본 특성 적용
   */
  initializeUnitTraits(unit: IBattleUnit): void {
    if (!unit.traits || unit.traits.length === 0) {
      // 병종별 기본 특성 할당
      unit.traits = [...DEFAULT_UNIT_TRAITS[unit.unitType]];
    }
    
    // 피로도 초기화
    if (unit.fatigue === undefined) {
      unit.fatigue = 0;
      unit.fatigueLevel = FatigueLevel.FRESH;
    }
  }
}
