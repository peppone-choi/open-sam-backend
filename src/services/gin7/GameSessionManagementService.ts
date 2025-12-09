/**
 * GameSessionManagementService - 세션 참가/복귀 관리
 * 매뉴얼 316-330, 408-424행 기반 구현
 *
 * 기능:
 * - 세션 참가 신청
 * - 오리지널 캐릭터 추첨
 * - 제네레이트 캐릭터 생성
 * - 복귀 제한 (전사 후 동일 세션)
 * - 캐릭터 삭제 조건 확인
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { Gin7GameSession, IGin7GameSession } from '../../models/gin7/GameSession';
import { Gin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types & Models
// ============================================================

export enum CharacterType {
  ORIGINAL = 'ORIGINAL',     // 오리지널 캐릭터 (양 웬리, 라인하르트 등)
  GENERATED = 'GENERATED',   // 제네레이트 캐릭터 (플레이어 생성)
}

export enum FactionType {
  EMPIRE = 'EMPIRE',         // 은하제국
  ALLIANCE = 'ALLIANCE',     // 자유행성동맹
  FEZZAN = 'FEZZAN',         // 페잔
}

export interface ISessionParticipant extends Document {
  participantId: string;
  sessionId: string;
  userId: string;           // 플레이어 계정 ID
  characterId: string;      // 현재 사용 중인 캐릭터
  characterType: CharacterType;
  factionId: string;
  
  // 오리지널 캐릭터 추첨 정보
  appliedOriginalCharacters: string[];  // 신청한 오리지널 캐릭터 목록
  wonOriginalCharacter?: string;        // 당첨된 오리지널 캐릭터
  
  // 복귀 제한
  previousDeaths: Array<{
    characterId: string;
    characterName: string;
    deathDate: Date;
    deathReason: string;
    canReturn: boolean;     // 복귀 가능 여부
  }>;
  
  // 메타데이터
  joinedAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

const SessionParticipantSchema = new Schema<ISessionParticipant>({
  participantId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  characterId: { type: String, required: true },
  characterType: { type: String, enum: Object.values(CharacterType), required: true },
  factionId: { type: String, required: true },
  
  appliedOriginalCharacters: [{ type: String }],
  wonOriginalCharacter: { type: String },
  
  previousDeaths: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    deathDate: { type: Date, required: true },
    deathReason: { type: String, required: true },
    canReturn: { type: Boolean, default: false },
  }],
  
  joinedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  collection: 'session_participants',
});

// 복합 인덱스
SessionParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
SessionParticipantSchema.index({ sessionId: 1, characterId: 1 });

export const SessionParticipant: Model<ISessionParticipant> = mongoose.models.SessionParticipant as Model<ISessionParticipant> || 
  mongoose.model<ISessionParticipant>('SessionParticipant', SessionParticipantSchema);

// ============================================================
// 오리지널 캐릭터 추첨 신청 모델
// ============================================================

export interface IOriginalCharacterApplication extends Document {
  applicationId: string;
  sessionId: string;
  userId: string;
  originalCharacterId: string;
  originalCharacterName: string;
  factionId: string;
  appliedAt: Date;
  status: 'pending' | 'won' | 'lost';
  lotteryRound?: number;
}

const OriginalCharacterApplicationSchema = new Schema<IOriginalCharacterApplication>({
  applicationId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  originalCharacterId: { type: String, required: true },
  originalCharacterName: { type: String, required: true },
  factionId: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'won', 'lost'], default: 'pending' },
  lotteryRound: { type: Number },
}, {
  timestamps: true,
  collection: 'original_character_applications',
});

OriginalCharacterApplicationSchema.index({ sessionId: 1, originalCharacterId: 1 });

export const OriginalCharacterApplication: Model<IOriginalCharacterApplication> = mongoose.models.OriginalCharacterApplication as Model<IOriginalCharacterApplication> ||
  mongoose.model<IOriginalCharacterApplication>('OriginalCharacterApplication', OriginalCharacterApplicationSchema);

// ============================================================
// Request Types
// ============================================================

export interface JoinSessionRequest {
  sessionId: string;
  userId: string;
  preferredFaction?: FactionType;
  originalCharacterApplications?: string[]; // 신청할 오리지널 캐릭터 ID 목록
}

export interface CreateGeneratedCharacterRequest {
  sessionId: string;
  userId: string;
  name: string;
  factionId: string;
  stats?: {
    command?: number;
    might?: number;
    intellect?: number;
    politics?: number;
    charm?: number;
  };
}

export interface ReturnToSessionRequest {
  sessionId: string;
  userId: string;
  factionId: string;
  newCharacterName?: string;
}

// ============================================================
// GameSessionManagementService Class
// ============================================================

export class GameSessionManagementService extends EventEmitter {
  private static instance: GameSessionManagementService;
  
  // 대좌 이하 계급 (캐릭터 삭제 가능)
  private readonly DELETABLE_RANKS = [
    '이등병', '일등병', '상등병', '병장',
    '하사', '중사', '상사', '원사',
    '소위', '중위', '대위',
    '소령', '중령', '대령', '대좌',
    // 동맹
    '소위', '중위', '대위',
    '소령', '중령', '대령',
  ];

  private constructor() {
    super();
    logger.info('[GameSessionManagementService] Initialized');
  }

  public static getInstance(): GameSessionManagementService {
    if (!GameSessionManagementService.instance) {
      GameSessionManagementService.instance = new GameSessionManagementService();
    }
    return GameSessionManagementService.instance;
  }

  // ============================================================
  // 세션 참가
  // ============================================================

  /**
   * 세션 참가 신청
   */
  public async joinSession(request: JoinSessionRequest): Promise<{
    success: boolean;
    participantId?: string;
    error?: string;
  }> {
    const { sessionId, userId, preferredFaction, originalCharacterApplications } = request;
    
    // 1. 세션 존재 확인
    const session = await Gin7GameSession.findOne({ sessionId });
    if (!session) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }
    
    // 2. 이미 참가 중인지 확인
    const existing = await SessionParticipant.findOne({ sessionId, userId });
    if (existing) {
      // 복귀 처리 필요한지 확인
      if (!existing.isActive) {
        return { success: false, error: '복귀 처리가 필요합니다. returnToSession을 사용하세요.' };
      }
      return { success: false, error: '이미 세션에 참가 중입니다.' };
    }
    
    // 3. 진영 배정 (밸런스 고려)
    const factionId = preferredFaction || await this.assignFaction(sessionId);
    
    // 4. 오리지널 캐릭터 신청 처리
    if (originalCharacterApplications && originalCharacterApplications.length > 0) {
      for (const charId of originalCharacterApplications) {
        await OriginalCharacterApplication.create({
          applicationId: `APP-${uuidv4().slice(0, 8)}`,
          sessionId,
          userId,
          originalCharacterId: charId,
          originalCharacterName: charId, // TODO: 실제 이름 조회
          factionId,
          status: 'pending',
        });
      }
    }
    
    // 5. 임시 참가자 레코드 생성 (캐릭터는 추첨 후 배정)
    const participant = await SessionParticipant.create({
      participantId: `PART-${uuidv4().slice(0, 8)}`,
      sessionId,
      userId,
      characterId: '', // 추첨 후 배정
      characterType: CharacterType.GENERATED, // 기본값
      factionId,
      appliedOriginalCharacters: originalCharacterApplications || [],
      previousDeaths: [],
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true,
    });
    
    this.emit('session:joined', {
      sessionId,
      userId,
      participantId: participant.participantId,
      factionId,
    });
    
    logger.info(`[GameSessionManagementService] User ${userId} joined session ${sessionId}`);
    
    return { success: true, participantId: participant.participantId };
  }

  /**
   * 진영 자동 배정 (밸런스)
   */
  private async assignFaction(sessionId: string): Promise<string> {
    const empireCount = await SessionParticipant.countDocuments({
      sessionId,
      factionId: FactionType.EMPIRE,
      isActive: true,
    });
    
    const allianceCount = await SessionParticipant.countDocuments({
      sessionId,
      factionId: FactionType.ALLIANCE,
      isActive: true,
    });
    
    // 적은 쪽으로 배정
    if (empireCount <= allianceCount) {
      return FactionType.EMPIRE;
    }
    return FactionType.ALLIANCE;
  }

  // ============================================================
  // 오리지널 캐릭터 추첨
  // ============================================================

  /**
   * 오리지널 캐릭터 추첨 실행
   * 매뉴얼: 세션 시작 시 오리지널 캐릭터 추첨
   */
  public async runOriginalCharacterLottery(sessionId: string): Promise<{
    winners: Array<{ userId: string; characterId: string; characterName: string }>;
  }> {
    const winners: Array<{ userId: string; characterId: string; characterName: string }> = [];
    
    // 각 오리지널 캐릭터별로 신청자 중 추첨
    const applications = await OriginalCharacterApplication.find({
      sessionId,
      status: 'pending',
    });
    
    // 캐릭터별로 그룹화
    const byCharacter = new Map<string, IOriginalCharacterApplication[]>();
    for (const app of applications) {
      const list = byCharacter.get(app.originalCharacterId) || [];
      list.push(app);
      byCharacter.set(app.originalCharacterId, list);
    }
    
    // 각 캐릭터별 추첨
    for (const [characterId, applicants] of byCharacter) {
      if (applicants.length === 0) continue;
      
      // 랜덤 선택
      const winnerIndex = Math.floor(Math.random() * applicants.length);
      const winner = applicants[winnerIndex];
      
      // 당첨 처리
      await OriginalCharacterApplication.updateOne(
        { applicationId: winner.applicationId },
        { status: 'won' },
      );
      
      // 낙첨 처리
      for (let i = 0; i < applicants.length; i++) {
        if (i !== winnerIndex) {
          await OriginalCharacterApplication.updateOne(
            { applicationId: applicants[i].applicationId },
            { status: 'lost' },
          );
        }
      }
      
      // 참가자 정보 업데이트
      await SessionParticipant.updateOne(
        { sessionId, userId: winner.userId },
        {
          characterId,
          characterType: CharacterType.ORIGINAL,
          wonOriginalCharacter: characterId,
        },
      );
      
      winners.push({
        userId: winner.userId,
        characterId,
        characterName: winner.originalCharacterName,
      });
    }
    
    this.emit('lottery:completed', { sessionId, winners });
    
    logger.info(`[GameSessionManagementService] Lottery completed for session ${sessionId}, ${winners.length} winners`);
    
    return { winners };
  }

  // ============================================================
  // 제네레이트 캐릭터 생성
  // ============================================================

  /**
   * 제네레이트 캐릭터 생성
   * 오리지널 캐릭터 당첨에 실패한 플레이어용
   */
  public async createGeneratedCharacter(request: CreateGeneratedCharacterRequest): Promise<{
    success: boolean;
    characterId?: string;
    error?: string;
  }> {
    const { sessionId, userId, name, factionId, stats } = request;
    
    // 1. 참가자 확인
    const participant = await SessionParticipant.findOne({ sessionId, userId });
    if (!participant) {
      return { success: false, error: '세션에 참가하지 않았습니다.' };
    }
    
    // 2. 이미 캐릭터가 있는지 확인
    if (participant.characterId) {
      return { success: false, error: '이미 캐릭터가 배정되어 있습니다.' };
    }
    
    // 3. 제네레이트 캐릭터 생성
    const characterId = `GEN-${uuidv4().slice(0, 8)}`;
    
    await Gin7Character.create({
      characterId,
      sessionId,
      name,
      factionId,
      rank: factionId === FactionType.EMPIRE ? '이등병' : '이등병',
      characterClass: 'military',
      isOriginal: false,
      isNPC: false,
      playerId: userId,
      stats: {
        command: stats?.command ?? 50,
        might: stats?.might ?? 50,
        intellect: stats?.intellect ?? 50,
        politics: stats?.politics ?? 50,
        charm: stats?.charm ?? 50,
      },
      merit: 0,
      fame: 0,
      status: 'active',
    });
    
    // 4. 참가자 정보 업데이트
    await SessionParticipant.updateOne(
      { sessionId, userId },
      {
        characterId,
        characterType: CharacterType.GENERATED,
      },
    );
    
    this.emit('character:created', {
      sessionId,
      userId,
      characterId,
      characterName: name,
      isGenerated: true,
    });
    
    logger.info(`[GameSessionManagementService] Generated character created: ${name}`);
    
    return { success: true, characterId };
  }

  // ============================================================
  // 복귀 제한
  // ============================================================

  /**
   * 전사 기록
   * 매뉴얼: 전사 후 동일 세션 복귀 제한
   */
  public async recordDeath(
    sessionId: string,
    userId: string,
    characterId: string,
    characterName: string,
    deathReason: string,
  ): Promise<void> {
    const participant = await SessionParticipant.findOne({ sessionId, userId });
    if (!participant) return;
    
    // 오리지널 캐릭터는 복귀 불가
    const canReturn = participant.characterType !== CharacterType.ORIGINAL;
    
    // 전사 기록 추가
    participant.previousDeaths.push({
      characterId,
      characterName,
      deathDate: new Date(),
      deathReason,
      canReturn,
    });
    
    // 비활성화
    participant.isActive = false;
    participant.characterId = '';
    
    await participant.save();
    
    this.emit('character:died', {
      sessionId,
      userId,
      characterId,
      characterName,
      canReturn,
    });
    
    logger.info(`[GameSessionManagementService] Character death recorded: ${characterName}`);
  }

  /**
   * 세션 복귀
   * 매뉴얼: 전사 후 같은 진영으로만 복귀 가능
   */
  public async returnToSession(request: ReturnToSessionRequest): Promise<{
    success: boolean;
    characterId?: string;
    error?: string;
  }> {
    const { sessionId, userId, factionId, newCharacterName } = request;
    
    // 1. 참가자 확인
    const participant = await SessionParticipant.findOne({ sessionId, userId });
    if (!participant) {
      return { success: false, error: '세션 참가 기록이 없습니다.' };
    }
    
    // 2. 복귀 가능 여부 확인
    if (participant.isActive) {
      return { success: false, error: '이미 활성 상태입니다.' };
    }
    
    // 마지막 전사 기록 확인
    const lastDeath = participant.previousDeaths[participant.previousDeaths.length - 1];
    if (lastDeath && !lastDeath.canReturn) {
      return { success: false, error: '오리지널 캐릭터 사용 후에는 복귀할 수 없습니다.' };
    }
    
    // 3. 같은 진영 확인
    if (factionId !== participant.factionId) {
      return { success: false, error: '같은 진영으로만 복귀할 수 있습니다.' };
    }
    
    // 4. 새 제네레이트 캐릭터 생성
    const result = await this.createGeneratedCharacter({
      sessionId,
      userId,
      name: newCharacterName || `제네레이트_${Date.now()}`,
      factionId,
    });
    
    if (!result.success) {
      return result;
    }
    
    // 5. 활성화
    await SessionParticipant.updateOne(
      { sessionId, userId },
      { isActive: true, lastActiveAt: new Date() },
    );
    
    this.emit('session:returned', {
      sessionId,
      userId,
      characterId: result.characterId,
    });
    
    logger.info(`[GameSessionManagementService] User ${userId} returned to session ${sessionId}`);
    
    return { success: true, characterId: result.characterId };
  }

  // ============================================================
  // 캐릭터 삭제
  // ============================================================

  /**
   * 캐릭터 삭제 가능 여부 확인
   * 매뉴얼 408-424행: 대좌 이하 + 거주구/호텔 자실 체류
   */
  public async canDeleteCharacter(
    sessionId: string,
    characterId: string,
  ): Promise<{ canDelete: boolean; reason?: string }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { canDelete: false, reason: '캐릭터를 찾을 수 없습니다.' };
    }
    
    // 1. 계급 확인 (대좌 이하)
    if (!this.DELETABLE_RANKS.includes(character.rank)) {
      return { canDelete: false, reason: '대좌 이하 계급만 캐릭터를 삭제할 수 있습니다.' };
    }
    
    // 2. 스팟 확인 (거주구/호텔 자실)
    // TODO: SpotService와 연동하여 현재 스팟 확인
    
    // 3. 지속 효과 확인 (연료보급, 전략색적 등)
    // TODO: 지속 효과 확인 로직
    
    return { canDelete: true };
  }

  /**
   * 캐릭터 삭제
   */
  public async deleteCharacter(
    sessionId: string,
    userId: string,
    characterId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // 1. 삭제 가능 여부 확인
    const check = await this.canDeleteCharacter(sessionId, characterId);
    if (!check.canDelete) {
      return { success: false, error: check.reason };
    }
    
    // 2. 캐릭터 삭제 (소프트 삭제)
    await Gin7Character.updateOne(
      { sessionId, characterId },
      { status: 'deleted', deletedAt: new Date() },
    );
    
    // 3. 참가자 정보 업데이트
    await SessionParticipant.updateOne(
      { sessionId, userId },
      { characterId: '', isActive: false },
    );
    
    this.emit('character:deleted', {
      sessionId,
      userId,
      characterId,
    });
    
    logger.info(`[GameSessionManagementService] Character deleted: ${characterId}`);
    
    return { success: true };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 세션 참가자 목록
   */
  public async getSessionParticipants(sessionId: string): Promise<ISessionParticipant[]> {
    return SessionParticipant.find({ sessionId, isActive: true }).lean() as unknown as ISessionParticipant[];
  }

  /**
   * 사용자의 참가 정보
   */
  public async getParticipantInfo(
    sessionId: string,
    userId: string,
  ): Promise<ISessionParticipant | null> {
    return SessionParticipant.findOne({ sessionId, userId }).lean() as unknown as ISessionParticipant | null;
  }

  /**
   * 오리지널 캐릭터 신청 현황
   */
  public async getApplicationStatus(
    sessionId: string,
    originalCharacterId: string,
  ): Promise<{ applicantCount: number; applications: IOriginalCharacterApplication[] }> {
    const applications = await OriginalCharacterApplication.find({
      sessionId,
      originalCharacterId,
    }).lean() as unknown as IOriginalCharacterApplication[];
    
    return {
      applicantCount: applications.length,
      applications,
    };
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    logger.info(`[GameSessionManagementService] Cleaned up session: ${sessionId}`);
  }
}

export const gameSessionManagementService = GameSessionManagementService.getInstance();
export default GameSessionManagementService;





