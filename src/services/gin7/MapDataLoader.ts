import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../common/logger';

/**
 * Star System data from 은영전지도.md
 */
export interface StarSystemData {
  pixel_x: number;
  pixel_y: number;
  grid_x: number;
  grid_y: number;
  planet_number: number;
  system_id: number;
  system_name_ko: string;
  system_name_en: string;
  faction: string;
}

/**
 * Distance data between star systems
 */
export interface DistanceData {
  from_id: number;
  to_id: number;
  from_name: string;
  to_name: string;
  distance: number;
  path_length: number;
  warp_time_days: number;
}

/**
 * First JSON block structure (star systems and distances)
 */
interface MapDataPart1 {
  star_systems: StarSystemData[];
  distances: DistanceData[];
  grid_info: {
    width: number;
    height: number;
    warp_time_per_grid_days: number;
  };
}

/**
 * Second JSON block structure (grid data)
 */
interface MapDataPart2 {
  width: number;
  height: number;
  passable_cells: number;
  blocked_cells: number;
  grid: number[][];  // 0 = blocked, 1 = passable
}

/**
 * Combined map data
 */
export interface FullMapData {
  starSystems: StarSystemData[];
  distances: DistanceData[];
  gridInfo: {
    width: number;
    height: number;
    warpTimePerGridDays: number;
  };
  grid: number[][];  // [y][x] format: 0 = blocked, 1 = passable
}

/**
 * MapDataLoader
 * Parses the 은영전지도.md file which contains JSON data for the LoGH map
 */
export class MapDataLoader {
  private static readonly MAP_FILE_PATH = path.join(
    __dirname,
    '../../models/gin7/은영전지도.md'
  );

  /**
   * Load and parse the map data from 은영전지도.md
   * The file contains two JSON blocks separated by whitespace,
   * followed by plain text descriptions (which should be ignored)
   */
  public static async loadMapData(): Promise<FullMapData> {
    logger.info('[MapDataLoader] Loading map data from 은영전지도.md');

    try {
      const fileContent = fs.readFileSync(this.MAP_FILE_PATH, 'utf-8');
      
      // Find the split point between two JSON blocks
      // First block ends with "grid_info": {...} }
      // Second block starts with { "width": 100
      
      // Strategy: Find the closing brace of first JSON then the opening of second
      const firstJsonEnd = this.findFirstJsonEnd(fileContent);
      
      if (firstJsonEnd === -1) {
        throw new Error('Could not find the end of first JSON block');
      }

      const firstJsonStr = fileContent.substring(0, firstJsonEnd + 1);
      const remainingContent = fileContent.substring(firstJsonEnd + 1);
      
      // Find the second JSON block
      const secondJsonStart = remainingContent.indexOf('{');
      if (secondJsonStart === -1) {
        throw new Error('Could not find the start of second JSON block');
      }
      
      // Find the end of second JSON (use balanced brace counting)
      const secondJsonRaw = remainingContent.substring(secondJsonStart);
      const secondJsonEnd = this.findFirstJsonEnd(secondJsonRaw);
      if (secondJsonEnd === -1) {
        throw new Error('Could not find the end of second JSON block');
      }
      const secondJsonStr = secondJsonRaw.substring(0, secondJsonEnd + 1);

      // Parse JSON blocks
      const part1: MapDataPart1 = JSON.parse(firstJsonStr);
      const part2: MapDataPart2 = JSON.parse(secondJsonStr);

      // Validate data
      if (!part1.star_systems || !Array.isArray(part1.star_systems)) {
        throw new Error('Invalid star_systems data');
      }
      if (!part2.grid || !Array.isArray(part2.grid)) {
        throw new Error('Invalid grid data');
      }

      // Verify dimensions
      if (part2.width !== 100 || part2.height !== 50) {
        logger.warn(`[MapDataLoader] Unexpected dimensions: ${part2.width}x${part2.height}`);
      }
      if (part2.grid.length !== part2.height) {
        logger.warn(`[MapDataLoader] Grid height mismatch: expected ${part2.height}, got ${part2.grid.length}`);
      }

      const result: FullMapData = {
        starSystems: part1.star_systems,
        distances: part1.distances || [],
        gridInfo: {
          width: part1.grid_info?.width || part2.width,
          height: part1.grid_info?.height || part2.height,
          warpTimePerGridDays: part1.grid_info?.warp_time_per_grid_days || 1.0,
        },
        grid: part2.grid,
      };

      logger.info(
        `[MapDataLoader] Loaded ${result.starSystems.length} star systems, ` +
        `${result.distances.length} distance entries, ` +
        `${result.gridInfo.width}x${result.gridInfo.height} grid`
      );

      return result;
    } catch (error) {
      logger.error('[MapDataLoader] Failed to load map data:', error);
      throw error;
    }
  }

  /**
   * Find the index of the closing brace that ends the first JSON block
   */
  private static findFirstJsonEnd(content: string): number {
    let braceCount = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Get star system by ID
   */
  public static getSystemById(data: FullMapData, systemId: number): StarSystemData | undefined {
    return data.starSystems.find(s => s.system_id === systemId);
  }

  /**
   * Get star systems by faction
   */
  public static getSystemsByFaction(data: FullMapData, faction: string): StarSystemData[] {
    return data.starSystems.filter(s => s.faction === faction);
  }

  /**
   * Check if a grid cell is passable
   */
  public static isPassable(data: FullMapData, x: number, y: number): boolean {
    if (y < 0 || y >= data.grid.length) return false;
    if (x < 0 || x >= (data.grid[0]?.length || 0)) return false;
    return data.grid[y][x] === 1;
  }

  /**
   * Get the distance between two systems
   */
  public static getDistance(data: FullMapData, fromId: number, toId: number): DistanceData | undefined {
    return data.distances.find(
      d => (d.from_id === fromId && d.to_id === toId) ||
           (d.from_id === toId && d.to_id === fromId)
    );
  }

  /**
   * Get all systems at a specific grid coordinate
   */
  public static getSystemsAtGrid(data: FullMapData, x: number, y: number): StarSystemData[] {
    return data.starSystems.filter(s => s.grid_x === x && s.grid_y === y);
  }

  /**
   * Convert faction name from Korean to internal code
   */
  public static factionToCode(faction: string): string {
    switch (faction) {
      case '은하제국':
        return 'faction_empire';
      case '자유행성동맹':
        return 'faction_alliance';
      case '페잔 자치령':
        return 'faction_fezzan';
      default:
        return 'faction_neutral';
    }
  }

  /**
   * Get grid statistics
   */
  public static getGridStats(data: FullMapData): { passable: number; blocked: number; total: number } {
    let passable = 0;
    let blocked = 0;

    for (const row of data.grid) {
      for (const cell of row) {
        if (cell === 1) passable++;
        else blocked++;
      }
    }

    return { passable, blocked, total: passable + blocked };
  }
}

