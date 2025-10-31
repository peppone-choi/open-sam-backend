/**
 * BattleAI - AFK 플레이어 자동 제어
 * 
 * 간단한 휴리스틱 기반 AI로 AFK 플레이어의 유닛을 제어
 */

import {
  BattleUnit3D,
  BattleState,
  Action,
  Position3D,
  UnitType,
  BattleTile3D
} from './types';
import { BattleValidator } from './BattleValidator';

interface Target {
  position: Position3D;
  priority: number;
  type: 'enemy' | 'gate' | 'wall' | 'throne';
  id?: string;
}

export class BattleAI {
  private validator: BattleValidator;

  constructor() {
    this.validator = new BattleValidator();
  }

  decideAction(unit: BattleUnit3D, state: BattleState): Action {
    if (unit.hp <= 0) {
      return { type: 'wait', unitId: unit.id };
    }

    if (unit.morale < 30 && unit.hp < unit.maxHp * 0.3) {
      return this.retreatAction(unit, state);
    }

    const targets = this.findTargets(unit, state);
    if (targets.length === 0) {
      return { type: 'defend', unitId: unit.id };
    }

    const bestTarget = targets[0];

    const enemyTarget = state.units.get(bestTarget.id || '');
    if (enemyTarget && this.validator.canAttack(unit, enemyTarget, state.map).valid) {
      return { type: 'attack', unitId: unit.id, targetId: enemyTarget.id };
    }

    const path = this.pathfindWithHeight(unit.position, bestTarget.position, state);
    if (path.length > 0) {
      const movePath = path.slice(0, unit.speed + 1);
      return { type: 'move', unitId: unit.id, path: movePath };
    }

    return { type: 'defend', unitId: unit.id };
  }

  findBestTarget(unit: BattleUnit3D, state: BattleState): Target | null {
    const targets = this.findTargets(unit, state);
    return targets.length > 0 ? targets[0] : null;
  }

  pathfindWithHeight(
    start: Position3D,
    goal: Position3D,
    state: BattleState
  ): Position3D[] {
    interface Node {
      pos: Position3D;
      g: number;
      h: number;
      f: number;
      parent: Node | null;
    }

    const openSet: Node[] = [];
    const closedSet = new Set<string>();

    const startNode: Node = {
      pos: start,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      const key = `${current.pos.x},${current.pos.y},${current.pos.z}`;
      if (closedSet.has(key)) continue;
      closedSet.add(key);

      if (this.positionsEqual(current.pos, goal)) {
        return this.reconstructPath(current);
      }

      const neighbors = this.getNeighbors(current.pos, state);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
        if (closedSet.has(neighborKey)) continue;

        const moveCost = this.getMoveCost(current.pos, neighbor, state);
        const g = current.g + moveCost;
        const h = this.heuristic(neighbor, goal);
        const f = g + h;

        const existing = openSet.find(n => 
          n.pos.x === neighbor.x && 
          n.pos.y === neighbor.y && 
          n.pos.z === neighbor.z
        );

        if (!existing || g < existing.g) {
          const node: Node = { pos: neighbor, g, h, f, parent: current };
          if (!existing) {
            openSet.push(node);
          } else {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        }
      }
    }

    return [];
  }

  private findTargets(unit: BattleUnit3D, state: BattleState): Target[] {
    const targets: Target[] = [];

    for (const [enemyId, enemy] of state.units) {
      if (enemy.side === unit.side || enemy.hp <= 0) continue;

      const distance = this.validator.getDistance3D(unit.position, enemy.position);
      let priority = 100 - distance;

      if (enemy.unitType === UnitType.ARCHER) priority += 20;
      if (enemy.unitType === UnitType.WIZARD) priority += 15;
      if (enemy.hp < enemy.maxHp * 0.3) priority += 10;

      targets.push({
        position: enemy.position,
        priority,
        type: 'enemy',
        id: enemyId
      });
    }

    if (unit.side === 'attacker') {
      for (const building of state.buildings) {
        const distance = this.validator.getDistance3D(
          unit.position,
          { x: building.z, y: building.z, z: 0 }
        );

        let priority = 0;
        if (building.type === 'throne') {
          priority = 200 - distance;
        } else if (building.type === 'gate') {
          priority = 150 - distance;
        } else if (building.type === 'wall') {
          priority = 100 - distance;
        }

        if (priority > 0) {
          targets.push({
            position: { x: building.z, y: building.z, z: building.z },
            priority,
            type: building.type === 'tower' ? 'wall' : building.type
          });
        }
      }
    }

    targets.sort((a, b) => b.priority - a.priority);
    return targets;
  }

  private retreatAction(unit: BattleUnit3D, state: BattleState): Action {
    const retreatPos = this.findSafePosition(unit, state);
    
    if (retreatPos) {
      const path = this.pathfindWithHeight(unit.position, retreatPos, state);
      if (path.length > 0) {
        return { type: 'move', unitId: unit.id, path: path.slice(0, unit.speed + 1) };
      }
    }

    return { type: 'retreat', unitId: unit.id };
  }

  private findSafePosition(unit: BattleUnit3D, state: BattleState): Position3D | null {
    const enemyPositions = Array.from(state.units.values())
      .filter(u => u.side !== unit.side && u.hp > 0)
      .map(u => u.position);

    let bestPos: Position3D | null = null;
    let maxDistance = 0;

    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        const pos: Position3D = {
          x: unit.position.x + dx,
          y: unit.position.y + dy,
          z: unit.position.z
        };

        if (!this.validator.isInBounds(pos, state.map)) continue;

        const tile = state.map[pos.y][pos.x];
        if (!tile.walkable) continue;

        const minEnemyDist = Math.min(
          ...enemyPositions.map(ep => this.validator.getDistance3D(pos, ep))
        );

        if (minEnemyDist > maxDistance) {
          maxDistance = minEnemyDist;
          bestPos = pos;
        }
      }
    }

    return bestPos;
  }

  private getNeighbors(pos: Position3D, state: BattleState): Position3D[] {
    const neighbors: Position3D[] = [];
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];

    for (const { dx, dy } of directions) {
      const newPos: Position3D = {
        x: pos.x + dx,
        y: pos.y + dy,
        z: pos.z
      };

      if (!this.validator.isInBounds(newPos, state.map)) continue;

      const tile = state.map[newPos.y][newPos.x];
      if (tile.walkable) {
        newPos.z = tile.z;
        neighbors.push(newPos);
      }

      if (Math.abs(tile.z - pos.z) <= 2) {
        neighbors.push({ ...newPos, z: tile.z });
      }
    }

    return neighbors;
  }

  private getMoveCost(from: Position3D, to: Position3D, state: BattleState): number {
    const heightDiff = Math.abs(to.z - from.z);
    const tile = state.map[to.y][to.x];

    let cost = 1;

    if (to.z > from.z) {
      cost += heightDiff;
    } else if (to.z < from.z) {
      cost += Math.floor(heightDiff / 2);
    }

    return cost;
  }

  private heuristic(from: Position3D, to: Position3D): number {
    return Math.abs(from.x - to.x) + 
           Math.abs(from.y - to.y) + 
           Math.abs(from.z - to.z) * 2;
  }

  private reconstructPath(node: Node | null): Position3D[] {
    const path: Position3D[] = [];
    let current = node;

    while (current) {
      path.unshift(current.pos);
      current = current.parent;
    }

    return path;
  }

  private positionsEqual(a: Position3D, b: Position3D): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }
}

interface Node {
  pos: Position3D;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}
