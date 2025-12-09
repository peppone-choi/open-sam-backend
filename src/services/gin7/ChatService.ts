/**
 * ChatService - 스팟 기반 채팅 시스템
 * 매뉴얼 667-696행 기반 구현
 *
 * 기능:
 * - 같은 스팟 내 채팅
 * - 같은 부대 내 채팅 (다른 그리드도 가능)
 * - 전술전 중 동진영 채팅
 * - 명함 교환
 * - 캐릭터 정보 조회
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../../common/logger';

// ============================================================
// Types & Models
// ============================================================

export type ChatScope = 'spot' | 'unit' | 'faction' | 'fleet' | 'all';

export interface IChatMessage extends Document {
  messageId: string;
  sessionId: string;
  spotId?: string;           // 스팟 채팅
  unitId?: string;           // 부대 채팅
  battleId?: string;         // 전술전 채팅
  factionId?: string;        // 진영 채팅
  scope: ChatScope;
  senderId: string;
  senderName: string;
  senderRank?: string;
  text: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'emote';
}

const ChatMessageSchema = new Schema<IChatMessage>({
  messageId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  spotId: { type: String, index: true },
  unitId: { type: String, index: true },
  battleId: { type: String, index: true },
  factionId: { type: String, index: true },
  scope: { 
    type: String, 
    enum: ['spot', 'unit', 'faction', 'fleet', 'all'],
    required: true 
  },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  senderRank: { type: String },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  type: { type: String, enum: ['chat', 'system', 'emote'], default: 'chat' },
}, {
  timestamps: true,
  collection: 'chat_messages',
});

// 복합 인덱스
ChatMessageSchema.index({ sessionId: 1, spotId: 1, timestamp: -1 });
ChatMessageSchema.index({ sessionId: 1, unitId: 1, timestamp: -1 });
ChatMessageSchema.index({ sessionId: 1, battleId: 1, factionId: 1, timestamp: -1 });

export const ChatMessage: Model<IChatMessage> = mongoose.models.ChatMessage as Model<IChatMessage> || 
  mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

// ============================================================
// Request/Response Types
// ============================================================

export interface SendChatRequest {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRank?: string;
  text: string;
  type?: 'chat' | 'system' | 'emote';
  
  // 스팟 채팅
  spotId?: string;
  
  // 부대 채팅
  unitId?: string;
  
  // 전술전 채팅
  battleId?: string;
  factionId?: string;
  scope?: ChatScope;
}

export interface ExchangeCardRequest {
  sessionId: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
}

export interface CharacterLocation {
  characterId: string;
  characterName: string;
  spotId?: string;
  gridId?: string;
  unitId?: string;
  battleId?: string;
  factionId?: string;
  isInTactical: boolean;
}

// ============================================================
// ChatService Class
// ============================================================

export class ChatService extends EventEmitter {
  private static instance: ChatService;
  
  // 캐릭터 위치 추적 (sessionId -> Map<characterId, CharacterLocation>)
  private characterLocations: Map<string, Map<string, CharacterLocation>> = new Map();
  
  // 스팟별 캐릭터 목록 (sessionId:spotId -> Set<characterId>)
  private spotMembers: Map<string, Set<string>> = new Map();

  private constructor() {
    super();
    logger.info('[ChatService] Initialized');
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // ============================================================
  // 위치 관리
  // ============================================================

  /**
   * 캐릭터 위치 등록/업데이트
   */
  public updateCharacterLocation(sessionId: string, location: CharacterLocation): void {
    if (!this.characterLocations.has(sessionId)) {
      this.characterLocations.set(sessionId, new Map());
    }
    
    const sessionMap = this.characterLocations.get(sessionId)!;
    const oldLocation = sessionMap.get(location.characterId);
    
    // 이전 스팟에서 제거
    if (oldLocation?.spotId) {
      const oldSpotKey = `${sessionId}:${oldLocation.spotId}`;
      this.spotMembers.get(oldSpotKey)?.delete(location.characterId);
    }
    
    // 새 위치 등록
    sessionMap.set(location.characterId, location);
    
    // 새 스팟에 추가
    if (location.spotId) {
      const spotKey = `${sessionId}:${location.spotId}`;
      if (!this.spotMembers.has(spotKey)) {
        this.spotMembers.set(spotKey, new Set());
      }
      this.spotMembers.get(spotKey)!.add(location.characterId);
    }
    
    this.emit('location:updated', { sessionId, location });
  }

  /**
   * 캐릭터 위치 제거 (오프라인)
   */
  public removeCharacterLocation(sessionId: string, characterId: string): void {
    const sessionMap = this.characterLocations.get(sessionId);
    if (!sessionMap) return;
    
    const location = sessionMap.get(characterId);
    if (location?.spotId) {
      const spotKey = `${sessionId}:${location.spotId}`;
      this.spotMembers.get(spotKey)?.delete(characterId);
    }
    
    sessionMap.delete(characterId);
  }

  /**
   * 같은 스팟에 있는 캐릭터 목록
   */
  public getSpotMembers(sessionId: string, spotId: string): string[] {
    const spotKey = `${sessionId}:${spotId}`;
    const members = this.spotMembers.get(spotKey);
    return members ? Array.from(members) : [];
  }

  /**
   * 캐릭터 위치 조회
   */
  public getCharacterLocation(sessionId: string, characterId: string): CharacterLocation | undefined {
    return this.characterLocations.get(sessionId)?.get(characterId);
  }

  // ============================================================
  // 채팅 메시지
  // ============================================================

  /**
   * 스팟 채팅 전송
   * 매뉴얼: "다른 캐릭터와 채팅을 행하기 위해서는 그 캐릭터가 서버에 접속하고 있는 시점에서 동일 스팟에 존재할 필요가 있습니다"
   */
  public async sendSpotChat(request: SendChatRequest): Promise<{ success: boolean; error?: string }> {
    const { sessionId, spotId, senderId, senderName, senderRank, text, type = 'chat' } = request;
    
    if (!spotId) {
      return { success: false, error: '스팟 ID가 필요합니다.' };
    }
    
    // 발신자가 해당 스팟에 있는지 확인
    const senderLocation = this.getCharacterLocation(sessionId, senderId);
    if (!senderLocation || senderLocation.spotId !== spotId) {
      return { success: false, error: '같은 스팟에서만 채팅할 수 있습니다.' };
    }
    
    // 메시지 저장
    const message = await ChatMessage.create({
      messageId: `CHAT-${uuidv4().slice(0, 8)}`,
      sessionId,
      spotId,
      scope: 'spot',
      senderId,
      senderName,
      senderRank,
      text,
      timestamp: new Date(),
      type,
    });
    
    // 같은 스팟의 모든 캐릭터에게 전송
    const recipients = this.getSpotMembers(sessionId, spotId);
    
    this.emit('chat:spot', {
      sessionId,
      spotId,
      message: message.toObject(),
      recipients,
    });
    
    return { success: true };
  }

  /**
   * 부대 채팅 전송
   * 매뉴얼: "같은 부대 멤버라면 스팟이 달라도 같은 그리드에 존재하면 채팅 가능"
   */
  public async sendUnitChat(request: SendChatRequest): Promise<{ success: boolean; error?: string }> {
    const { sessionId, unitId, senderId, senderName, senderRank, text, type = 'chat' } = request;
    
    if (!unitId) {
      return { success: false, error: '부대 ID가 필요합니다.' };
    }
    
    // 메시지 저장
    const message = await ChatMessage.create({
      messageId: `CHAT-${uuidv4().slice(0, 8)}`,
      sessionId,
      unitId,
      scope: 'unit',
      senderId,
      senderName,
      senderRank,
      text,
      timestamp: new Date(),
      type,
    });
    
    this.emit('chat:unit', {
      sessionId,
      unitId,
      message: message.toObject(),
    });
    
    return { success: true };
  }

  /**
   * 전술전 채팅 전송
   * 매뉴얼: "전술 게임 중에 한하여 동일 그리드 내의 모든 자진영 캐릭터에 대해 채팅 가능"
   */
  public async sendTacticalChat(request: SendChatRequest): Promise<{ success: boolean; error?: string }> {
    const { 
      sessionId, battleId, factionId, senderId, senderName, senderRank, text, 
      type = 'chat', scope = 'faction' 
    } = request;
    
    if (!battleId) {
      return { success: false, error: '전투 ID가 필요합니다.' };
    }
    
    // 메시지 저장
    const message = await ChatMessage.create({
      messageId: `CHAT-${uuidv4().slice(0, 8)}`,
      sessionId,
      battleId,
      factionId: scope === 'faction' || scope === 'fleet' ? factionId : undefined,
      scope,
      senderId,
      senderName,
      senderRank,
      text,
      timestamp: new Date(),
      type,
    });
    
    this.emit('chat:tactical', {
      sessionId,
      battleId,
      factionId,
      scope,
      message: message.toObject(),
    });
    
    return { success: true };
  }

  /**
   * 시스템 메시지 전송
   */
  public async sendSystemMessage(
    sessionId: string,
    spotId: string | undefined,
    text: string,
  ): Promise<void> {
    const message = await ChatMessage.create({
      messageId: `SYS-${uuidv4().slice(0, 8)}`,
      sessionId,
      spotId,
      scope: spotId ? 'spot' : 'all',
      senderId: 'SYSTEM',
      senderName: 'System',
      text,
      timestamp: new Date(),
      type: 'system',
    });
    
    if (spotId) {
      const recipients = this.getSpotMembers(sessionId, spotId);
      this.emit('chat:spot', {
        sessionId,
        spotId,
        message: message.toObject(),
        recipients,
      });
    } else {
      this.emit('chat:system', {
        sessionId,
        message: message.toObject(),
      });
    }
  }

  // ============================================================
  // 명함 교환
  // ============================================================

  /**
   * 명함 교환 요청
   * 매뉴얼: "이 커맨드를 실행하면 채팅 중인 상대에게 캐릭터 개인의 메일 주소가 전송됩니다"
   */
  public async requestCardExchange(request: ExchangeCardRequest): Promise<{ success: boolean; error?: string }> {
    const { sessionId, requesterId, requesterName, targetId } = request;
    
    // 같은 스팟에 있는지 확인
    const requesterLocation = this.getCharacterLocation(sessionId, requesterId);
    const targetLocation = this.getCharacterLocation(sessionId, targetId);
    
    if (!requesterLocation?.spotId || !targetLocation?.spotId) {
      return { success: false, error: '스팟에서만 명함 교환이 가능합니다.' };
    }
    
    if (requesterLocation.spotId !== targetLocation.spotId) {
      return { success: false, error: '같은 스팟에 있어야 명함 교환이 가능합니다.' };
    }
    
    // 명함 교환 이벤트 발생 (AddressBookService에서 처리)
    this.emit('card:exchangeRequest', {
      sessionId,
      requesterId,
      requesterName,
      targetId,
      targetName: targetLocation.characterName,
    });
    
    return { success: true };
  }

  /**
   * 명함 교환 수락
   */
  public async acceptCardExchange(
    sessionId: string,
    requesterId: string,
    targetId: string,
    accepted: boolean,
  ): Promise<{ success: boolean }> {
    this.emit('card:exchangeResponse', {
      sessionId,
      requesterId,
      targetId,
      accepted,
    });
    
    return { success: true };
  }

  // ============================================================
  // 채팅 기록 조회
  // ============================================================

  /**
   * 스팟 채팅 기록 조회
   */
  public async getSpotChatHistory(
    sessionId: string,
    spotId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<IChatMessage[]> {
    const query: any = { sessionId, spotId, scope: 'spot' };
    if (before) query.timestamp = { $lt: before };
    
    return ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean() as unknown as IChatMessage[];
  }

  /**
   * 부대 채팅 기록 조회
   */
  public async getUnitChatHistory(
    sessionId: string,
    unitId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<IChatMessage[]> {
    const query: any = { sessionId, unitId, scope: 'unit' };
    if (before) query.timestamp = { $lt: before };
    
    return ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean() as unknown as IChatMessage[];
  }

  /**
   * 전술전 채팅 기록 조회
   */
  public async getTacticalChatHistory(
    sessionId: string,
    battleId: string,
    factionId?: string,
    limit: number = 100,
  ): Promise<IChatMessage[]> {
    const query: any = { sessionId, battleId };
    if (factionId) {
      query.$or = [
        { scope: 'all' },
        { scope: { $in: ['faction', 'fleet'] }, factionId },
      ];
    }
    
    return ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean() as unknown as IChatMessage[];
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    this.characterLocations.delete(sessionId);
    
    // 해당 세션의 스팟 멤버 정리
    for (const key of this.spotMembers.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.spotMembers.delete(key);
      }
    }
    
    logger.info(`[ChatService] Cleaned up session: ${sessionId}`);
  }
}

export const chatService = ChatService.getInstance();
export default ChatService;





