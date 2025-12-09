/**
 * GIN7 Messenger Socket Handler
 * 1:1 접속형 메신저 프로토콜 소켓 핸들러
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../common/logger';
import { MessengerSession, IMessengerSession } from '../models/gin7/MessengerSession.model';
import {
  MessengerConnectionState,
  MessengerEvent,
  MessengerCallPayload,
  MessengerResponsePayload,
  MessengerMessagePayload,
  MessengerHangupPayload,
  UserMessengerState,
  CallResult,
} from '../types/gin7/messenger.types';

/** 호출 타임아웃 (30초) */
const CALL_TIMEOUT_MS = 30000;

/**
 * 메신저 소켓 핸들러
 * 1:1 실시간 메신저 통신을 관리합니다.
 */
export class MessengerSocketHandler {
  private io: SocketIOServer;
  
  /** 사용자 상태 맵 (characterId -> UserMessengerState) */
  private userStates: Map<string, UserMessengerState> = new Map();
  
  /** 소켓ID -> 캐릭터ID 매핑 */
  private socketToCharacter: Map<string, string> = new Map();
  
  /** 진행 중인 호출 타이머 */
  private callTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    logger.info('[Messenger] Socket handler initialized');
  }

  /**
   * 소켓 연결 처리
   */
  handleConnection(socket: Socket): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (socket as any).user as { userId?: string; characterId?: string };
    const sessionId = socket.handshake.query?.sessionId as string;
    
    if (!sessionId) {
      logger.warn('[Messenger] No sessionId provided', { socketId: socket.id });
      return;
    }

    // 메신저 이벤트 핸들러 등록
    socket.on(MessengerEvent.CALL, (data: MessengerCallPayload) => 
      this.handleCall(socket, data));
    
    socket.on(MessengerEvent.ACCEPT, (data: MessengerResponsePayload) => 
      this.handleAccept(socket, data));
    
    socket.on(MessengerEvent.REJECT, (data: MessengerResponsePayload) => 
      this.handleReject(socket, data));
    
    socket.on(MessengerEvent.CANCEL, (data: MessengerCallPayload) => 
      this.handleCancel(socket, data));
    
    socket.on(MessengerEvent.MESSAGE, (data: MessengerMessagePayload) => 
      this.handleMessage(socket, data));
    
    socket.on(MessengerEvent.HANGUP, (data: MessengerHangupPayload) => 
      this.handleHangup(socket, data));

    // 메신저 등록 이벤트 (캐릭터 ID 매핑)
    socket.on('MESSENGER:REGISTER', (data: { characterId: string; characterName?: string }) => 
      this.handleRegister(socket, sessionId, data));

    // 연결 해제 시 정리
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * 메신저 등록 (캐릭터 ID 매핑)
   */
  private handleRegister(
    socket: Socket, 
    sessionId: string, 
    data: { characterId: string; characterName?: string }
  ): void {
    const { characterId } = data;
    
    // 기존 연결 정리
    const existingState = this.userStates.get(characterId);
    if (existingState && existingState.socketId !== socket.id) {
      const oldSocket = this.io.sockets.sockets.get(existingState.socketId);
      if (oldSocket) {
        oldSocket.emit(MessengerEvent.ERROR, {
          code: 'DUPLICATE_SESSION',
          message: '다른 위치에서 메신저에 접속했습니다.',
        });
      }
    }

    // 새 상태 등록
    this.userStates.set(characterId, {
      characterId,
      socketId: socket.id,
      state: MessengerConnectionState.IDLE,
      lastStateChange: new Date(),
    });
    this.socketToCharacter.set(socket.id, characterId);

    // 메신저 전용 룸 조인
    socket.join(`messenger:${sessionId}:${characterId}`);
    
    logger.info('[Messenger] User registered', { 
      socketId: socket.id, 
      characterId, 
      sessionId 
    });

    socket.emit(MessengerEvent.STATE_CHANGED, {
      characterId,
      state: MessengerConnectionState.IDLE,
    });
  }

  /**
   * 호출 처리
   */
  private async handleCall(socket: Socket, data: MessengerCallPayload): Promise<void> {
    const callerId = this.socketToCharacter.get(socket.id);
    const { sessionId, targetId } = data;

    if (!callerId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'NOT_REGISTERED',
        message: '메신저에 등록되지 않았습니다. 먼저 등록해주세요.',
      });
      return;
    }

    // 자기 자신에게 호출 불가
    if (callerId === targetId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'SELF_CALL',
        message: '자기 자신에게는 호출할 수 없습니다.',
      });
      return;
    }

    const callerState = this.userStates.get(callerId);
    const targetState = this.userStates.get(targetId);

    // 발신자 상태 확인
    if (callerState?.state !== MessengerConnectionState.IDLE) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'CALLER_BUSY',
        message: '이미 다른 통화 중입니다.',
      });
      return;
    }

    // 수신자 온라인 확인
    if (!targetState || targetState.state === MessengerConnectionState.OFFLINE) {
      socket.emit(MessengerEvent.BUSY, {
        targetId,
        reason: 'offline',
        message: '상대방이 오프라인입니다.',
      });
      return;
    }

    // 수신자 통화 중 확인
    if (targetState.state !== MessengerConnectionState.IDLE) {
      socket.emit(MessengerEvent.BUSY, {
        targetId,
        reason: 'busy',
        message: '상대방이 통화 중입니다.',
      });
      return;
    }

    try {
      // 메신저 세션 생성
      const messengerSession = await MessengerSession.create({
        sessionId,
        callerId,
        callerName: this.getCharacterName(callerId) || callerId,
        receiverId: targetId,
        receiverName: this.getCharacterName(targetId) || targetId,
        status: 'calling',
        startedAt: new Date(),
        messages: [{
          senderId: 'system',
          senderName: 'System',
          text: '통화 호출이 시작되었습니다.',
          timestamp: new Date(),
          type: 'system',
        }],
      });

      // 발신자 상태 업데이트
      this.updateUserState(callerId, {
        state: MessengerConnectionState.CALLING,
        currentPeerId: targetId,
        currentSessionId: messengerSession._id?.toString(),
      });

      // 수신자 상태 업데이트
      this.updateUserState(targetId, {
        state: MessengerConnectionState.RINGING,
        currentPeerId: callerId,
        currentSessionId: messengerSession._id?.toString(),
      });

      // 수신자에게 착신 알림
      const targetSocket = this.io.sockets.sockets.get(targetState.socketId);
      if (targetSocket) {
        targetSocket.emit(MessengerEvent.RINGING, {
          sessionId,
          callerId,
          callerName: this.getCharacterName(callerId) || callerId,
          callerFaction: '', // TODO: 실제 소속 정보 가져오기
          messengerSessionId: messengerSession._id?.toString(),
        });
      }

      // 발신자에게 호출 성공 알림
      socket.emit(MessengerEvent.STATE_CHANGED, {
        characterId: callerId,
        state: MessengerConnectionState.CALLING,
        peerId: targetId,
      });

      // 호출 타임아웃 설정
      const timerId = setTimeout(() => {
        this.handleCallTimeout(sessionId, callerId, targetId, messengerSession._id?.toString());
      }, CALL_TIMEOUT_MS);
      
      if (messengerSession._id) {
        this.callTimers.set(messengerSession._id.toString(), timerId);
      }

      logger.info('[Messenger] Call initiated', { 
        callerId, 
        targetId, 
        messengerSessionId: messengerSession._id 
      });
    } catch (error: any) {
      logger.error('[Messenger] Call failed', { error: error.message, callerId, targetId });
      socket.emit(MessengerEvent.ERROR, {
        code: 'CALL_FAILED',
        message: '호출에 실패했습니다.',
      });
    }
  }

  /**
   * 호출 수락 처리
   */
  private async handleAccept(socket: Socket, data: MessengerResponsePayload): Promise<void> {
    const receiverId = this.socketToCharacter.get(socket.id);
    const { sessionId, callerId } = data;

    if (!receiverId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'NOT_REGISTERED',
        message: '메신저에 등록되지 않았습니다.',
      });
      return;
    }

    const receiverState = this.userStates.get(receiverId);
    const callerState = this.userStates.get(callerId);

    // 상태 검증
    if (receiverState?.state !== MessengerConnectionState.RINGING ||
        receiverState?.currentPeerId !== callerId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'INVALID_STATE',
        message: '수락할 수 있는 호출이 없습니다.',
      });
      return;
    }

    const messengerSessionId = receiverState.currentSessionId;
    if (!messengerSessionId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'NO_SESSION',
        message: '세션 정보가 없습니다.',
      });
      return;
    }

    // 타임아웃 취소
    this.clearCallTimer(messengerSessionId);

    try {
      // DB 업데이트
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        status: 'connected',
        connectedAt: new Date(),
        $push: {
          messages: {
            senderId: 'system',
            senderName: 'System',
            text: '통화가 연결되었습니다.',
            timestamp: new Date(),
            type: 'system',
          },
        },
      });

      // 양쪽 상태 업데이트
      this.updateUserState(receiverId, {
        state: MessengerConnectionState.CONNECTED,
      });
      this.updateUserState(callerId, {
        state: MessengerConnectionState.CONNECTED,
      });

      // 발신자에게 연결 성공 알림
      if (callerState) {
        const callerSocket = this.io.sockets.sockets.get(callerState.socketId);
        if (callerSocket) {
          callerSocket.emit(MessengerEvent.CONNECTED, {
            sessionId,
            peerId: receiverId,
            peerName: this.getCharacterName(receiverId) || receiverId,
            messengerSessionId,
          });
        }
      }

      // 수신자에게 연결 성공 알림
      socket.emit(MessengerEvent.CONNECTED, {
        sessionId,
        peerId: callerId,
        peerName: this.getCharacterName(callerId) || callerId,
        messengerSessionId,
      });

      logger.info('[Messenger] Call accepted', { 
        callerId, 
        receiverId, 
        messengerSessionId 
      });
    } catch (error: any) {
      logger.error('[Messenger] Accept failed', { error: error.message });
      socket.emit(MessengerEvent.ERROR, {
        code: 'ACCEPT_FAILED',
        message: '연결에 실패했습니다.',
      });
    }
  }

  /**
   * 호출 거절 처리
   */
  private async handleReject(socket: Socket, data: MessengerResponsePayload): Promise<void> {
    const receiverId = this.socketToCharacter.get(socket.id);
    const { callerId } = data;

    if (!receiverId) {
      return;
    }

    const receiverState = this.userStates.get(receiverId);
    const callerState = this.userStates.get(callerId);
    const messengerSessionId = receiverState?.currentSessionId;

    if (messengerSessionId) {
      this.clearCallTimer(messengerSessionId);

      // DB 업데이트
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        status: 'rejected',
        endedAt: new Date(),
        endReason: 'rejected',
        $push: {
          messages: {
            senderId: 'system',
            senderName: 'System',
            text: '상대방이 호출을 거절했습니다.',
            timestamp: new Date(),
            type: 'system',
          },
        },
      });
    }

    // 상태 초기화
    this.resetUserState(receiverId);
    this.resetUserState(callerId);

    // 발신자에게 거절 알림
    if (callerState) {
      const callerSocket = this.io.sockets.sockets.get(callerState.socketId);
      if (callerSocket) {
        callerSocket.emit(MessengerEvent.DISCONNECTED, {
          reason: 'rejected',
          message: '상대방이 호출을 거절했습니다.',
        });
      }
    }

    logger.info('[Messenger] Call rejected', { callerId, receiverId });
  }

  /**
   * 호출 취소 처리 (발신자가 취소)
   */
  private async handleCancel(socket: Socket, data: MessengerCallPayload): Promise<void> {
    const callerId = this.socketToCharacter.get(socket.id);
    const { targetId } = data;

    if (!callerId) {
      return;
    }

    const callerState = this.userStates.get(callerId);
    const targetState = this.userStates.get(targetId);
    const messengerSessionId = callerState?.currentSessionId;

    if (messengerSessionId) {
      this.clearCallTimer(messengerSessionId);

      // DB 업데이트
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        status: 'missed',
        endedAt: new Date(),
        endReason: 'cancelled',
        $push: {
          messages: {
            senderId: 'system',
            senderName: 'System',
            text: '발신자가 호출을 취소했습니다.',
            timestamp: new Date(),
            type: 'system',
          },
        },
      });
    }

    // 상태 초기화
    this.resetUserState(callerId);
    this.resetUserState(targetId);

    // 수신자에게 취소 알림
    if (targetState) {
      const targetSocket = this.io.sockets.sockets.get(targetState.socketId);
      if (targetSocket) {
        targetSocket.emit(MessengerEvent.DISCONNECTED, {
          reason: 'cancelled',
          message: '상대방이 호출을 취소했습니다.',
        });
      }
    }

    logger.info('[Messenger] Call cancelled', { callerId, targetId });
  }

  /**
   * 메시지 전송 처리
   */
  private async handleMessage(socket: Socket, data: MessengerMessagePayload): Promise<void> {
    const senderId = this.socketToCharacter.get(socket.id);
    const { targetId, text, type = 'text' } = data;

    if (!senderId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'NOT_REGISTERED',
        message: '메신저에 등록되지 않았습니다.',
      });
      return;
    }

    const senderState = this.userStates.get(senderId);
    const targetState = this.userStates.get(targetId);

    // 연결 상태 확인
    if (senderState?.state !== MessengerConnectionState.CONNECTED ||
        senderState?.currentPeerId !== targetId) {
      socket.emit(MessengerEvent.ERROR, {
        code: 'NOT_CONNECTED',
        message: '연결된 통화가 없습니다.',
      });
      return;
    }

    const messengerSessionId = senderState.currentSessionId;
    const senderName = this.getCharacterName(senderId) || senderId;
    const timestamp = new Date();

    // DB에 메시지 저장
    if (messengerSessionId) {
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        $push: {
          messages: {
            senderId,
            senderName,
            text,
            timestamp,
            type,
          },
        },
      });
    }

    // 상대방에게 메시지 전달
    if (targetState) {
      const targetSocket = this.io.sockets.sockets.get(targetState.socketId);
      if (targetSocket) {
        targetSocket.emit(MessengerEvent.MESSAGE, {
          senderId,
          senderName,
          text,
          type,
          timestamp,
        });
      }
    }

    // 발신자에게 전송 확인
    socket.emit(MessengerEvent.MESSAGE, {
      senderId,
      senderName,
      text,
      type,
      timestamp,
      isSelf: true,
    });
  }

  /**
   * 절단 처리
   */
  private async handleHangup(socket: Socket, data: MessengerHangupPayload): Promise<void> {
    const characterId = this.socketToCharacter.get(socket.id);
    const { reason = 'user' } = data;

    if (!characterId) {
      return;
    }

    const userState = this.userStates.get(characterId);
    const peerId = userState?.currentPeerId;
    const peerState = peerId ? this.userStates.get(peerId) : null;
    const messengerSessionId = userState?.currentSessionId;

    if (messengerSessionId) {
      // DB 업데이트
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        status: 'ended',
        endedAt: new Date(),
        endReason: reason,
        $push: {
          messages: {
            senderId: 'system',
            senderName: 'System',
            text: reason === 'jamming' 
              ? '통신 방해로 연결이 끊어졌습니다.' 
              : '통화가 종료되었습니다.',
            timestamp: new Date(),
            type: 'system',
          },
        },
      });
    }

    // 상태 초기화
    this.resetUserState(characterId);
    if (peerId) {
      this.resetUserState(peerId);
    }

    // 상대방에게 종료 알림
    if (peerState) {
      const peerSocket = this.io.sockets.sockets.get(peerState.socketId);
      if (peerSocket) {
        peerSocket.emit(MessengerEvent.DISCONNECTED, {
          reason,
          message: reason === 'jamming' 
            ? '통신 방해로 연결이 끊어졌습니다.'
            : '상대방이 통화를 종료했습니다.',
        });
      }
    }

    logger.info('[Messenger] Call ended', { characterId, peerId, reason });
  }

  /**
   * 호출 타임아웃 처리
   */
  private async handleCallTimeout(
    sessionId: string,
    callerId: string,
    targetId: string,
    messengerSessionId?: string
  ): Promise<void> {
    if (messengerSessionId) {
      this.callTimers.delete(messengerSessionId);

      // DB 업데이트
      await MessengerSession.findByIdAndUpdate(messengerSessionId, {
        status: 'missed',
        endedAt: new Date(),
        endReason: 'timeout',
        $push: {
          messages: {
            senderId: 'system',
            senderName: 'System',
            text: '응답이 없어 호출이 종료되었습니다.',
            timestamp: new Date(),
            type: 'system',
          },
        },
      });
    }

    const callerState = this.userStates.get(callerId);
    const targetState = this.userStates.get(targetId);

    // 상태 초기화
    this.resetUserState(callerId);
    this.resetUserState(targetId);

    // 발신자에게 타임아웃 알림
    if (callerState) {
      const callerSocket = this.io.sockets.sockets.get(callerState.socketId);
      if (callerSocket) {
        callerSocket.emit(MessengerEvent.DISCONNECTED, {
          reason: 'timeout',
          message: '상대방이 응답하지 않습니다.',
        });
      }
    }

    // 수신자에게 부재중 알림
    if (targetState) {
      const targetSocket = this.io.sockets.sockets.get(targetState.socketId);
      if (targetSocket) {
        targetSocket.emit(MessengerEvent.DISCONNECTED, {
          reason: 'timeout',
          message: '부재중 호출이 있었습니다.',
        });
      }
    }

    logger.info('[Messenger] Call timeout', { callerId, targetId });
  }

  /**
   * 연결 해제 처리
   */
  private async handleDisconnect(socket: Socket): Promise<void> {
    const characterId = this.socketToCharacter.get(socket.id);
    
    if (!characterId) {
      return;
    }

    const userState = this.userStates.get(characterId);
    
    // 진행 중인 통화가 있으면 종료
    if (userState?.state === MessengerConnectionState.CONNECTED ||
        userState?.state === MessengerConnectionState.CALLING ||
        userState?.state === MessengerConnectionState.RINGING) {
      await this.handleHangup(socket, {
        sessionId: '',
        reason: 'logout',
      });
    }

    // 매핑 제거
    this.socketToCharacter.delete(socket.id);
    this.userStates.delete(characterId);

    logger.info('[Messenger] User disconnected', { socketId: socket.id, characterId });
  }

  /**
   * 외부에서 통신 방해 (Jamming) 호출
   */
  async jamConnection(characterId: string): Promise<void> {
    const userState = this.userStates.get(characterId);
    
    if (!userState || userState.state !== MessengerConnectionState.CONNECTED) {
      return;
    }

    const socket = this.io.sockets.sockets.get(userState.socketId);
    if (socket) {
      socket.emit(MessengerEvent.JAMMED, {
        message: '통신이 방해받고 있습니다.',
      });

      await this.handleHangup(socket, {
        sessionId: '',
        reason: 'jamming',
      });
    }
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(characterId: string): UserMessengerState | undefined {
    return this.userStates.get(characterId);
  }

  /**
   * 사용자 상태 업데이트
   */
  private updateUserState(characterId: string, updates: Partial<UserMessengerState>): void {
    const current = this.userStates.get(characterId);
    if (current) {
      this.userStates.set(characterId, {
        ...current,
        ...updates,
        lastStateChange: new Date(),
      });

      // 상태 변경 알림
      const socket = this.io.sockets.sockets.get(current.socketId);
      if (socket && updates.state) {
        socket.emit(MessengerEvent.STATE_CHANGED, {
          characterId,
          state: updates.state,
          peerId: updates.currentPeerId || current.currentPeerId,
        });
      }
    }
  }

  /**
   * 사용자 상태 초기화
   */
  private resetUserState(characterId: string): void {
    const current = this.userStates.get(characterId);
    if (current) {
      this.userStates.set(characterId, {
        ...current,
        state: MessengerConnectionState.IDLE,
        currentPeerId: undefined,
        currentSessionId: undefined,
        lastStateChange: new Date(),
      });

      // 상태 변경 알림
      const socket = this.io.sockets.sockets.get(current.socketId);
      if (socket) {
        socket.emit(MessengerEvent.STATE_CHANGED, {
          characterId,
          state: MessengerConnectionState.IDLE,
        });
      }
    }
  }

  /**
   * 호출 타이머 취소
   */
  private clearCallTimer(sessionId: string): void {
    const timer = this.callTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.callTimers.delete(sessionId);
    }
  }

  /**
   * 캐릭터 이름 조회 (TODO: 실제 DB에서 조회)
   */
  private getCharacterName(characterId: string): string | null {
    // TODO: Commander 모델에서 실제 이름 조회
    return null;
  }

  /**
   * 온라인 사용자 목록 조회
   */
  getOnlineUsers(): string[] {
    const online: string[] = [];
    this.userStates.forEach((state, characterId) => {
      if (state.state !== MessengerConnectionState.OFFLINE) {
        online.push(characterId);
      }
    });
    return online;
  }

  /**
   * 특정 사용자의 통화 가능 여부 확인
   */
  isAvailable(characterId: string): boolean {
    const state = this.userStates.get(characterId);
    return state?.state === MessengerConnectionState.IDLE;
  }
}







