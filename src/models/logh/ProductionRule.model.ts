/**
 * ProductionRule Model
 * 지역별 자동 생산 규칙 정의
 * gin7manual.txt의 자동생산 데이터 기반
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProductionRule extends Document {
  session_id: string;
  
  // 위치 정보
  locationId: string; // 행성/요새 ID (e.g., "odin", "heinessen")
  locationName: string; // 표시명
  faction: 'empire' | 'alliance' | 'neutral';
  
  // 생산 품목
  items: {
    itemType: string; // 함선 종류 (일본어, e.g., "戦艦Ⅰ")
    itemTypeKo?: string; // 한국어명 (e.g., "전함Ⅰ")
    itemTypeEn?: string; // 영문명 (e.g., "Battleship I")
    rate: number; // 생산 속도 (턴당 생산량)
    enabled: boolean; // 생산 활성화 여부
  }[];
  
  // 생산 조건
  requirements: {
    minIndustry: number; // 최소 공업력
    minTechnology: number; // 최소 기술력
    requiredFacility?: string; // 필요 시설 (e.g., "조병공창")
  };
  
  // 자동 생산 설정
  autoProduction: {
    enabled: boolean; // 자동 생산 활성화
    interval: number; // 생산 주기 (턴 단위)
    lastProductionTurn: number; // 마지막 생산 턴
  };
  
  // 상태
  isActive: boolean;
  
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductionRuleSchema = new Schema<IProductionRule>(
  {
    session_id: { type: String, required: true },
    
    locationId: { type: String, required: true },
    locationName: { type: String, required: true },
    faction: { 
      type: String, 
      enum: ['empire', 'alliance', 'neutral'],
      required: true 
    },
    
    items: [{
      itemType: { type: String, required: true },
      itemTypeKo: { type: String },
      itemTypeEn: { type: String },
      rate: { type: Number, default: 1 },
      enabled: { type: Boolean, default: true },
    }],
    
    requirements: {
      minIndustry: { type: Number, default: 0 },
      minTechnology: { type: Number, default: 0 },
      requiredFacility: { type: String },
    },
    
    autoProduction: {
      enabled: { type: Boolean, default: true },
      interval: { type: Number, default: 1 }, // 매 턴
      lastProductionTurn: { type: Number, default: 0 },
    },
    
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// 복합 인덱스
ProductionRuleSchema.index({ session_id: 1, locationId: 1 }, { unique: true });
ProductionRuleSchema.index({ session_id: 1, faction: 1 });

export const ProductionRule = mongoose.model<IProductionRule>('ProductionRule', ProductionRuleSchema);

// 함선 종류 매핑 (일본어 -> 한국어/영어)
export const SHIP_TYPE_MAPPING: Record<string, { ko: string; en: string }> = {
  '戦艦Ⅰ': { ko: '전함Ⅰ', en: 'Battleship I' },
  '戦艦Ⅱ': { ko: '전함Ⅱ', en: 'Battleship II' },
  '戦艦Ⅲ': { ko: '전함Ⅲ', en: 'Battleship III' },
  '戦艦Ⅳ': { ko: '전함Ⅳ', en: 'Battleship IV' },
  '戦艦Ⅴ': { ko: '전함Ⅴ', en: 'Battleship V' },
  '戦艦Ⅵ': { ko: '전함Ⅵ', en: 'Battleship VI' },
  '戦艦Ⅶ': { ko: '전함Ⅶ', en: 'Battleship VII' },
  '戦艦Ⅷ': { ko: '전함Ⅷ', en: 'Battleship VIII' },
  '高速戦艦Ⅰ': { ko: '고속전함Ⅰ', en: 'Fast Battleship I' },
  '高速戦艦Ⅱ': { ko: '고속전함Ⅱ', en: 'Fast Battleship II' },
  '高速戦艦Ⅲ': { ko: '고속전함Ⅲ', en: 'Fast Battleship III' },
  '高速戦艦Ⅳ': { ko: '고속전함Ⅳ', en: 'Fast Battleship IV' },
  '高速戦艦Ⅴ': { ko: '고속전함Ⅴ', en: 'Fast Battleship V' },
  '巡航艦Ⅰ': { ko: '순양함Ⅰ', en: 'Cruiser I' },
  '巡航艦Ⅱ': { ko: '순양함Ⅱ', en: 'Cruiser II' },
  '巡航艦Ⅲ': { ko: '순양함Ⅲ', en: 'Cruiser III' },
  '巡航艦Ⅳ': { ko: '순양함Ⅳ', en: 'Cruiser IV' },
  '巡航艦Ⅴ': { ko: '순양함Ⅴ', en: 'Cruiser V' },
  '巡航艦Ⅵ': { ko: '순양함Ⅵ', en: 'Cruiser VI' },
  '巡航艦Ⅶ': { ko: '순양함Ⅶ', en: 'Cruiser VII' },
  '巡航艦Ⅷ': { ko: '순양함Ⅷ', en: 'Cruiser VIII' },
  '打撃巡航艦Ⅰ': { ko: '타격순양함Ⅰ', en: 'Strike Cruiser I' },
  '打撃巡航艦Ⅱ': { ko: '타격순양함Ⅱ', en: 'Strike Cruiser II' },
  '打撃巡航艦Ⅲ': { ko: '타격순양함Ⅲ', en: 'Strike Cruiser III' },
  '駆逐艦Ⅰ': { ko: '구축함Ⅰ', en: 'Destroyer I' },
  '駆逐艦Ⅱ': { ko: '구축함Ⅱ', en: 'Destroyer II' },
  '駆逐艦Ⅲ': { ko: '구축함Ⅲ', en: 'Destroyer III' },
  '雷撃艇母艦Ⅰ': { ko: '뇌격정모함Ⅰ', en: 'Torpedo Boat Carrier I' },
  '雷撃艇母艦Ⅱ': { ko: '뇌격정모함Ⅱ', en: 'Torpedo Boat Carrier II' },
  '雷撃艇母艦Ⅲ': { ko: '뇌격정모함Ⅲ', en: 'Torpedo Boat Carrier III' },
  '雷撃艇母艦Ⅳ': { ko: '뇌격정모함Ⅳ', en: 'Torpedo Boat Carrier IV' },
  '戦闘艇母艦Ⅰ': { ko: '전투정모함Ⅰ', en: 'Fighter Carrier I' },
  '戦闘艇母艦Ⅱ': { ko: '전투정모함Ⅱ', en: 'Fighter Carrier II' },
  '戦闘艇母艦Ⅲ': { ko: '전투정모함Ⅲ', en: 'Fighter Carrier III' },
  '揚陸艦Ⅰ': { ko: '양륙함Ⅰ', en: 'Landing Ship I' },
  '揚陸艦Ⅱ': { ko: '양륙함Ⅱ', en: 'Landing Ship II' },
  '揚陸艦Ⅲ': { ko: '양륙함Ⅲ', en: 'Landing Ship III' },
  '揚陸艦Ⅳ': { ko: '양륙함Ⅳ', en: 'Landing Ship IV' },
  '揚陸艇Ⅰ': { ko: '양륙정Ⅰ', en: 'Landing Craft I' },
  '揚陸艇Ⅱ': { ko: '양륙정Ⅱ', en: 'Landing Craft II' },
  '揚陸艇Ⅲ': { ko: '양륙정Ⅲ', en: 'Landing Craft III' },
  '揚陸艇Ⅳ': { ko: '양륙정Ⅳ', en: 'Landing Craft IV' },
};

// gin7manual.txt의 자동생산 데이터 (제국)
export const EMPIRE_PRODUCTION_DATA: Record<string, string[]> = {
  'gaiesburg_fortress': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '雷撃艇母艦Ⅰ', '巡航艦Ⅵ'],
  'iserlohn_fortress': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '高速戦艦Ⅴ', '雷撃艇母艦Ⅳ'],
  'rentenberg_fortress': ['戦艦Ⅰ', '駆逐艦Ⅱ'],
  'odin': ['戦艦Ⅰ', '高速戦艦Ⅰ', '高速戦艦Ⅱ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '駆逐艦Ⅱ'],
  'hafen': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ'],
  'nachrodt': ['巡航艦Ⅷ'],
  'neuenrade': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ'],
  'teutoburg': ['雷撃艇母艦Ⅱ', '雷撃艇母艦Ⅲ', '巡航艦Ⅶ'],
  'frey': ['戦艦Ⅰ', '駆逐艦Ⅱ'],
};

// gin7manual.txt의 자동생산 데이터 (동맹)
export const ALLIANCE_PRODUCTION_DATA: Record<string, string[]> = {
  'heinessen': ['戦艦Ⅰ', '巡航艦Ⅰ', '巡航艦Ⅱ', '巡航艦Ⅲ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ', '戦闘艇母艦Ⅱ', '戦闘艇母艦Ⅲ'],
  'santa_ana': ['戦艦Ⅰ', '巡航艦Ⅰ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'],
  'salvador': ['揚陸艇Ⅳ'],
  'kampala': ['戦艦Ⅰ', '巡航艦Ⅰ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'],
  'bafra': ['戦艦Ⅵ'],
  'osiris': ['戦艦Ⅰ', '巡航艦Ⅰ', '巡航艦Ⅷ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'],
};

// 행성 이름 매핑
export const LOCATION_NAMES: Record<string, { ko: string; en: string }> = {
  'odin': { ko: '오딘', en: 'Odin' },
  'heinessen': { ko: '하이네센', en: 'Heinessen' },
  'gaiesburg_fortress': { ko: '가이에스부르크 요새', en: 'Gaiesburg Fortress' },
  'iserlohn_fortress': { ko: '이제를론 요새', en: 'Iserlohn Fortress' },
  'rentenberg_fortress': { ko: '렌텐베르크 요새', en: 'Rentenberg Fortress' },
  'hafen': { ko: '하펜', en: 'Hafen' },
  'nachrodt': { ko: '나흐로트', en: 'Nachrodt' },
  'neuenrade': { ko: '노이엔라데', en: 'Neuenrade' },
  'teutoburg': { ko: '토이토부르크', en: 'Teutoburg' },
  'frey': { ko: '프레이', en: 'Frey' },
  'santa_ana': { ko: '산타 아나', en: 'Santa Ana' },
  'salvador': { ko: '살바도르', en: 'Salvador' },
  'kampala': { ko: '캄팔라', en: 'Kampala' },
  'bafra': { ko: '바프라', en: 'Bafra' },
  'osiris': { ko: '오시리스', en: 'Osiris' },
};















