import { IBattleUnit, IBattleMap } from '../../models/battle.model';
import { UnitType } from '../../core/battle-calculator';
import { BattlePhysics } from './BattlePhysics';

export interface AIDecision {
  generalId: number;
  action: 'move' | 'attack' | 'hold' | 'retreat';
  targetPosition?: { x: number; y: number };
  targetGeneralId?: number;
}

/**
 * 간단한 전투 AI
 * - 병종별 전술 적용
 * - 성문 우선 공격 (충차)
 * - 거리 기반 목표 선정
 */
export class SimpleBattleAI {
  private physics: BattlePhysics;

  constructor(physics: BattlePhysics) {
    this.physics = physics;
  }

  /**
   * AI 결정 생성
   */
  decideAction(unit: IBattleUnit, allies: IBattleUnit[], enemies: IBattleUnit[], map: IBattleMap): AIDecision {
    // 병력 0이면 아무것도 안 함
    if (unit.troops <= 0) {
      return { generalId: unit.generalId, action: 'hold' };
    }

    // 성문은 고정
    if (unit.moveSpeed === 0) {
      return { generalId: unit.generalId, action: 'hold' };
    }

    // Stance에 따른 행동
    if (unit.stance === 'hold') {
      return this.holdPosition(unit, enemies);
    }

    if (unit.stance === 'retreat') {
      return this.retreat(unit, map);
    }

    // 병종별 전술
    switch (unit.unitType) {
      case UnitType.CAVALRY:
        return this.cavalryTactic(unit, enemies, map);
      case UnitType.ARCHER:
        return this.archerTactic(unit, enemies, map);
      case UnitType.SIEGE:
        return this.siegeTactic(unit, enemies, map);
      case UnitType.FOOTMAN:
      case UnitType.WIZARD:
      default:
        return this.defaultTactic(unit, enemies, map);
    }
  }

  /**
   * 기본 전술: 가장 가까운 적 공격
   */
  private defaultTactic(unit: IBattleUnit, enemies: IBattleUnit[], map: IBattleMap): AIDecision {
    const target = this.physics.findNearestEnemy(unit, enemies);

    if (!target) {
      return { generalId: unit.generalId, action: 'hold' };
    }

    // 사거리 내면 공격
    if (this.physics.isInAttackRange(unit, target)) {
      return {
        generalId: unit.generalId,
        action: 'attack',
        targetGeneralId: target.generalId
      };
    }

    // 접근
    return {
      generalId: unit.generalId,
      action: 'move',
      targetPosition: target.position
    };
  }

  /**
   * 기병 전술: 돌격 → 후방 궁병/마법사 우선
   */
  private cavalryTactic(unit: IBattleUnit, enemies: IBattleUnit[], map: IBattleMap): AIDecision {
    // 1순위: 궁병
    let target = this.physics.findNearestEnemyByType(unit, enemies, UnitType.ARCHER);
    
    // 2순위: 마법사
    if (!target) {
      target = this.physics.findNearestEnemyByType(unit, enemies, UnitType.WIZARD);
    }

    // 3순위: 아무 적
    if (!target) {
      target = this.physics.findNearestEnemy(unit, enemies);
    }

    if (!target) {
      return { generalId: unit.generalId, action: 'hold' };
    }

    // 돌격 거리 (100px 이상 떨어진 경우)
    const distance = this.physics.getDistance(unit, target);
    if (distance > 100 && !unit.isCharging) {
      unit.isCharging = true;
    }

    // 접근하면 돌격 해제
    if (distance < 50) {
      unit.isCharging = false;
    }

    // 사거리 내면 공격
    if (this.physics.isInAttackRange(unit, target)) {
      return {
        generalId: unit.generalId,
        action: 'attack',
        targetGeneralId: target.generalId
      };
    }

    // 돌진
    return {
      generalId: unit.generalId,
      action: 'move',
      targetPosition: target.position
    };
  }

  /**
   * 궁병 전술: 카이팅 (hit and run)
   */
  private archerTactic(unit: IBattleUnit, enemies: IBattleUnit[], map: IBattleMap): AIDecision {
    const target = this.physics.findNearestEnemy(unit, enemies);

    if (!target) {
      return { generalId: unit.generalId, action: 'hold' };
    }

    const distance = this.physics.getDistance(unit, target);
    const safeDistance = unit.attackRange * 0.8; // 사거리의 80%

    // 적이 너무 가까우면 후퇴
    if (distance < 80 && target.unitType === UnitType.CAVALRY) {
      return this.kiteAway(unit, target, map);
    }

    // 적절한 거리면 공격
    if (distance <= unit.attackRange && distance >= safeDistance) {
      return {
        generalId: unit.generalId,
        action: 'attack',
        targetGeneralId: target.generalId
      };
    }

    // 너무 멀면 접근
    if (distance > unit.attackRange) {
      const approachPoint = this.calculateApproachPoint(unit, target, safeDistance);
      return {
        generalId: unit.generalId,
        action: 'move',
        targetPosition: approachPoint
      };
    }

    // 너무 가까우면 후퇴
    return this.kiteAway(unit, target, map);
  }

  /**
   * 충차 전술: 성문 우선 공격
   */
  private siegeTactic(unit: IBattleUnit, enemies: IBattleUnit[], map: IBattleMap): AIDecision {
    // 1순위: 성문 찾기 (generalId = -1)
    const gate = enemies.find(e => e.generalId === -1 && e.troops > 0);

    if (gate) {
      // 사거리 내면 공격
      if (this.physics.isInAttackRange(unit, gate)) {
        return {
          generalId: unit.generalId,
          action: 'attack',
          targetGeneralId: gate.generalId
        };
      }

      // 성문으로 이동
      return {
        generalId: unit.generalId,
        action: 'move',
        targetPosition: gate.position
      };
    }

    // 성문 없으면 일반 적 공격
    return this.defaultTactic(unit, enemies, map);
  }

  /**
   * 제자리 고수 (방어)
   */
  private holdPosition(unit: IBattleUnit, enemies: IBattleUnit[]): AIDecision {
    // 사거리 내 적이 있으면 공격
    const nearbyEnemy = enemies.find(enemy => 
      enemy.troops > 0 && this.physics.isInAttackRange(unit, enemy)
    );

    if (nearbyEnemy) {
      return {
        generalId: unit.generalId,
        action: 'attack',
        targetGeneralId: nearbyEnemy.generalId
      };
    }

    return { generalId: unit.generalId, action: 'hold' };
  }

  /**
   * 후퇴
   */
  private retreat(unit: IBattleUnit, map: IBattleMap): AIDecision {
    // 맵 모서리로 후퇴
    const retreatPoint = this.findRetreatPoint(unit, map);

    return {
      generalId: unit.generalId,
      action: 'move',
      targetPosition: retreatPoint
    };
  }

  /**
   * 카이팅: 적 반대 방향으로 후퇴
   */
  private kiteAway(unit: IBattleUnit, enemy: IBattleUnit, map: IBattleMap): AIDecision {
    const dx = unit.position.x - enemy.position.x;
    const dy = unit.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // 랜덤 방향
      return {
        generalId: unit.generalId,
        action: 'move',
        targetPosition: {
          x: unit.position.x + (Math.random() - 0.5) * 100,
          y: unit.position.y + (Math.random() - 0.5) * 100
        }
      };
    }

    // 반대 방향으로 이동
    const fleeDistance = 100;
    const targetX = unit.position.x + (dx / distance) * fleeDistance;
    const targetY = unit.position.y + (dy / distance) * fleeDistance;

    return {
      generalId: unit.generalId,
      action: 'move',
      targetPosition: {
        x: Math.max(0, Math.min(map.width, targetX)),
        y: Math.max(0, Math.min(map.height, targetY))
      }
    };
  }

  /**
   * 적절한 공격 거리로 접근
   */
  private calculateApproachPoint(unit: IBattleUnit, target: IBattleUnit, distance: number): { x: number; y: number } {
    const dx = target.position.x - unit.position.x;
    const dy = target.position.y - unit.position.y;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    if (currentDistance === 0) {
      return target.position;
    }

    // 목표 거리만큼 떨어진 지점
    const ratio = distance / currentDistance;
    return {
      x: unit.position.x + dx * ratio,
      y: unit.position.y + dy * ratio
    };
  }

  /**
   * 후퇴 지점 찾기 (배치 영역으로)
   */
  private findRetreatPoint(unit: IBattleUnit, map: IBattleMap): { x: number; y: number } {
    // 맵의 가장 가까운 모서리로
    const corners = [
      { x: 0, y: 0 },
      { x: map.width, y: 0 },
      { x: 0, y: map.height },
      { x: map.width, y: map.height }
    ];

    let nearest = corners[0];
    let minDistance = Infinity;

    for (const corner of corners) {
      const distance = this.physics.getDistanceToPoint(unit, corner);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = corner;
      }
    }

    return nearest;
  }

  /**
   * 진형 유지 (추후 구현)
   */
  private maintainFormation(unit: IBattleUnit, allies: IBattleUnit[]): { x: number; y: number } | null {
    // TODO: 진형별 위치 계산
    return null;
  }

  /**
   * 측면 공격 위치 계산 (추후 구현)
   */
  private calculateFlankPosition(unit: IBattleUnit, target: IBattleUnit): { x: number; y: number } {
    // TODO: 적 측면 위치
    return target.position;
  }
}
