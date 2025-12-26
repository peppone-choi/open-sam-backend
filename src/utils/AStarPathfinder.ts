export interface GridPos {
  x: number;
  y: number;
}

export interface PathNode extends GridPos {
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost
  parent?: PathNode;
}

export interface AStarConfig {
  width: number;
  height: number;
  cellSize: number;
  getTerrainCost: (pos: GridPos) => number; // 1.0 = normal, higher = harder, Infinity = blocked
}

export class AStarPathfinder {
  private config: AStarConfig;

  constructor(config: AStarConfig) {
    this.config = config;
  }

  /**
   * World coordinates (px) to Grid coordinates
   */
  toGrid(px: { x: number; y: number }): GridPos {
    return {
      x: Math.floor(px.x / this.config.cellSize),
      y: Math.floor(px.y / this.config.cellSize)
    };
  }

  /**
   * Grid coordinates to World coordinates (center of cell)
   */
  toWorld(grid: GridPos): { x: number; y: number } {
    return {
      x: grid.x * this.config.cellSize + this.config.cellSize / 2,
      y: grid.y * this.config.cellSize + this.config.cellSize / 2
    };
  }

  /**
   * Find path from start to end in world coordinates
   */
  findPath(startPx: { x: number; y: number }, endPx: { x: number; y: number }): Array<{ x: number; y: number }> | null {
    const start = this.toGrid(startPx);
    const end = this.toGrid(endPx);

    // Grid bounds check
    if (end.x < 0 || end.x >= this.config.width || end.y < 0 || end.y >= this.config.height) {
      return null;
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      ...start,
      g: 0,
      h: this.heuristic(start, end),
      f: 0
    };
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f cost
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Found destination
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(current);
      }

      // Move from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.y}`);

      // Check neighbors
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) {
          continue;
        }

        const terrainCost = this.config.getTerrainCost(neighbor);
        if (terrainCost === Infinity) {
          continue;
        }

        const gScore = current.g + terrainCost;
        
        let existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);

        if (!existingNode) {
          const newNode: PathNode = {
            ...neighbor,
            g: gScore,
            h: this.heuristic(neighbor, end),
            f: 0,
            parent: current
          };
          newNode.f = newNode.g + newNode.h;
          openSet.push(newNode);
        } else if (gScore < existingNode.g) {
          existingNode.g = gScore;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    return null; // No path found
  }

  private heuristic(a: GridPos, b: GridPos): number {
    // Octile distance for 8-way movement
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const F = Math.SQRT2 - 1;
    return (dx < dy) ? F * dx + dy : F * dy + dx;
  }

  private getNeighbors(pos: GridPos): GridPos[] {
    const neighbors: GridPos[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const nx = pos.x + dx;
        const ny = pos.y + dy;

        if (nx >= 0 && nx < this.config.width && ny >= 0 && ny < this.config.height) {
          // Prevent diagonal movement if adjacent cells are blocked
          if (dx !== 0 && dy !== 0) {
            if (this.config.getTerrainCost({ x: pos.x + dx, y: pos.y }) === Infinity ||
                this.config.getTerrainCost({ x: pos.x, y: pos.y + dy }) === Infinity) {
              continue;
            }
          }
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    return neighbors;
  }

  private reconstructPath(node: PathNode): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = [];
    let current: PathNode | undefined = node;
    while (current) {
      path.push(this.toWorld(current));
      current = current.parent;
    }
    return path.reverse();
  }
}
