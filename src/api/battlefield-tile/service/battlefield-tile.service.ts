import { BattleFieldTileRepository } from '../repository/battlefield-tile.repository';
import { ITile } from '../model/battlefield-tile.model';

/**
 * BattleFieldTile Service
 * 40x40 타일 생성 및 관리
 */
export class BattleFieldTileService {
  constructor(private repository: BattleFieldTileRepository) {}

  /**
   * 도시 타일 조회 (없으면 생성)
   */
  async getOrCreateTiles(sessionId: string, cityId: string) {
    let tiles = await this.repository.findByCityId(sessionId, cityId);
    
    if (!tiles) {
      tiles = await this.generateTilesForCity(sessionId, cityId);
    }
    
    return tiles;
  }

  /**
   * 40x40 타일 생성
   */
  private async generateTilesForCity(sessionId: string, cityId: string) {
    const tiles: ITile[] = [];
    
    // TODO: 1600개 타일 생성
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        tiles.push({
          x,
          y,
          terrainType: this.randomTerrain(x, y),
          movable: true,
          moveCost: 1,
          defenseBonus: 0,
          height: 0,
        });
      }
    }
    
    // TODO: 중앙에 성 배치 (20, 20 기준)
    const castleX = 20;
    const castleY = 20;
    const castleSize = 3;
    
    for (let dy = 0; dy < castleSize; dy++) {
      for (let dx = 0; dx < castleSize; dx++) {
        const idx = (castleY + dy) * 40 + (castleX + dx);
        tiles[idx].terrainType = 'castle';
        tiles[idx].movable = false;
        tiles[idx].defenseBonus = 10;
      }
    }
    
    // TODO: 성벽 배치 (성 주변)
    this.addWalls(tiles, castleX, castleY, castleSize);
    
    // DB에 저장
    return await this.repository.create({
      sessionId,
      cityId,
      tiles,
      castleX,
      castleY,
      castleSize,
    });
  }

  /**
   * 랜덤 지형 생성
   */
  private randomTerrain(x: number, y: number): ITile['terrainType'] {
    // TODO: 지형 생성 로직 (Perlin Noise 등)
    const rand = Math.random();
    
    if (rand < 0.7) return 'plain';
    if (rand < 0.85) return 'forest';
    if (rand < 0.95) return 'hill';
    return 'water';
  }

  /**
   * 성벽 추가
   */
  private addWalls(tiles: ITile[], castleX: number, castleY: number, castleSize: number) {
    // TODO: 성 주변에 wall 타일 배치
    const wallDistance = 1;
    
    for (let y = castleY - wallDistance; y < castleY + castleSize + wallDistance; y++) {
      for (let x = castleX - wallDistance; x < castleX + castleSize + wallDistance; x++) {
        if (x < 0 || x >= 40 || y < 0 || y >= 40) continue;
        
        // 성 타일이 아니고 외곽인 경우
        const isCastle = (
          x >= castleX && x < castleX + castleSize &&
          y >= castleY && y < castleY + castleSize
        );
        
        if (!isCastle) {
          const idx = y * 40 + x;
          tiles[idx].terrainType = 'wall';
          tiles[idx].defenseBonus = 5;
        }
      }
    }
  }

  /**
   * 특정 좌표의 타일 조회
   */
  getTileAt(tiles: ITile[], x: number, y: number): ITile | undefined {
    return tiles.find(t => t.x === x && t.y === y);
  }
}
