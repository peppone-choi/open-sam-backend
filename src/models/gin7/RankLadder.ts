/**
 * GIN7 RankLadder Model
 * 
 * 계급별 공적치 랭킹을 관리하는 모델
 * Redis ZSet과 연동하여 실시간 순위를 처리합니다.
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { RankCode } from '../../config/gin7/ranks';

// ============================================================================
// Interface Definitions
// ============================================================================

export interface IRankLadderEntry extends Document {
  characterId: string;
  sessionId: string;
  factionId: string;           // 소속 세력/국가
  
  // 계급 정보
  rank: RankCode;
  
  // 공적 정보
  merit: number;               // 현재 공적치
  totalMerit: number;          // 누적 공적치 (강등/승진과 무관)
  
  // 복무 정보
  enlistmentDate: Date;        // 임관일 (게임 시간)
  promotionDate: Date;         // 현 계급 진급일
  serviceMonths: number;       // 총 복무 기간 (게임 월)
  
  // 캐릭터 기본 정보 (동점자 처리용)
  birthDate: Date;             // 생년월일 (게임 시간)
  characterName: string;       // 이름 (조회 편의)
  
  // 직위 정보
  position?: {
    positionId: string;        // 직위 ID (예: 'fleet_commander')
    positionName: string;      // 직위명
    appointedDate: Date;       // 임명일
    appointedBy: string;       // 임명자 characterId
  };
  
  // 상태
  status: 'active' | 'retired' | 'deceased' | 'dismissed';
  
  // 메타데이터
  lastUpdated: Date;
}

// ============================================================================
// Schema Definition
// ============================================================================

const RankLadderSchema = new Schema<IRankLadderEntry>({
  characterId: { type: String, required: true },
  sessionId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  rank: { 
    type: String, 
    enum: Object.values(RankCode),
    required: true,
    default: RankCode.PRIVATE_2ND 
  },
  
  merit: { type: Number, default: 0, min: 0 },
  totalMerit: { type: Number, default: 0, min: 0 },
  
  enlistmentDate: { type: Date, required: true },
  promotionDate: { type: Date, required: true },
  serviceMonths: { type: Number, default: 0 },
  
  birthDate: { type: Date, required: true },
  characterName: { type: String, required: true },
  
  position: {
    positionId: String,
    positionName: String,
    appointedDate: Date,
    appointedBy: String,
  },
  
  status: { 
    type: String, 
    enum: ['active', 'retired', 'deceased', 'dismissed'],
    default: 'active' 
  },
  
  lastUpdated: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// ============================================================================
// Indexes
// ============================================================================

// 기본 조회 인덱스
RankLadderSchema.index({ sessionId: 1, characterId: 1 }, { unique: true });

// 계급별 랭킹 조회 (공적치 내림차순)
RankLadderSchema.index({ sessionId: 1, factionId: 1, rank: 1, merit: -1 });

// 세력별 전체 랭킹
RankLadderSchema.index({ sessionId: 1, factionId: 1, totalMerit: -1 });

// 상태별 조회
RankLadderSchema.index({ sessionId: 1, status: 1 });

// 임관일 기준 조회 (동점자 처리)
RankLadderSchema.index({ sessionId: 1, rank: 1, merit: -1, enlistmentDate: 1 });

// ============================================================================
// Static Methods
// ============================================================================

interface RankLadderModel extends Model<IRankLadderEntry> {
  /**
   * 동일 계급 내 순위 계산
   * 동점자 처리: 공적치 → 임관일 → 생년월일
   */
  calculateRankInLadder(
    sessionId: string,
    factionId: string,
    rank: RankCode,
    characterId: string
  ): Promise<number>;
  
  /**
   * 계급별 라더 조회
   */
  getLadder(
    sessionId: string,
    factionId: string,
    rank: RankCode,
    limit?: number
  ): Promise<IRankLadderEntry[]>;
  
  /**
   * 승진 대상자 조회 (라더 1위)
   */
  getPromotionCandidate(
    sessionId: string,
    factionId: string,
    rank: RankCode
  ): Promise<IRankLadderEntry | null>;
}

/**
 * 동일 계급 내 순위 계산
 */
RankLadderSchema.statics.calculateRankInLadder = async function(
  sessionId: string,
  factionId: string,
  rank: RankCode,
  characterId: string
): Promise<number> {
  const target = await this.findOne({ sessionId, factionId, rank, characterId, status: 'active' });
  if (!target) return -1;
  
  // 동점자 처리 기준으로 상위 인원 수 계산
  const higherRanked = await this.countDocuments({
    sessionId,
    factionId,
    rank,
    status: 'active',
    $or: [
      // 공적치가 더 높은 경우
      { merit: { $gt: target.merit } },
      // 공적치가 같고 임관일이 더 빠른 경우
      { 
        merit: target.merit, 
        enlistmentDate: { $lt: target.enlistmentDate } 
      },
      // 공적치, 임관일 같고 나이가 더 많은 경우 (birthDate가 더 이른 경우)
      { 
        merit: target.merit, 
        enlistmentDate: target.enlistmentDate,
        birthDate: { $lt: target.birthDate }
      },
    ]
  });
  
  return higherRanked + 1; // 1-based rank
};

/**
 * 계급별 라더 조회
 */
RankLadderSchema.statics.getLadder = async function(
  sessionId: string,
  factionId: string,
  rank: RankCode,
  limit: number = 100
): Promise<IRankLadderEntry[]> {
  return this.find({
    sessionId,
    factionId,
    rank,
    status: 'active',
  })
    .sort({ merit: -1, enlistmentDate: 1, birthDate: 1 })
    .limit(limit)
    .exec();
};

/**
 * 승진 대상자 조회 (라더 1위)
 */
RankLadderSchema.statics.getPromotionCandidate = async function(
  sessionId: string,
  factionId: string,
  rank: RankCode
): Promise<IRankLadderEntry | null> {
  const candidates = await this.find({
    sessionId,
    factionId,
    rank,
    status: 'active',
  })
    .sort({ merit: -1, enlistmentDate: 1, birthDate: 1 })
    .limit(1)
    .exec();
  
  return candidates[0] || null;
};

// ============================================================================
// Export
// ============================================================================

export const RankLadder: RankLadderModel = 
  mongoose.models.RankLadder || mongoose.model<IRankLadderEntry, RankLadderModel>('RankLadder', RankLadderSchema);

