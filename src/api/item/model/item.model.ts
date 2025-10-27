import { Schema, model, Document } from 'mongoose';

/**
 * Item Schema
 * TODO: schema.sql에 item 테이블 없음. 장비 시스템 정의 필요
 * General 테이블의 weapon, book, horse, item 필드 참조
 */
export interface IItemDocument extends Document {
  sessionId: string;
  
  // 아이템 정보
  name: string;
  type: 'weapon' | 'book' | 'horse' | 'item';
  
  // 능력치 보너스
  leadershipBonus?: number;
  strengthBonus?: number;
  intelBonus?: number;
  
  // 특수 효과
  specialEffect?: string;
  
  // 등급/희귀도
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  
  // 소유자
  ownerId?: string; // General ID
  
  // 설명
  description?: string;
}

const ItemSchema = new Schema<IItemDocument>({
  sessionId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['weapon', 'book', 'horse', 'item'], required: true },
  leadershipBonus: { type: Number, default: 0 },
  strengthBonus: { type: Number, default: 0 },
  intelBonus: { type: Number, default: 0 },
  specialEffect: { type: String },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  ownerId: { type: String },
  description: { type: String },
}, { timestamps: true });

ItemSchema.index({ sessionId: 1, ownerId: 1 });
ItemSchema.index({ sessionId: 1, type: 1 });

export const ItemModel = model<IItemDocument>('Item', ItemSchema);
