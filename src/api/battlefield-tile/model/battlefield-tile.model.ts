import { Schema, model, Document } from 'mongoose';

/**
 * BattleFieldTile Schema
 * 도시당 40x40 = 1600개 타일을 미리 생성하여 저장
 */

export interface ITile {
  x: number;
  y: number;
  terrainType: 'plain' | 'forest' | 'hill' | 'water' | 'castle' | 'wall';
  movable: boolean;
  moveCost: number; // 이동 비용 (1 = 기본)
  defenseBonus: number; // 방어 보너스
  height: number; // 높이 (지형 효과)
}

export interface IBattleFieldTileDocument extends Document {
  sessionId: string;
  cityId: string;
  
  // 40x40 타일 배열 (1600개)
  tiles: ITile[];
  
  // 성 정보
  castleX: number;
  castleY: number;
  castleSize: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const TileSchema = new Schema<ITile>({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  terrainType: { 
    type: String, 
    enum: ['plain', 'forest', 'hill', 'water', 'castle', 'wall'],
    required: true 
  },
  movable: { type: Boolean, default: true },
  moveCost: { type: Number, default: 1 },
  defenseBonus: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
}, { _id: false });

const BattleFieldTileSchema = new Schema<IBattleFieldTileDocument>({
  sessionId: { type: String, required: true },
  cityId: { type: String, required: true },
  
  // 1600개 타일 배열
  tiles: { type: [TileSchema], required: true },
  
  // 성 위치
  castleX: { type: Number, required: true, default: 20 },
  castleY: { type: Number, required: true, default: 20 },
  castleSize: { type: Number, required: true, default: 3 },
}, { timestamps: true });

// 인덱스
BattleFieldTileSchema.index({ sessionId: 1, cityId: 1 }, { unique: true });

export const BattleFieldTileModel = model<IBattleFieldTileDocument>(
  'BattleFieldTile', 
  BattleFieldTileSchema
);
