/**
 * Gin7 Original Character Lottery Service
 * 오리지널 캐릭터 추첨 시스템
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import seedrandom from 'seedrandom';
import {
  LotteryApplication,
  LotteryPool,
  OriginalCharacter
} from '../../types/gin7/character.types';
import {
  ORIGINAL_CHARACTERS,
  getOriginalCharacterById,
  getAvailableForLottery
} from '../../data/gin7/original-characters';

// ============================================
// MongoDB Schemas
// ============================================

export interface ILotteryApplication extends Document {
  applicationId: string;
  userId: string;
  sessionId: string;
  targetCharacterId: string;
  reputationPaid: number;
  appliedAt: Date;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'refunded';
}

const LotteryApplicationSchema = new Schema<ILotteryApplication>({
  applicationId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  targetCharacterId: { type: String, required: true },
  reputationPaid: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'cancelled', 'refunded'],
    default: 'pending'
  }
}, { timestamps: true });

LotteryApplicationSchema.index({ sessionId: 1, targetCharacterId: 1 });
LotteryApplicationSchema.index({ sessionId: 1, userId: 1, status: 1 });

export const LotteryApplicationModel: Model<ILotteryApplication> =
  mongoose.models.Gin7LotteryApplication ||
  mongoose.model<ILotteryApplication>('Gin7LotteryApplication', LotteryApplicationSchema);

export interface ILotteryPool extends Document {
  poolId: string;
  sessionId: string;
  characterId: string;
  status: 'open' | 'closed' | 'completed';
  opensAt: Date;
  closesAt: Date;
  winnerId?: string;
  drawnAt?: Date;
  applicationCount: number;
}

const LotteryPoolSchema = new Schema<ILotteryPool>({
  poolId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  characterId: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'closed', 'completed'],
    default: 'open'
  },
  opensAt: { type: Date, required: true },
  closesAt: { type: Date, required: true },
  winnerId: { type: String },
  drawnAt: { type: Date },
  applicationCount: { type: Number, default: 0 }
}, { timestamps: true });

LotteryPoolSchema.index({ sessionId: 1, characterId: 1 }, { unique: true });
LotteryPoolSchema.index({ sessionId: 1, status: 1 });

export const LotteryPoolModel: Model<ILotteryPool> =
  mongoose.models.Gin7LotteryPool ||
  mongoose.model<ILotteryPool>('Gin7LotteryPool', LotteryPoolSchema);

// 세션 내에서 이미 선택된 캐릭터 추적
export interface ITakenCharacter extends Document {
  sessionId: string;
  characterId: string;
  ownerId: string;
  acquiredAt: Date;
  acquiredVia: 'lottery' | 'purchase' | 'gift';
}

const TakenCharacterSchema = new Schema<ITakenCharacter>({
  sessionId: { type: String, required: true },
  characterId: { type: String, required: true },
  ownerId: { type: String, required: true },
  acquiredAt: { type: Date, default: Date.now },
  acquiredVia: {
    type: String,
    enum: ['lottery', 'purchase', 'gift'],
    default: 'lottery'
  }
}, { timestamps: true });

TakenCharacterSchema.index({ sessionId: 1, characterId: 1 }, { unique: true });

export const TakenCharacterModel: Model<ITakenCharacter> =
  mongoose.models.Gin7TakenCharacter ||
  mongoose.model<ITakenCharacter>('Gin7TakenCharacter', TakenCharacterSchema);

// ============================================
// Lottery Service Functions
// ============================================

/**
 * 추첨 풀 생성/열기
 */
export async function openLotteryPool(
  sessionId: string,
  characterId: string,
  durationHours: number = 24
): Promise<{ success: boolean; pool?: ILotteryPool; error?: string }> {
  // 캐릭터 유효성 검증
  const character = getOriginalCharacterById(characterId);
  if (!character) {
    return { success: false, error: '존재하지 않는 캐릭터입니다.' };
  }

  // 이미 선택된 캐릭터인지 확인
  const taken = await TakenCharacterModel.findOne({ sessionId, characterId });
  if (taken) {
    return { success: false, error: '이미 다른 플레이어가 소유한 캐릭터입니다.' };
  }

  // 기존 풀 확인
  const existingPool = await LotteryPoolModel.findOne({
    sessionId,
    characterId,
    status: { $in: ['open', 'closed'] }
  });

  if (existingPool) {
    return { success: false, error: '이미 진행 중인 추첨이 있습니다.' };
  }

  const now = new Date();
  const closesAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  const pool = await LotteryPoolModel.create({
    poolId: `POOL-${sessionId}-${characterId}-${Date.now()}`,
    sessionId,
    characterId,
    status: 'open',
    opensAt: now,
    closesAt,
    applicationCount: 0
  });

  return { success: true, pool };
}

/**
 * 추첨 신청
 */
export async function applyForLottery(
  sessionId: string,
  userId: string,
  characterId: string,
  userReputation: number
): Promise<{ success: boolean; application?: ILotteryApplication; error?: string }> {
  // 캐릭터 유효성 검증
  const character = getOriginalCharacterById(characterId);
  if (!character) {
    return { success: false, error: '존재하지 않는 캐릭터입니다.' };
  }

  // 명성 포인트 확인
  if (userReputation < character.reputationCost) {
    return {
      success: false,
      error: `명성 포인트가 부족합니다. (필요: ${character.reputationCost}, 보유: ${userReputation})`
    };
  }

  // 추첨 풀 확인
  const pool = await LotteryPoolModel.findOne({
    sessionId,
    characterId,
    status: 'open'
  });

  if (!pool) {
    return { success: false, error: '현재 열려있는 추첨이 없습니다.' };
  }

  // 마감 시간 확인
  if (new Date() > pool.closesAt) {
    return { success: false, error: '추첨 신청 기간이 종료되었습니다.' };
  }

  // 중복 신청 확인
  const existingApplication = await LotteryApplicationModel.findOne({
    sessionId,
    userId,
    targetCharacterId: characterId,
    status: 'pending'
  });

  if (existingApplication) {
    return { success: false, error: '이미 신청한 캐릭터입니다.' };
  }

  // 신청 생성
  const application = await LotteryApplicationModel.create({
    applicationId: `APP-${sessionId}-${userId}-${characterId}-${Date.now()}`,
    userId,
    sessionId,
    targetCharacterId: characterId,
    reputationPaid: character.reputationCost,
    status: 'pending'
  });

  // 풀 신청 수 증가
  await LotteryPoolModel.updateOne(
    { _id: pool._id },
    { $inc: { applicationCount: 1 } }
  );

  return { success: true, application };
}

/**
 * 추첨 신청 취소
 */
export async function cancelApplication(
  sessionId: string,
  userId: string,
  characterId: string
): Promise<{ success: boolean; refundedReputation?: number; error?: string }> {
  const application = await LotteryApplicationModel.findOne({
    sessionId,
    userId,
    targetCharacterId: characterId,
    status: 'pending'
  });

  if (!application) {
    return { success: false, error: '신청 내역을 찾을 수 없습니다.' };
  }

  // 취소 처리
  await LotteryApplicationModel.updateOne(
    { _id: application._id },
    { status: 'cancelled' }
  );

  // 풀 신청 수 감소
  await LotteryPoolModel.updateOne(
    { sessionId, characterId, status: 'open' },
    { $inc: { applicationCount: -1 } }
  );

  return {
    success: true,
    refundedReputation: application.reputationPaid
  };
}

/**
 * 추첨 실행
 */
export async function executeDrawing(
  sessionId: string,
  characterId: string,
  seed?: string
): Promise<{
  success: boolean;
  winner?: { userId: string; character: OriginalCharacter };
  losers?: string[];
  error?: string;
}> {
  // 풀 확인
  const pool = await LotteryPoolModel.findOne({
    sessionId,
    characterId,
    status: { $in: ['open', 'closed'] }
  });

  if (!pool) {
    return { success: false, error: '추첨 풀을 찾을 수 없습니다.' };
  }

  // 신청 목록 조회
  const applications = await LotteryApplicationModel.find({
    sessionId,
    targetCharacterId: characterId,
    status: 'pending'
  });

  if (applications.length === 0) {
    // 신청자 없음 - 풀 완료 처리
    await LotteryPoolModel.updateOne(
      { _id: pool._id },
      { status: 'completed', drawnAt: new Date() }
    );
    return { success: true, losers: [] };
  }

  // 랜덤 추첨
  const rng = seedrandom(seed || `${sessionId}-${characterId}-${Date.now()}`);
  const winnerIndex = Math.floor(rng() * applications.length);
  const winnerApplication = applications[winnerIndex];

  const character = getOriginalCharacterById(characterId);
  if (!character) {
    return { success: false, error: '캐릭터 데이터를 찾을 수 없습니다.' };
  }

  // 당첨자 처리
  await LotteryApplicationModel.updateOne(
    { _id: winnerApplication._id },
    { status: 'won' }
  );

  // 낙첨자 처리
  const loserIds = applications
    .filter((_, i) => i !== winnerIndex)
    .map(app => app.userId);

  await LotteryApplicationModel.updateMany(
    {
      sessionId,
      targetCharacterId: characterId,
      status: 'pending',
      userId: { $ne: winnerApplication.userId }
    },
    { status: 'lost' }
  );

  // 캐릭터 소유권 등록
  await TakenCharacterModel.create({
    sessionId,
    characterId,
    ownerId: winnerApplication.userId,
    acquiredVia: 'lottery'
  });

  // 풀 완료 처리
  await LotteryPoolModel.updateOne(
    { _id: pool._id },
    {
      status: 'completed',
      winnerId: winnerApplication.userId,
      drawnAt: new Date()
    }
  );

  return {
    success: true,
    winner: {
      userId: winnerApplication.userId,
      character
    },
    losers: loserIds
  };
}

/**
 * 추첨 풀 목록 조회
 */
export async function getLotteryPools(
  sessionId: string,
  status?: 'open' | 'closed' | 'completed'
): Promise<Array<ILotteryPool & { character: OriginalCharacter | null }>> {
  const query: any = { sessionId };
  if (status) {
    query.status = status;
  }

  const pools = await LotteryPoolModel.find(query).sort({ closesAt: 1 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pools.map(pool => ({
    ...pool.toObject(),
    character: getOriginalCharacterById(pool.characterId)
  })) as any;
}

/**
 * 사용자의 신청 목록 조회
 */
export async function getUserApplications(
  sessionId: string,
  userId: string
): Promise<Array<ILotteryApplication & { character: OriginalCharacter | null }>> {
  const applications = await LotteryApplicationModel.find({
    sessionId,
    userId
  }).sort({ appliedAt: -1 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return applications.map(app => ({
    ...app.toObject(),
    character: getOriginalCharacterById(app.targetCharacterId)
  })) as any;
}

/**
 * 세션에서 사용 가능한 오리지널 캐릭터 목록
 */
export async function getAvailableOriginalCharacters(
  sessionId: string
): Promise<OriginalCharacter[]> {
  const takenCharacters = await TakenCharacterModel.find({ sessionId });
  const takenIds = takenCharacters.map(tc => tc.characterId);

  return getAvailableForLottery(takenIds);
}

/**
 * 특정 캐릭터 소유자 확인
 */
export async function getCharacterOwner(
  sessionId: string,
  characterId: string
): Promise<string | null> {
  const taken = await TakenCharacterModel.findOne({ sessionId, characterId });
  return taken?.ownerId || null;
}

/**
 * 마감된 풀 자동 추첨 처리
 */
export async function processExpiredPools(sessionId: string): Promise<number> {
  const now = new Date();

  // 마감 시간이 지난 open 풀 조회
  const expiredPools = await LotteryPoolModel.find({
    sessionId,
    status: 'open',
    closesAt: { $lt: now }
  });

  let processedCount = 0;

  for (const pool of expiredPools) {
    // 풀 상태를 closed로 변경
    await LotteryPoolModel.updateOne(
      { _id: pool._id },
      { status: 'closed' }
    );

    // 추첨 실행
    const result = await executeDrawing(sessionId, pool.characterId);
    if (result.success) {
      processedCount++;
    }
  }

  return processedCount;
}

/**
 * 낙첨자 명성 환불 처리
 */
export async function refundLosers(
  sessionId: string,
  characterId: string,
  refundPercentage: number = 0.5
): Promise<Array<{ userId: string; refundAmount: number }>> {
  const losers = await LotteryApplicationModel.find({
    sessionId,
    targetCharacterId: characterId,
    status: 'lost'
  });

  const refunds: Array<{ userId: string; refundAmount: number }> = [];

  for (const loser of losers) {
    const refundAmount = Math.floor(loser.reputationPaid * refundPercentage);
    refunds.push({
      userId: loser.userId,
      refundAmount
    });

    // 상태 업데이트
    await LotteryApplicationModel.updateOne(
      { _id: loser._id },
      { status: 'refunded' }
    );
  }

  return refunds;
}

export default {
  // Models
  LotteryApplicationModel,
  LotteryPoolModel,
  TakenCharacterModel,

  // Functions
  openLotteryPool,
  applyForLottery,
  cancelApplication,
  executeDrawing,
  getLotteryPools,
  getUserApplications,
  getAvailableOriginalCharacters,
  getCharacterOwner,
  processExpiredPools,
  refundLosers
};

