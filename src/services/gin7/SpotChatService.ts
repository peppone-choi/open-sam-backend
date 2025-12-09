/**
 * SpotChatService - 스팟별 채팅방 시스템
 * 매뉴얼 667-696행 기반 구현
 *
 * 기능:
 * - 스팟별 채팅방 생성/관리
 * - 스팟 입장/퇴장 시 알림
 * - 채팅 로그 저장 (최근 100개)
 * - 스팟 멤버 목록 관리
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../../common/logger';

// ============================================================
// Types & Models
// ============================================================

export interface ISpotChatRoom extends Document {
  roomId: string;
  sessionId: string;
  spotId: string;
  spotName: string;
  
  // 현재 멤버
  members: Array<{
    characterId: string;
    characterName: string;
    joinedAt: Date;
  }>;
  
  // 채팅 로그 (최근 100개)
  chatLogs: Array<{
    logId: string;
    senderId: string;
    senderName: string;
    message: string;
    type: 'chat' | 'system' | 'emote';
    timestamp: Date;
  }>;
  
  // 메타데이터
  createdAt: Date;
  lastActivityAt: Date;
}

const SpotChatRoomSchema = new Schema<ISpotChatRoom>({
  roomId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  spotId: { type: String, required: true, index: true },
  spotName: { type: String, required: true },
  
  members: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  }],
  
  chatLogs: [{
    logId: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['chat', 'system', 'emote'], default: 'chat' },
    timestamp: { type: Date, default: Date.now },
  }],
  
  createdAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'spot_chat_rooms',
});

// 복합 인덱스
SpotChatRoomSchema.index({ sessionId: 1, spotId: 1 }, { unique: true });

export const SpotChatRoom: Model<ISpotChatRoom> = mongoose.models.SpotChatRoom as Model<ISpotChatRoom> ||
  mongoose.model<ISpotChatRoom>('SpotChatRoom', SpotChatRoomSchema);

// ============================================================
// Request/Response Types
// ============================================================

export interface JoinSpotRequest {
  sessionId: string;
  spotId: string;
  spotName: string;
  characterId: string;
  characterName: string;
}

export interface LeaveSpotRequest {
  sessionId: string;
  spotId: string;
  characterId: string;
  characterName: string;
  reason?: 'normal' | 'disconnect' | 'move' | 'death';
}

export interface SendSpotChatRequest {
  sessionId: string;
  spotId: string;
  senderId: string;
  senderName: string;
  message: string;
  type?: 'chat' | 'system' | 'emote';
}

export interface SpotChatMember {
  characterId: string;
  characterName: string;
  joinedAt: Date;
}

// ============================================================
// Constants
// ============================================================

const MAX_CHAT_LOGS = 100;

// ============================================================
// SpotChatService Class
// ============================================================

export class SpotChatService extends EventEmitter {
  private static instance: SpotChatService;

  private constructor() {
    super();
    logger.info('[SpotChatService] Initialized');
  }

  public static getInstance(): SpotChatService {
    if (!SpotChatService.instance) {
      SpotChatService.instance = new SpotChatService();
    }
    return SpotChatService.instance;
  }

  // ============================================================
  // 채팅방 관리
  // ============================================================

  /**
   * 스팟 채팅방 조회 또는 생성
   */
  public async getOrCreateRoom(
    sessionId: string,
    spotId: string,
    spotName: string,
  ): Promise<ISpotChatRoom> {
    let room = await SpotChatRoom.findOne({ sessionId, spotId });

    if (!room) {
      room = await SpotChatRoom.create({
        roomId: `SPOT-CHAT-${uuidv4().slice(0, 8)}`,
        sessionId,
        spotId,
        spotName,
        members: [],
        chatLogs: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });

      logger.info(`[SpotChatService] Created chat room for spot: ${spotName}`);
    }

    return room;
  }

  /**
   * 스팟 채팅방 조회
   */
  public async getRoom(
    sessionId: string,
    spotId: string,
  ): Promise<ISpotChatRoom | null> {
    return SpotChatRoom.findOne({ sessionId, spotId });
  }

  // ============================================================
  // 입장/퇴장
  // ============================================================

  /**
   * 스팟 입장
   * 매뉴얼: 같은 스팟에 있는 캐릭터끼리만 채팅 가능
   */
  public async joinSpot(request: JoinSpotRequest): Promise<{
    success: boolean;
    room?: ISpotChatRoom;
    recentLogs?: ISpotChatRoom['chatLogs'];
    error?: string;
  }> {
    const { sessionId, spotId, spotName, characterId, characterName } = request;

    try {
      const room = await this.getOrCreateRoom(sessionId, spotId, spotName);

      // 이미 멤버인지 확인
      const existingMember = room.members.find(m => m.characterId === characterId);
      if (existingMember) {
        return {
          success: true,
          room,
          recentLogs: room.chatLogs.slice(-50), // 최근 50개만
        };
      }

      // 멤버 추가
      room.members.push({
        characterId,
        characterName,
        joinedAt: new Date(),
      });
      room.lastActivityAt = new Date();

      // 입장 시스템 메시지 추가
      const logEntry = {
        logId: `LOG-${uuidv4().slice(0, 8)}`,
        senderId: 'SYSTEM',
        senderName: 'System',
        message: `${characterName}님이 입장했습니다.`,
        type: 'system' as const,
        timestamp: new Date(),
      };

      room.chatLogs.push(logEntry);

      // 로그 제한 (최근 100개)
      if (room.chatLogs.length > MAX_CHAT_LOGS) {
        room.chatLogs = room.chatLogs.slice(-MAX_CHAT_LOGS);
      }

      await room.save();

      // 이벤트 발생
      this.emit('spot:joined', {
        sessionId,
        spotId,
        spotName,
        characterId,
        characterName,
        members: room.members,
        systemMessage: logEntry,
      });

      logger.info(`[SpotChatService] ${characterName} joined spot: ${spotName}`);

      return {
        success: true,
        room,
        recentLogs: room.chatLogs.slice(-50),
      };
    } catch (error) {
      logger.error('[SpotChatService] joinSpot error:', error);
      return { success: false, error: '스팟 입장에 실패했습니다.' };
    }
  }

  /**
   * 스팟 퇴장
   */
  public async leaveSpot(request: LeaveSpotRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { sessionId, spotId, characterId, characterName, reason = 'normal' } = request;

    try {
      const room = await SpotChatRoom.findOne({ sessionId, spotId });
      if (!room) {
        return { success: false, error: '채팅방을 찾을 수 없습니다.' };
      }

      // 멤버 제거
      const memberIndex = room.members.findIndex(m => m.characterId === characterId);
      if (memberIndex === -1) {
        return { success: true }; // 이미 없음
      }

      room.members.splice(memberIndex, 1);
      room.lastActivityAt = new Date();

      // 퇴장 메시지 생성
      const messageMap: Record<string, string> = {
        normal: `${characterName}님이 퇴장했습니다.`,
        disconnect: `${characterName}님의 연결이 끊어졌습니다.`,
        move: `${characterName}님이 이동했습니다.`,
        death: `${characterName}님이 전사했습니다.`,
      };

      const logEntry = {
        logId: `LOG-${uuidv4().slice(0, 8)}`,
        senderId: 'SYSTEM',
        senderName: 'System',
        message: messageMap[reason] || messageMap.normal,
        type: 'system' as const,
        timestamp: new Date(),
      };

      room.chatLogs.push(logEntry);

      // 로그 제한
      if (room.chatLogs.length > MAX_CHAT_LOGS) {
        room.chatLogs = room.chatLogs.slice(-MAX_CHAT_LOGS);
      }

      await room.save();

      // 이벤트 발생
      this.emit('spot:left', {
        sessionId,
        spotId,
        characterId,
        characterName,
        reason,
        members: room.members,
        systemMessage: logEntry,
      });

      logger.info(`[SpotChatService] ${characterName} left spot ${spotId}, reason: ${reason}`);

      return { success: true };
    } catch (error) {
      logger.error('[SpotChatService] leaveSpot error:', error);
      return { success: false, error: '스팟 퇴장에 실패했습니다.' };
    }
  }

  // ============================================================
  // 채팅
  // ============================================================

  /**
   * 스팟 채팅 메시지 전송
   */
  public async sendMessage(request: SendSpotChatRequest): Promise<{
    success: boolean;
    logEntry?: ISpotChatRoom['chatLogs'][0];
    error?: string;
  }> {
    const { sessionId, spotId, senderId, senderName, message, type = 'chat' } = request;

    try {
      const room = await SpotChatRoom.findOne({ sessionId, spotId });
      if (!room) {
        return { success: false, error: '채팅방을 찾을 수 없습니다.' };
      }

      // 발신자가 멤버인지 확인
      const isMember = room.members.some(m => m.characterId === senderId);
      if (!isMember) {
        return { success: false, error: '해당 스팟의 멤버가 아닙니다.' };
      }

      // 채팅 로그 추가
      const logEntry = {
        logId: `LOG-${uuidv4().slice(0, 8)}`,
        senderId,
        senderName,
        message,
        type,
        timestamp: new Date(),
      };

      room.chatLogs.push(logEntry);
      room.lastActivityAt = new Date();

      // 로그 제한 (최근 100개)
      if (room.chatLogs.length > MAX_CHAT_LOGS) {
        room.chatLogs = room.chatLogs.slice(-MAX_CHAT_LOGS);
      }

      await room.save();

      // 이벤트 발생 - 같은 스팟의 모든 멤버에게 브로드캐스트
      this.emit('spot:message', {
        sessionId,
        spotId,
        logEntry,
        members: room.members.map(m => m.characterId),
      });

      return { success: true, logEntry };
    } catch (error) {
      logger.error('[SpotChatService] sendMessage error:', error);
      return { success: false, error: '메시지 전송에 실패했습니다.' };
    }
  }

  /**
   * 이모트 메시지 전송
   * 매뉴얼: "/me" 형식의 액션 메시지
   */
  public async sendEmote(
    sessionId: string,
    spotId: string,
    senderId: string,
    senderName: string,
    action: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendMessage({
      sessionId,
      spotId,
      senderId,
      senderName,
      message: `${senderName} ${action}`,
      type: 'emote',
    });
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 스팟 멤버 목록 조회
   */
  public async getSpotMembers(
    sessionId: string,
    spotId: string,
  ): Promise<SpotChatMember[]> {
    const room = await SpotChatRoom.findOne({ sessionId, spotId }).lean();
    return room?.members || [];
  }

  /**
   * 캐릭터가 있는 스팟 찾기
   */
  public async findCharacterSpot(
    sessionId: string,
    characterId: string,
  ): Promise<string | null> {
    const room = await SpotChatRoom.findOne({
      sessionId,
      'members.characterId': characterId,
    }).lean();

    return room?.spotId || null;
  }

  /**
   * 채팅 로그 조회
   */
  public async getChatLogs(
    sessionId: string,
    spotId: string,
    limit: number = 50,
  ): Promise<ISpotChatRoom['chatLogs']> {
    const room = await SpotChatRoom.findOne({ sessionId, spotId }).lean();
    if (!room) return [];

    return room.chatLogs.slice(-limit);
  }

  /**
   * 특정 시간 이후의 채팅 로그
   */
  public async getChatLogsSince(
    sessionId: string,
    spotId: string,
    since: Date,
  ): Promise<ISpotChatRoom['chatLogs']> {
    const room = await SpotChatRoom.findOne({ sessionId, spotId }).lean();
    if (!room) return [];

    return room.chatLogs.filter(log => new Date(log.timestamp) > since);
  }

  // ============================================================
  // 시스템 메시지
  // ============================================================

  /**
   * 스팟에 시스템 메시지 전송
   */
  public async sendSystemMessage(
    sessionId: string,
    spotId: string,
    message: string,
  ): Promise<{ success: boolean }> {
    const room = await SpotChatRoom.findOne({ sessionId, spotId });
    if (!room) {
      return { success: false };
    }

    const logEntry = {
      logId: `LOG-${uuidv4().slice(0, 8)}`,
      senderId: 'SYSTEM',
      senderName: 'System',
      message,
      type: 'system' as const,
      timestamp: new Date(),
    };

    room.chatLogs.push(logEntry);
    room.lastActivityAt = new Date();

    if (room.chatLogs.length > MAX_CHAT_LOGS) {
      room.chatLogs = room.chatLogs.slice(-MAX_CHAT_LOGS);
    }

    await room.save();

    this.emit('spot:systemMessage', {
      sessionId,
      spotId,
      logEntry,
      members: room.members.map(m => m.characterId),
    });

    return { success: true };
  }

  /**
   * 전체 스팟에 공지 전송
   */
  public async broadcastAnnouncement(
    sessionId: string,
    message: string,
  ): Promise<number> {
    const rooms = await SpotChatRoom.find({ sessionId });
    let count = 0;

    for (const room of rooms) {
      if (room.members.length > 0) {
        await this.sendSystemMessage(sessionId, room.spotId, `[공지] ${message}`);
        count++;
      }
    }

    return count;
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 비활성 채팅방 정리
   */
  public async cleanupInactiveRooms(
    sessionId: string,
    inactiveHours: number = 24,
  ): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - inactiveHours);

    const result = await SpotChatRoom.deleteMany({
      sessionId,
      lastActivityAt: { $lt: cutoff },
      'members.0': { $exists: false }, // 멤버 없는 방만
    });

    if (result.deletedCount > 0) {
      logger.info(`[SpotChatService] Cleaned up ${result.deletedCount} inactive rooms`);
    }

    return result.deletedCount;
  }

  /**
   * 세션 정리
   */
  public cleanup(sessionId: string): void {
    logger.info(`[SpotChatService] Cleaned up session: ${sessionId}`);
  }

  /**
   * 캐릭터의 모든 스팟에서 제거 (연결 끊김 시)
   */
  public async removeCharacterFromAllSpots(
    sessionId: string,
    characterId: string,
    characterName: string,
  ): Promise<void> {
    const rooms = await SpotChatRoom.find({
      sessionId,
      'members.characterId': characterId,
    });

    for (const room of rooms) {
      await this.leaveSpot({
        sessionId,
        spotId: room.spotId,
        characterId,
        characterName,
        reason: 'disconnect',
      });
    }
  }
}

export const spotChatService = SpotChatService.getInstance();
export default SpotChatService;





