/**
 * 전술전투 맵 생성 서비스
 * 20x20 격자 맵 + 7x7 중앙 성곽
 */

import { 
  TerrainType, 
  TerrainCell,
  Position,
  TerrainProperties 
} from '../../models/tactical_battle.model';

// ============================================================
// 맵 템플릿 설정
// ============================================================

export interface MapGeneratorConfig {
  width: number;
  height: number;
  castleSize: number;       // 성 크기 (7x7)
  gateHp: number;           // 성문 HP
  wallHp: number;           // 성벽 HP
  forestDensity: number;    // 숲 밀도 (0-1)
  mountainDensity: number;  // 산 밀도 (0-1)
  hasRiver: boolean;        // 강 유무
  riverDirection: 'horizontal' | 'vertical' | 'none';
}

const DEFAULT_CONFIG: MapGeneratorConfig = {
  width: 20,
  height: 20,
  castleSize: 7,
  gateHp: 5000,
  wallHp: 10000,
  forestDensity: 0.15,
  mountainDensity: 0.1,
  hasRiver: false,
  riverDirection: 'none',
};

// ============================================================
// 맵 생성 서비스
// ============================================================

export class TacticalMapGeneratorService {
  
  /**
   * 기본 전술맵 생성
   */
  static generate(config: Partial<MapGeneratorConfig> = {}): TerrainCell[][] {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const { width, height } = cfg;
    
    // 1. 빈 맵 생성 (모두 평지)
    const terrain: TerrainCell[][] = [];
    for (let y = 0; y < height; y++) {
      terrain[y] = [];
      for (let x = 0; x < width; x++) {
        terrain[y][x] = { type: TerrainType.PLAIN };
      }
    }
    
    // 2. 중앙 성곽 배치
    this.placeCastle(terrain, cfg);
    
    // 3. 지형 배치 (성곽 제외)
    this.placeForests(terrain, cfg);
    this.placeMountains(terrain, cfg);
    
    // 4. 강 배치 (옵션)
    if (cfg.hasRiver) {
      this.placeRiver(terrain, cfg);
    }
    
    return terrain;
  }
  
  /**
   * 도시 레벨에 따른 맵 생성
   */
  static generateByCity(cityLevel: number, cityRegion?: string): TerrainCell[][] {
    // 도시 레벨에 따라 설정 조정
    const config: Partial<MapGeneratorConfig> = {};
    
    // 레벨 높을수록 성문/성벽 HP 증가
    config.gateHp = 3000 + cityLevel * 500;
    config.wallHp = 8000 + cityLevel * 1000;
    
    // 지역에 따른 지형 변화
    if (cityRegion) {
      const regionLower = cityRegion.toLowerCase();
      if (regionLower.includes('산') || regionLower.includes('mountain')) {
        config.mountainDensity = 0.25;
        config.forestDensity = 0.1;
      } else if (regionLower.includes('강') || regionLower.includes('river')) {
        config.hasRiver = true;
        config.riverDirection = 'horizontal';
        config.forestDensity = 0.1;
      } else if (regionLower.includes('숲') || regionLower.includes('forest')) {
        config.forestDensity = 0.3;
      }
    }
    
    return this.generate(config);
  }
  
  /**
   * 중앙 성곽 배치 (7x7)
   * 
   * 구조:
   * 🧱🧱🧱🚪🧱🧱🧱
   * 🧱          🧱
   * 🧱          🧱
   * 🚪    🏯    🚪
   * 🧱          🧱
   * 🧱          🧱
   * 🧱🧱🧱🚪🧱🧱🧱
   */
  private static placeCastle(terrain: TerrainCell[][], cfg: MapGeneratorConfig): void {
    const { width, height, castleSize, gateHp, wallHp } = cfg;
    
    // 성 시작 위치 (중앙 정렬)
    const startX = Math.floor((width - castleSize) / 2);
    const startY = Math.floor((height - castleSize) / 2);
    const endX = startX + castleSize - 1;
    const endY = startY + castleSize - 1;
    const midX = startX + Math.floor(castleSize / 2);
    const midY = startY + Math.floor(castleSize / 2);
    
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const isTop = y === startY;
        const isBottom = y === endY;
        const isLeft = x === startX;
        const isRight = x === endX;
        const isBorder = isTop || isBottom || isLeft || isRight;
        const isMidX = x === midX;
        const isMidY = y === midY;
        
        if (isBorder) {
          // 성문 위치 (상하좌우 중앙)
          if ((isTop && isMidX) || (isBottom && isMidX) || 
              (isLeft && isMidY) || (isRight && isMidY)) {
            terrain[y][x] = {
              type: TerrainType.GATE,
              hp: gateHp,
              maxHp: gateHp,
              destroyed: false,
            };
          } else {
            // 성벽
            terrain[y][x] = {
              type: TerrainType.WALL,
              hp: wallHp,
              maxHp: wallHp,
              destroyed: false,
            };
          }
        } else if (isMidX && isMidY) {
          // 본진 (중앙)
          terrain[y][x] = { type: TerrainType.HEADQUARTERS };
        } else {
          // 성 내부
          terrain[y][x] = { type: TerrainType.CASTLE };
        }
      }
    }
  }
  
  /**
   * 숲 배치
   */
  private static placeForests(terrain: TerrainCell[][], cfg: MapGeneratorConfig): void {
    const { width, height, forestDensity, castleSize } = cfg;
    const castleStart = Math.floor((width - castleSize) / 2) - 1;
    const castleEnd = castleStart + castleSize + 1;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 성 주변은 건너뛰기
        if (x >= castleStart && x <= castleEnd && y >= castleStart && y <= castleEnd) {
          continue;
        }
        
        // 이미 다른 지형이면 건너뛰기
        if (terrain[y][x].type !== TerrainType.PLAIN) {
          continue;
        }
        
        // 랜덤하게 숲 배치
        if (Math.random() < forestDensity) {
          terrain[y][x] = { type: TerrainType.FOREST };
        }
      }
    }
  }
  
  /**
   * 산 배치 (주로 가장자리)
   */
  private static placeMountains(terrain: TerrainCell[][], cfg: MapGeneratorConfig): void {
    const { width, height, mountainDensity, castleSize } = cfg;
    const castleStart = Math.floor((width - castleSize) / 2) - 1;
    const castleEnd = castleStart + castleSize + 1;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 성 주변은 건너뛰기
        if (x >= castleStart && x <= castleEnd && y >= castleStart && y <= castleEnd) {
          continue;
        }
        
        // 이미 다른 지형이면 건너뛰기
        if (terrain[y][x].type !== TerrainType.PLAIN) {
          continue;
        }
        
        // 가장자리에 산 배치 확률 증가
        const edgeBonus = (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) ? 0.2 : 0;
        
        if (Math.random() < mountainDensity + edgeBonus) {
          terrain[y][x] = { type: TerrainType.MOUNTAIN };
        }
      }
    }
  }
  
  /**
   * 강 배치
   */
  private static placeRiver(terrain: TerrainCell[][], cfg: MapGeneratorConfig): void {
    const { width, height, riverDirection, castleSize } = cfg;
    const castleStart = Math.floor((width - castleSize) / 2);
    const castleEnd = castleStart + castleSize;
    
    if (riverDirection === 'horizontal') {
      // 수평 강 (상단 또는 하단)
      const riverY = Math.random() < 0.5 ? 2 : height - 3;
      for (let x = 0; x < width; x++) {
        if (x >= castleStart - 2 && x <= castleEnd + 1) continue; // 성 근처 제외
        terrain[riverY][x] = { type: TerrainType.WATER };
        if (riverY + 1 < height) {
          terrain[riverY + 1][x] = { type: TerrainType.WATER };
        }
      }
    } else if (riverDirection === 'vertical') {
      // 수직 강 (좌측 또는 우측)
      const riverX = Math.random() < 0.5 ? 2 : width - 3;
      for (let y = 0; y < height; y++) {
        if (y >= castleStart - 2 && y <= castleEnd + 1) continue;
        terrain[y][riverX] = { type: TerrainType.WATER };
        if (riverX + 1 < width) {
          terrain[y][riverX + 1] = { type: TerrainType.WATER };
        }
      }
    }
  }
  
  /**
   * 공격측 배치 가능 위치 반환
   */
  static getAttackerSpawnPoints(terrain: TerrainCell[][], cfg: Partial<MapGeneratorConfig> = {}): Position[] {
    const config = { ...DEFAULT_CONFIG, ...cfg };
    const { width, height, castleSize } = config;
    const points: Position[] = [];
    
    // 하단 3줄에서 평지만 선택
    for (let y = height - 4; y < height - 1; y++) {
      for (let x = 3; x < width - 3; x++) {
        if (terrain[y][x].type === TerrainType.PLAIN || 
            terrain[y][x].type === TerrainType.FOREST) {
          points.push({ x, y });
        }
      }
    }
    
    return points;
  }
  
  /**
   * 방어측 배치 가능 위치 반환 (성 내부)
   */
  static getDefenderSpawnPoints(terrain: TerrainCell[][], cfg: Partial<MapGeneratorConfig> = {}): Position[] {
    const config = { ...DEFAULT_CONFIG, ...cfg };
    const { width, height, castleSize } = config;
    const points: Position[] = [];
    
    const startX = Math.floor((width - castleSize) / 2);
    const startY = Math.floor((height - castleSize) / 2);
    const endX = startX + castleSize - 1;
    const endY = startY + castleSize - 1;
    
    // 성 내부 (벽 제외)
    for (let y = startY + 1; y < endY; y++) {
      for (let x = startX + 1; x < endX; x++) {
        if (terrain[y][x].type === TerrainType.CASTLE || 
            terrain[y][x].type === TerrainType.HEADQUARTERS) {
          points.push({ x, y });
        }
      }
    }
    
    return points;
  }
  
  /**
   * 성문 위치 반환
   */
  static getGatePositions(terrain: TerrainCell[][], cfg: Partial<MapGeneratorConfig> = {}): Position[] {
    const config = { ...DEFAULT_CONFIG, ...cfg };
    const { width, height } = config;
    const gates: Position[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x].type === TerrainType.GATE) {
          gates.push({ x, y });
        }
      }
    }
    
    return gates;
  }
  
  /**
   * 본진 위치 반환
   */
  static getHeadquartersPosition(terrain: TerrainCell[][], cfg: Partial<MapGeneratorConfig> = {}): Position | null {
    const config = { ...DEFAULT_CONFIG, ...cfg };
    const { width, height } = config;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x].type === TerrainType.HEADQUARTERS) {
          return { x, y };
        }
      }
    }
    
    return null;
  }
  
  /**
   * 맵을 텍스트로 출력 (디버깅용)
   */
  static printMap(terrain: TerrainCell[][]): string {
    const symbols: Record<TerrainType, string> = {
      [TerrainType.PLAIN]: '  ',
      [TerrainType.FOREST]: '🌲',
      [TerrainType.MOUNTAIN]: '🏔️',
      [TerrainType.WATER]: '💧',
      [TerrainType.WALL]: '🧱',
      [TerrainType.GATE]: '🚪',
      [TerrainType.CASTLE]: '🏠',
      [TerrainType.HEADQUARTERS]: '🏯',
    };
    
    let output = '';
    for (let y = 0; y < terrain.length; y++) {
      for (let x = 0; x < terrain[y].length; x++) {
        const cell = terrain[y][x];
        // 파괴된 성문은 빈칸
        if (cell.type === TerrainType.GATE && cell.destroyed) {
          output += '  ';
        } else {
          output += symbols[cell.type] || '??';
        }
      }
      output += '\n';
    }
    
    return output;
  }
  
  /**
   * 맵 직렬화 (JSON 저장용)
   */
  static serialize(terrain: TerrainCell[][]): string {
    return JSON.stringify(terrain);
  }
  
  /**
   * 맵 역직렬화
   */
  static deserialize(data: string): TerrainCell[][] {
    return JSON.parse(data);
  }
}













