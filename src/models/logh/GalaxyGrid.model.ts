import mongoose, { Schema, Document, Model } from 'mongoose';

export type GridType = 'SPACE' | 'SYSTEM' | 'OBSTACLE';

/**
 * 세력 코드 확장 (메뉴얼 1479행 반영)
 * 제국/동맹 각각의 정규군과 반란군은 별도 세력으로 취급됩니다.
 */
export type FactionCode = 
  | 'empire'          // 제국 정규군
  | 'alliance'        // 동맹 정규군
  | 'empire_rebel'    // 제국 반란군 (예: 립슈타트 동맹)
  | 'alliance_rebel'  // 동맹 반란군 (예: 구국군사회의)
  | 'fezzan';         // 페잔 (중립)

/**
 * 메뉴얼 1440행: 그리드
 * 전략 지도는 100광년 단위의 그리드로 구획됩니다.
 */
export interface IGalaxyGrid extends Document {
  sessionId: string;
  x: number;
  y: number;
  type: GridType;
  name?: string; // 성계 이름 (식별용)
  
  // 현재 그리드 내 유닛 현황 (메뉴얼 1466행: 유닛수 제한 300)
  unitCounts: {
    empire: number;
    alliance: number;
    empire_rebel: number;
    alliance_rebel: number;
    fezzan: number;
  };
  
  // 현재 존재하는 진영 목록 (메뉴얼 1476행: 진영수 제한 2)
  factionsPresent: FactionCode[];
  
  // 성계 정보 (Type이 SYSTEM일 때)
  systemId?: string; // GalaxySystem 모델 참조
  
  // 지형 정보
  terrainEffect?: string; // 플라즈마 폭풍, 살가소 지대 등
  
  // 메서드
  canEnter(faction: FactionCode, unitCount: number, isFlagshipOnly?: boolean): { allowed: boolean; reason?: string };
  addUnits(faction: FactionCode, count: number): Promise<void>;
  removeUnits(faction: FactionCode, count: number): Promise<void>;
}

const GalaxyGridSchema: Schema = new Schema({
  sessionId: { type: String, required: true, index: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { type: String, enum: ['SPACE', 'SYSTEM', 'OBSTACLE'], required: true },
  name: { type: String },
  
  unitCounts: {
    empire: { type: Number, default: 0 },
    alliance: { type: Number, default: 0 },
    empire_rebel: { type: Number, default: 0 },
    alliance_rebel: { type: Number, default: 0 },
    fezzan: { type: Number, default: 0 }
  },
  
  factionsPresent: { type: [String], default: [] },
  
  systemId: { type: String },
  terrainEffect: { type: String }
});

// 복합 인덱스 (좌표 검색용)
GalaxyGridSchema.index({ sessionId: 1, x: 1, y: 1 }, { unique: true });

/**
 * 메뉴얼 1460행: 그리드 진입 제한 검증
 */
GalaxyGridSchema.methods.canEnter = function(
  this: IGalaxyGrid, 
  faction: FactionCode, 
  unitCount: number,
  isFlagshipOnly: boolean = false
): { allowed: boolean; reason?: string } {
  
  // 1. 지형 제한 (메뉴얼 1493행)
  if (this.type === 'OBSTACLE') {
    return { allowed: false, reason: '항행 불능 구역입니다.' };
  }
  
  // 2. 유닛 수 제한 (메뉴얼 1466행: 300 유닛 이하)
  const currentCount = this.unitCounts[faction] || 0;
  if (currentCount + unitCount > 300) {
    return { allowed: false, reason: `해당 구역의 유닛 수용 한계(${300 - currentCount})를 초과합니다.` };
  }
  
  // 3. 진영 수 제한 (메뉴얼 1476행: 2진영 까지)
  // 이미 존재하는 진영이거나, 새로운 진영이라도 총 진영 수가 2 미만이면 진입 가능
  if (!this.factionsPresent.includes(faction) && this.factionsPresent.length >= 2) {
    // 예외: 동맹군(alliance)과 동맹 반란군(alliance_rebel)은 서로 다른 진영으로 취급되어 전투 발생
    // 제국군(empire)과 제국 반란군(empire_rebel)도 마찬가지
    // 따라서 단순히 length >= 2 체크는 유효함.
    // 다만, 3파전(예: 제국 vs 동맹 vs 제국반란군)은 불가능.
    return { allowed: false, reason: '해당 구역은 이미 2개 이상의 세력이 대치 중입니다.' };
  }
  
  // 4. 독행함(기함 단독) 제한 (메뉴얼 1484행)
  // 독행함은 적 유닛이 존재하는 성계 그리드 진입 불가 (단, 아군이 교전 중이면 가능)
  if (isFlagshipOnly && this.type === 'SYSTEM') {
    const hasEnemy = this.factionsPresent.some(f => f !== faction); // 적 존재 여부
    const hasAlly = this.unitCounts[faction] > 0; // 아군 존재 여부
    
    // 적이 있고 아군이 없으면 진입 불가
    // (반란군도 적으로 간주됨: factionsPresent에 포함되어 있다면 서로 다른 진영임)
    if (hasEnemy && !hasAlly) {
      return { allowed: false, reason: '적 세력이 장악한 성계에 단독으로 진입할 수 없습니다.' };
    }
  }
  
  return { allowed: true };
};

/**
 * 유닛 진입 처리
 */
GalaxyGridSchema.methods.addUnits = async function(this: IGalaxyGrid, faction: FactionCode, count: number) {
  // 타입 안전성을 위해 key 접근 방식 수정
  if (faction in this.unitCounts) {
    (this.unitCounts as any)[faction] += count;
  }
  
  if ((this.unitCounts as any)[faction] > 0 && !this.factionsPresent.includes(faction)) {
    this.factionsPresent.push(faction);
  }
  await this.save();
};

/**
 * 유닛 이탈 처리
 */
GalaxyGridSchema.methods.removeUnits = async function(this: IGalaxyGrid, faction: FactionCode, count: number) {
  if (faction in this.unitCounts) {
    (this.unitCounts as any)[faction] = Math.max(0, (this.unitCounts as any)[faction] - count);
  }
  
  if ((this.unitCounts as any)[faction] === 0) {
    this.factionsPresent = this.factionsPresent.filter(f => f !== faction);
  }
  await this.save();
};

export const GalaxyGrid = mongoose.model<IGalaxyGrid>('GalaxyGrid', GalaxyGridSchema);
