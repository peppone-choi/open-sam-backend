import mongoose, { Schema, Document } from 'mongoose';

export type JobCardType = 
  | 'PERSONAL'          // 개인 (기본)
  | 'CAPTAIN'           // 함장 (기본)
  | 'FLEET_COMMANDER'   // 함대사령관
  | 'TRANSPORT_COMMANDER' // 수송함대사령관
  | 'PATROL_COMMANDER'  // 순찰대사령관
  | 'BASE_COMMANDER'    // 요새사령관
  | 'PLANET_GOVERNOR'   // 행성총독 / 지사
  | 'DEFENSE_COMMANDER' // 방위사령관
  | 'FLEET_STAFF'       // 함대참모
  | 'HIGH_ADMIRAL'      // 우주함대사령장관
  | 'SUPREME_COMMANDER' // 제국군최고사령관 / 통합작전본부장
  | 'DOMESTIC_MINISTER' // 국무상서 / 국무위원장
  | 'MILITARY_MINISTER' // 군무상서 / 국방위원장
  | 'FINANCE_MINISTER'  // 재무상서 / 재정위원장
  | 'INTELLIGENCE_DIRECTOR'; // 군무성조사국장 / 정보부장

export interface IJobCard extends Document {
  characterId: string;
  type: JobCardType;
  name: string; // 직책명 (예: "제13함대 사령관", "이제르론 요새 사령관")
  targetId?: string; // 대상 ID (함대ID, 행성ID 등)
  rankRequirement?: number; // 최소 요구 계급
  commands: string[]; // 실행 가능한 커맨드 목록
  isActive: boolean;
  grantedAt: Date;
}

const JobCardSchema: Schema = new Schema({
  characterId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  name: { type: String, required: true },
  targetId: { type: String }, // 함대나 행성의 ID
  rankRequirement: { type: Number, default: 0 },
  commands: [{ type: String }],
  isActive: { type: Boolean, default: true },
  grantedAt: { type: Date, default: Date.now }
});

// 캐릭터당 최대 16장 제한 (메뉴얼 1086행)
// 이 검증은 Service 레벨에서 수행하는 것이 좋음

export const JobCard = mongoose.model<IJobCard>('JobCard', JobCardSchema);

// 기본 제공 카드 (메뉴얼 1083행: 개인, 함장)
export const DEFAULT_CARDS: { type: JobCardType; name: string; commands: string[] }[] = [
  {
    type: 'PERSONAL',
    name: '개인',
    commands: ['MOVE_SHORT', 'MOVE_LONG', 'MEET', 'DEFECTION', 'RETIRE'] // 근거리이동, 원거리이동, 면담, 망명, 퇴역 등
  },
  {
    type: 'CAPTAIN',
    name: '함장',
    commands: ['WARP', 'MOVE_SYSTEM', 'DOCK', 'REFUEL'] // 워프, 성계내이동, 기항, 연료보급
  }
];
