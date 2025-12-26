/**
 * BattleValidator - 액션 검증
 * 
 * 3D 전투에서 유닛의 이동, 공격, 스킬 사용 가능 여부 검증
 */

import {
  BattleUnit3D,
  BattleTile3D,
  Position3D,
  Action,
  BattleState,
  UnitType,
  TerrainType
} from './types';

export class BattleValidator {

  canMove(
    unit: BattleUnit3D,
    targetPos: Position3D,
    map: BattleTile3D[][],
    units: Map<string, BattleUnit3D>
  ): { valid: boolean; reason?: string } {
    if (!this.isInBounds(targetPos, map)) {
      return { valid: false, reason: 'Out of bounds' };
    }

    const tile = map[targetPos.y][targetPos.x];

    if (!tile) {
      return { valid: false, reason: 'Invalid tile' };
    }

    if (unit.canFly) {
      if (targetPos.z > (unit.maxAltitude || 15)) {
        return { valid: false, reason: 'Altitude too high' };
      }
      if (!tile.flyable) {
        return { valid: false, reason: 'Cannot fly through this tile' };
      }
    } else {
      if (!tile.walkable) {
        return { valid: false, reason: 'Tile not walkable' };
      }

      const heightDiff = Math.abs(targetPos.z - unit.position.z);

      if (unit.canClimb && heightDiff > (unit.maxClimbHeight || 3)) {
        return { valid: false, reason: 'Too steep to climb' };
      }

      if (!unit.canClimb && heightDiff > 2) {
        return { valid: false, reason: 'Cannot climb' };
      }

      if (unit.unitType === UnitType.CAVALRY && heightDiff > 1) {
        return { valid: false, reason: 'Cavalry cannot traverse steep terrain' };
      }
    }

    const occupant = Array.from(units.values()).find(
      u => u.id !== unit.id &&
        u.position.x === targetPos.x &&
        u.position.y === targetPos.y &&
        u.position.z === targetPos.z
    );

    if (occupant) {
      return { valid: false, reason: 'Tile occupied' };
    }

    const distance = this.getDistance3D(unit.position, targetPos);
    if (distance > unit.speed) {
      return { valid: false, reason: 'Too far to move' };
    }

    return { valid: true };
  }

  canAttack(
    attacker: BattleUnit3D,
    target: BattleUnit3D,
    map: BattleTile3D[][]
  ): { valid: boolean; reason?: string } {
    if (attacker.side === target.side) {
      return { valid: false, reason: 'Cannot attack ally' };
    }

    if (attacker.hp <= 0 || target.hp <= 0) {
      return { valid: false, reason: 'Dead unit' };
    }

    const distance = this.getDistance3D(attacker.position, target.position);

    let effectiveRange = attacker.attackRange;
    const heightDiff = attacker.position.z - target.position.z;

    if (heightDiff > 0) {
      effectiveRange += Math.floor(heightDiff / 2);
    }

    if (distance > effectiveRange) {
      return { valid: false, reason: 'Target out of range' };
    }

    if (attacker.unitType === UnitType.ARCHER || attacker.unitType === UnitType.SIEGE) {
      if (!this.canShootOver(attacker.position, target.position, map)) {
        return { valid: false, reason: 'Line of sight blocked' };
      }
    }

    if (attacker.canFly && !target.canFly) {
      if (attacker.position.z - target.position.z > 5) {
        return { valid: false, reason: 'Target too far below' };
      }
    }

    return { valid: true };
  }

  canUseSkill(
    unit: BattleUnit3D,
    skillId: string,
    target: Position3D,
    map: BattleTile3D[][]
  ): { valid: boolean; reason?: string } {
    if (!unit.skills?.includes(skillId)) {
      return { valid: false, reason: '사용 가능한 스킬이 아닙니다.' };
    }

    if (unit.hp <= 0) {
      return { valid: false, reason: '부대가 전멸했습니다.' };
    }

    const skillRange = this.getSkillRange(skillId, unit);
    const distance = this.getDistance3D(unit.position, target);

    if (distance > skillRange) {
      return { valid: false, reason: '스킬 사거리를 벗어났습니다.' };
    }

    return { valid: true };
  }

  canFire(unit: BattleUnit3D, target: Position3D, map: BattleTile3D[][], weather: string): { valid: boolean; reason?: string } {
    if (weather === 'rain') return { valid: false, reason: '비가 오는 중에는 화공이 불가능합니다.' };

    if (!this.isInBounds(target, map)) return { valid: false, reason: '맵 밖입니다.' };

    const tile = map[target.y][target.x];
    if (tile.type === TerrainType.DEEP_WATER || tile.type === TerrainType.SHALLOW_WATER) {
      return { valid: false, reason: '물 위에는 불을 지를 수 없습니다.' };
    }

    const distance = this.getDistance3D(unit.position, target);
    if (distance > 3) return { valid: false, reason: '화공 사거리가 너무 멉니다.' };

    return { valid: true };
  }

  canAmbush(unit: BattleUnit3D, map: BattleTile3D[][]): { valid: boolean; reason?: string } {
    const tile = map[unit.position.y][unit.position.x];
    // 가정: HILL이나 별도의 FOREST 타입이 있어야 함. 현재 TerrainType에 숲이 없으므로 HILL_MID 이상에서 가능하다고 가정하거나 타입을 추가해야 함.
    // 일단 HILL_MID(산지/숲 대용)에서 가능하다고 설정
    if (tile.type !== TerrainType.HILL_MID && tile.type !== TerrainType.HILL_HIGH) {
      return { valid: false, reason: '매복은 숲이나 산지에서만 가능합니다.' };
    }
    return { valid: true };
  }

  canDuel(unit: BattleUnit3D, target: BattleUnit3D): { valid: boolean; reason?: string } {
    if (unit.side === target.side) return { valid: false, reason: '아군과는 일기토를 할 수 없습니다.' };
    const distance = this.getDistance3D(unit.position, target.position);
    if (distance > 1.5) return { valid: false, reason: '일기토는 인접한 적에게만 신청 가능합니다.' };
    if (target.hp < target.maxHp * 0.2) return { valid: false, reason: '상대 부대의 병력이 너무 적어 일기토가 불가능합니다.' };
    return { valid: true };
  }

  isInBounds(pos: Position3D, map: BattleTile3D[][]): boolean {
    return pos.x >= 0 && pos.x < map[0].length &&
      pos.y >= 0 && pos.y < map.length &&
      pos.z >= -2 && pos.z <= 19;
  }

  getDistance3D(from: Position3D, to: Position3D): number {
    return Math.sqrt(
      Math.pow(to.x - from.x, 2) +
      Math.pow(to.y - from.y, 2) +
      Math.pow(to.z - from.z, 2)
    );
  }

  getManhattanDistance(from: Position3D, to: Position3D): number {
    return Math.abs(to.x - from.x) +
      Math.abs(to.y - from.y) +
      Math.abs(to.z - from.z);
  }

  canShootOver(
    from: Position3D,
    to: Position3D,
    map: BattleTile3D[][]
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(to.x - from.x, 2) +
      Math.pow(to.y - from.y, 2)
    );

    const maxHeight = Math.max(from.z, to.z) + Math.ceil(distance / 4);

    const path = this.bresenhamLine3D(from, to);

    for (const point of path) {
      if (!this.isInBounds(point, map)) continue;

      const tile = map[point.y][point.x];
      if (tile.z > maxHeight) {
        return false;
      }

      if (tile.building && tile.building.z > maxHeight) {
        return false;
      }
    }

    return true;
  }

  bresenhamLine3D(from: Position3D, to: Position3D): Position3D[] {
    const points: Position3D[] = [];

    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const dz = Math.abs(to.z - from.z);

    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    const sz = from.z < to.z ? 1 : -1;

    const dm = Math.max(dx, dy, dz);

    let x = from.x;
    let y = from.y;
    let z = from.z;

    for (let i = 0; i <= dm; i++) {
      points.push({ x, y, z });

      const t = i / dm;
      x = Math.round(from.x + t * (to.x - from.x));
      y = Math.round(from.y + t * (to.y - from.y));
      z = Math.round(from.z + t * (to.z - from.z));
    }

    return points;
  }

  getSkillRange(skillId: string, unit: BattleUnit3D): number {
    const skillRanges: Record<string, number> = {
      'fireball': 8,
      'heal': 5,
      'buff': 3,
      'charge': 10,
      'volley': 12
    };

    return skillRanges[skillId] || 5;
  }

  validateAction(
    action: Action,
    state: BattleState
  ): { valid: boolean; reason?: string } {
    const unit = state.units.get(action.unitId);

    if (!unit) {
      return { valid: false, reason: 'Unit not found' };
    }

    if (unit.hasActed) {
      return { valid: false, reason: 'Unit already acted this turn' };
    }

    switch (action.type) {
      case 'move':
        if (action.path.length === 0) {
          return { valid: false, reason: 'Empty path' };
        }
        return this.canMove(unit, action.path[action.path.length - 1], state.map, state.units);

      case 'attack':
        const target = state.units.get(action.targetId);
        if (!target) {
          return { valid: false, reason: 'Target not found' };
        }
        return this.canAttack(unit, target, state.map);

      case 'skill':
        return this.canUseSkill(unit, action.skillId, action.target, state.map);

      case 'fire':
        return this.canFire(unit, action.target, state.map, state.weather);

      case 'ambush':
        return this.canAmbush(unit, state.map);

      case 'duel':
        const duelTarget = state.units.get(action.targetId);
        if (!duelTarget) return { valid: false, reason: '대상을 찾을 수 없습니다.' };
        return this.canDuel(unit, duelTarget);

      case 'misinform':
      case 'discord':
      case 'confuse':
        const tacticTarget = state.units.get(action.targetId);
        if (!tacticTarget) return { valid: false, reason: '대상을 찾을 수 없습니다.' };
        if (this.getDistance3D(unit.position, tacticTarget.position) > 4) {
          return { valid: false, reason: '계략 사거리가 너무 멉니다.' };
        }
        return { valid: true };

      case 'stone':
        const stoneTarget = state.units.get(action.targetId);
        if (!stoneTarget) return { valid: false, reason: '대상을 찾을 수 없습니다.' };
        if (unit.position.z <= stoneTarget.position.z) {
          return { valid: false, reason: '낙석은 고지대에서만 가능합니다.' };
        }
        if (this.getDistance3D(unit.position, stoneTarget.position) > 2) {
          return { valid: false, reason: '낙석 사거리가 너무 멉니다.' };
        }
        return { valid: true };

      case 'defend':
      case 'wait':
      case 'retreat':
        return { valid: true };

      default:
        return { valid: false, reason: '알 수 없는 액션 타입입니다.' };
    }
  }
}
