/**
 * MessengerService - 1:1 실시간 대화 시스템
 * 매뉴얼 647-665행 기반 구현
 *
 * 기능:
 * - 통화 시작 (호출)
 * - 통화 응답/거절
 * - 통화 종료
 * - 메시지 전송
 * - 통화 기록 조회
 * - 온라인 캐릭터 목록
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  MessengerSession, 
  IMessengerSession,
  IMessengerSessionModel 
} from '../../models/gin7/MessengerSession.model';
import { Gin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export type MessengerStatus = 'calling' | 'connected' | 'ended' | 'rejected' | 'missed' | 'jammed';

export interface StartCallRequest {
  sessionId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
}

export interface StartCallResult {
  success: boolean;
  messengerSessionId?: string;
  error?: string;
}

export interface AcceptCallResult {
  success: boolean;
  error?: string;
}

export interface SendMessageRequest {
  messengerSessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: 'text' | 'emoji' | 'system';
}

export interface OnlineCharacter {
  characterId: string;
  characterName: string;
  rank: string;
  position?: string;
  isInTactical: boolean;
  lastSeen: Date;
}

// 호출 타임아웃 (30초)
const CALL_TIMEOUT_MS = 30 * 1000;

// ============================================================
// MessengerService Class
// ============================================================

export class MessengerService extends EventEmitter {
  private static instance: MessengerService;
  
  // 온라인 캐릭터 추적 (sessionId -> Map<characterId, OnlineCharacter>)
  private onlineCharacters: Map<string, Map<string, OnlineCharacter>> = new Map();
  
  // 활성 호출 타이머 (messengerSessionId -> timeout)
  private callTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    super();
    logger.info('[MessengerService] Initialized');
  }

  public static getInstance(): MessengerService {
    if (!MessengerService.instance) {
      MessengerService.instance = new MessengerService();
    }
    return MessengerService.instance;
  }

  // ============================================================
  // 온라인 상태 관리
  // ============================================================

  /**
   * 캐릭터 온라인 등록
   */
  public registerOnline(
    sessionId: string,
    character: OnlineCharacter,
  ): void {
    if (!this.onlineCharacters.has(sessionId)) {
      this.onlineCharacters.set(sessionId, new Map());
    }
    
    const sessionMap = this.onlineCharacters.get(sessionId)!;
    sessionMap.set(character.characterId, {
      ...character,
      lastSeen: new Date(),
    });
    
    this.emit('character:online', { sessionId, character });
    logger.debug(`[MessengerService] Character online: ${character.characterName}`);
  }

  /**
   * 캐릭터 오프라인 등록
   */
  public registerOffline(sessionId: string, characterId: string): void {
    const sessionMap = this.onlineCharacters.get(sessionId);
    if (sessionMap) {
      const character = sessionMap.get(characterId);
      sessionMap.delete(characterId);
      
      if (character) {
        this.emit('character:offline', { sessionId, characterId, characterName: character.characterName });
      }
    }
    
    // 활성 통화가 있다면 종료
    this.handleDisconnect(sessionId, characterId);
  }

  /**
   * 온라인 캐릭터 목록 조회
   */
  public getOnlineCharacters(sessionId: string): OnlineCharacter[] {
    const sessionMap = this.onlineCharacters.get(sessionId);
    if (!sessionMap) return [];
    return Array.from(sessionMap.values());
  }

  /**
   * 캐릭터가 온라인인지 확인
   */
  public isOnline(sessionId: string, characterId: string): boolean {
    const sessionMap = this.onlineCharacters.get(sessionId);
    return sessionMap?.has(characterId) ?? false;
  }

  /**
   * 전술전 참가 상태 업데이트
   */
  public updateTacticalStatus(sessionId: string, characterId: string, isInTactical: boolean): void {
    const sessionMap = this.onlineCharacters.get(sessionId);
    const character = sessionMap?.get(characterId);
    if (character) {
      character.isInTactical = isInTactical;
      character.lastSeen = new Date();
    }
  }

  // ============================================================
  // 통화 시작/응답/종료
  // ============================================================

  /**
   * 통화 시작 (호출)
   * 매뉴얼: "오프라인 이름을 좌 더블클릭으로 그 캐릭터에 대한 접속을 시도합니다"
   */
  public async startCall(request: StartCallRequest): Promise<StartCallResult> {
    const { sessionId, callerId, callerName, receiverId, receiverName } = request;

    // 1. 이미 활성 통화가 있는지 확인
    const existingCall = await MessengerSession.findActiveSession(sessionId, callerId);
    if (existingCall) {
      // 기존 호출 취소
      await this.endCall(existingCall._id.toString(), callerId, 'new_call_started');
    }

    // 2. 수신자가 온라인인지 확인
    if (!this.isOnline(sessionId, receiverId)) {
      return { success: false, error: '상대방이 오프라인입니다.' };
    }

    // 3. 수신자가 전술전 중인지 확인
    const receiverStatus = this.onlineCharacters.get(sessionId)?.get(receiverId);
    if (receiverStatus?.isInTactical) {
      return { success: false, error: '상대방이 전술전 중입니다. 메신저를 사용할 수 없습니다.' };
    }

    // 4. 수신자가 이미 통화 중인지 확인
    const receiverActiveCall = await MessengerSession.findActiveSession(sessionId, receiverId);
    if (receiverActiveCall && receiverActiveCall.status === 'connected') {
      return { success: false, error: '상대방이 이미 통화 중입니다.' };
    }

    // 5. 새 메신저 세션 생성
    const messengerSession = await MessengerSession.create({
      sessionId,
      callerId,
      callerName,
      receiverId,
      receiverName,
      status: 'calling',
      startedAt: new Date(),
      messages: [],
    });

    const messengerSessionId = messengerSession._id.toString();

    // 6. 호출 타임아웃 설정 (30초)
    const timeout = setTimeout(async () => {
      await this.handleCallTimeout(messengerSessionId);
    }, CALL_TIMEOUT_MS);
    this.callTimeouts.set(messengerSessionId, timeout);

    // 7. 수신자에게 호출 알림 이벤트
    this.emit('call:incoming', {
      sessionId,
      messengerSessionId,
      callerId,
      callerName,
      receiverId,
      receiverName,
    });

    logger.info(`[MessengerService] Call started: ${callerName} -> ${receiverName}`);

    return { success: true, messengerSessionId };
  }

  /**
   * 통화 응답 (수락)
   */
  public async acceptCall(
    messengerSessionId: string,
    receiverId: string,
  ): Promise<AcceptCallResult> {
    const session = await MessengerSession.findById(messengerSessionId);
    
    if (!session) {
      return { success: false, error: '통화 세션을 찾을 수 없습니다.' };
    }

    if (session.receiverId !== receiverId) {
      return { success: false, error: '수신자만 응답할 수 있습니다.' };
    }

    if (session.status !== 'calling') {
      return { success: false, error: '이미 처리된 호출입니다.' };
    }

    // 타임아웃 취소
    this.clearCallTimeout(messengerSessionId);

    // 연결 상태로 변경
    session.status = 'connected';
    session.connectedAt = new Date();
    await session.save();

    // 시스템 메시지 추가
    await this.addSystemMessage(messengerSessionId, '통화가 연결되었습니다.');

    // 연결 이벤트 발생
    this.emit('call:connected', {
      sessionId: session.sessionId,
      messengerSessionId,
      callerId: session.callerId,
      receiverId: session.receiverId,
    });

    logger.info(`[MessengerService] Call accepted: ${session.callerName} <-> ${session.receiverName}`);

    return { success: true };
  }

  /**
   * 통화 거절
   */
  public async rejectCall(
    messengerSessionId: string,
    receiverId: string,
  ): Promise<AcceptCallResult> {
    const session = await MessengerSession.findById(messengerSessionId);
    
    if (!session) {
      return { success: false, error: '통화 세션을 찾을 수 없습니다.' };
    }

    if (session.receiverId !== receiverId) {
      return { success: false, error: '수신자만 거절할 수 있습니다.' };
    }

    if (session.status !== 'calling') {
      return { success: false, error: '이미 처리된 호출입니다.' };
    }

    // 타임아웃 취소
    this.clearCallTimeout(messengerSessionId);

    // 거절 상태로 변경
    session.status = 'rejected';
    session.endedAt = new Date();
    session.endReason = 'rejected_by_receiver';
    await session.save();

    // 거절 이벤트 발생
    this.emit('call:rejected', {
      sessionId: session.sessionId,
      messengerSessionId,
      callerId: session.callerId,
      receiverId: session.receiverId,
    });

    logger.info(`[MessengerService] Call rejected by ${session.receiverName}`);

    return { success: true };
  }

  /**
   * 통화 종료
   */
  public async endCall(
    messengerSessionId: string,
    endedBy: string,
    reason: string = 'normal_end',
  ): Promise<AcceptCallResult> {
    const session = await MessengerSession.findById(messengerSessionId);
    
    if (!session) {
      return { success: false, error: '통화 세션을 찾을 수 없습니다.' };
    }

    if (session.status === 'ended') {
      return { success: false, error: '이미 종료된 통화입니다.' };
    }

    // 타임아웃 취소
    this.clearCallTimeout(messengerSessionId);

    // 종료 상태로 변경
    session.status = 'ended';
    session.endedAt = new Date();
    session.endReason = reason;
    await session.save();

    // 시스템 메시지 추가
    await this.addSystemMessage(messengerSessionId, '통화가 종료되었습니다.');

    // 종료 이벤트 발생
    this.emit('call:ended', {
      sessionId: session.sessionId,
      messengerSessionId,
      callerId: session.callerId,
      receiverId: session.receiverId,
      endedBy,
      reason,
      duration: session.duration,
    });

    logger.info(`[MessengerService] Call ended: ${session.callerName} <-> ${session.receiverName}, reason: ${reason}`);

    return { success: true };
  }

  // ============================================================
  // 메시지 전송
  // ============================================================

  /**
   * 메시지 전송
   */
  public async sendMessage(request: SendMessageRequest): Promise<{ success: boolean; error?: string }> {
    const { messengerSessionId, senderId, senderName, text, type = 'text' } = request;

    const session = await MessengerSession.findById(messengerSessionId);
    
    if (!session) {
      return { success: false, error: '통화 세션을 찾을 수 없습니다.' };
    }

    if (session.status !== 'connected') {
      return { success: false, error: '연결된 통화에서만 메시지를 보낼 수 있습니다.' };
    }

    // 참여자 확인
    if (session.callerId !== senderId && session.receiverId !== senderId) {
      return { success: false, error: '통화 참여자만 메시지를 보낼 수 있습니다.' };
    }

    // 메시지 추가
    const message = {
      senderId,
      senderName,
      text,
      timestamp: new Date(),
      type,
    };

    session.messages.push(message);
    await session.save();

    // 메시지 이벤트 발생
    this.emit('message:sent', {
      sessionId: session.sessionId,
      messengerSessionId,
      message,
      recipientId: session.callerId === senderId ? session.receiverId : session.callerId,
    });

    return { success: true };
  }

  /**
   * 시스템 메시지 추가
   */
  private async addSystemMessage(messengerSessionId: string, text: string): Promise<void> {
    const session = await MessengerSession.findById(messengerSessionId);
    if (!session) return;

    session.messages.push({
      senderId: 'SYSTEM',
      senderName: 'System',
      text,
      timestamp: new Date(),
      type: 'system',
    });
    await session.save();
  }

  // ============================================================
  // 통화 기록 조회
  // ============================================================

  /**
   * 캐릭터의 통화 기록 조회
   */
  public async getCallHistory(
    sessionId: string,
    characterId: string,
    limit: number = 20,
  ): Promise<IMessengerSession[]> {
    return MessengerSession.findByCharacter(sessionId, characterId, limit);
  }

  /**
   * 두 캐릭터 간의 통화 기록 조회
   */
  public async getConversationHistory(
    sessionId: string,
    characterId1: string,
    characterId2: string,
    limit: number = 50,
  ): Promise<IMessengerSession[]> {
    return MessengerSession.findBetweenCharacters(sessionId, characterId1, characterId2, limit);
  }

  /**
   * 활성 통화 세션 조회
   */
  public async getActiveCall(
    sessionId: string,
    characterId: string,
  ): Promise<IMessengerSession | null> {
    return MessengerSession.findActiveSession(sessionId, characterId);
  }

  // ============================================================
  // 내부 헬퍼
  // ============================================================

  /**
   * 호출 타임아웃 처리
   */
  private async handleCallTimeout(messengerSessionId: string): Promise<void> {
    const session = await MessengerSession.findById(messengerSessionId);
    if (!session || session.status !== 'calling') return;

    session.status = 'missed';
    session.endedAt = new Date();
    session.endReason = 'timeout';
    await session.save();

    this.callTimeouts.delete(messengerSessionId);

    this.emit('call:missed', {
      sessionId: session.sessionId,
      messengerSessionId,
      callerId: session.callerId,
      receiverId: session.receiverId,
    });

    logger.info(`[MessengerService] Call missed (timeout): ${session.callerName} -> ${session.receiverName}`);
  }

  /**
   * 타임아웃 취소
   */
  private clearCallTimeout(messengerSessionId: string): void {
    const timeout = this.callTimeouts.get(messengerSessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.callTimeouts.delete(messengerSessionId);
    }
  }

  /**
   * 연결 끊김 처리 (오프라인 시)
   */
  private async handleDisconnect(sessionId: string, characterId: string): Promise<void> {
    const activeCall = await MessengerSession.findActiveSession(sessionId, characterId);
    if (activeCall) {
      await this.endCall(activeCall._id.toString(), characterId, 'disconnected');
    }
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 세션 정리
   */
  public cleanup(sessionId: string): void {
    this.onlineCharacters.delete(sessionId);
    logger.info(`[MessengerService] Cleaned up session: ${sessionId}`);
  }
}

export const messengerService = MessengerService.getInstance();
export default MessengerService;





