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
      return { valid: false, reason: 'Skill not available' };
    }

    if (unit.hp <= 0) {
      return { valid: false, reason: 'Unit is dead' };
    }

    const skillRange = this.getSkillRange(skillId, unit);
    const distance = this.getDistance3D(unit.position, target);

    if (distance > skillRange) {
      return { valid: false, reason: 'Target out of skill range' };
    }

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
      
      case 'defend':
      case 'wait':
      case 'retreat':
        return { valid: true };
      
      default:
        return { valid: false, reason: 'Unknown action type' };
    }
  }
}
