/**
 * BattleFieldTile 도메인 타입 정의
 */

export interface ITile {
  x: number;
  y: number;
  terrainType: 'plain' | 'forest' | 'hill' | 'water' | 'castle' | 'wall';
  movable: boolean;
  moveCost: number;
  defenseBonus: number;
  height: number;
}

export interface IBattleFieldTile {
  id: string;
  sessionId: string;
  cityId: string;
  
  // 40x40 = 1600개 타일
  tiles: ITile[];
  
  // 성 정보
  castleX: number;
  castleY: number;
  castleSize: number;
  
  createdAt: Date;
  updatedAt: Date;
}
