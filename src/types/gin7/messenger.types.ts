/**
 * GIN7 Messenger Protocol Types
 * 1:1 접속형 메신저 프로토콜 타입 정의
 */

/** 메신저 연결 상태 */
export enum MessengerConnectionState {
  /** 오프라인 (접속 안함) */
  OFFLINE = 'OFFLINE',
  /** 대기 중 (접속 중, 통화 대기) */
  IDLE = 'IDLE',
  /** 호출 중 (발신) */
  CALLING = 'CALLING',
  /** 수신 중 (착신) */
  RINGING = 'RINGING',
  /** 통화 연결됨 */
  CONNECTED = 'CONNECTED',
  /** 통화 중 (다른 사람이 볼 때) */
  BUSY = 'BUSY',
}

/** 메신저 소켓 이벤트 */
export enum MessengerEvent {
  /** 호출 (발신자 -> 서버) */
  CALL = 'MESSENGER:CALL',
  /** 수신음 (서버 -> 수신자) */
  RINGING = 'MESSENGER:RINGING',
  /** 수락 (수신자 -> 서버) */
  ACCEPT = 'MESSENGER:ACCEPT',
  /** 거절 (수신자 -> 서버) */
  REJECT = 'MESSENGER:REJECT',
  /** 통화 중 응답 (서버 -> 발신자) */
  BUSY = 'MESSENGER:BUSY',
  /** 절단 (양쪽 -> 서버) */
  HANGUP = 'MESSENGER:HANGUP',
  /** 메시지 전송 (통화 중) */
  MESSAGE = 'MESSENGER:MESSAGE',
  /** 상태 변경 알림 (서버 -> 클라이언트) */
  STATE_CHANGED = 'MESSENGER:STATE_CHANGED',
  /** 에러 알림 */
  ERROR = 'MESSENGER:ERROR',
  /** 호출 취소 (발신자 -> 서버) */
  CANCEL = 'MESSENGER:CANCEL',
  /** 연결 성공 알림 */
  CONNECTED = 'MESSENGER:CONNECTED',
  /** 연결 종료 알림 */
  DISCONNECTED = 'MESSENGER:DISCONNECTED',
  /** 통신 방해 (Jamming) */
  JAMMED = 'MESSENGER:JAMMED',
}

/** 호출 요청 페이로드 */
export interface MessengerCallPayload {
  /** 세션 ID */
  sessionId: string;
  /** 수신자 캐릭터 ID */
  targetId: string;
}

/** 호출 응답 페이로드 */
export interface MessengerRingingPayload {
  /** 세션 ID */
  sessionId: string;
  /** 발신자 캐릭터 ID */
  callerId: string;
  /** 발신자 이름 */
  callerName: string;
  /** 발신자 소속 */
  callerFaction: string;
  /** 발신자 계급 */
  callerRank?: string;
}

/** 수락/거절 응답 페이로드 */
export interface MessengerResponsePayload {
  /** 세션 ID */
  sessionId: string;
  /** 발신자 캐릭터 ID */
  callerId: string;
}

/** 메시지 페이로드 */
export interface MessengerMessagePayload {
  /** 세션 ID */
  sessionId: string;
  /** 상대방 캐릭터 ID */
  targetId: string;
  /** 메시지 내용 */
  text: string;
  /** 메시지 타입 (텍스트, 이모지 등) */
  type?: 'text' | 'emoji' | 'system';
}

/** 절단 페이로드 */
export interface MessengerHangupPayload {
  /** 세션 ID */
  sessionId: string;
  /** 절단 사유 */
  reason?: 'user' | 'timeout' | 'jamming' | 'logout' | 'error';
}

/** 메신저 세션 정보 */
export interface MessengerSession {
  /** 세션 고유 ID (MongoDB _id) */
  _id?: string;
  /** 게임 세션 ID */
  sessionId: string;
  /** 발신자 캐릭터 ID */
  callerId: string;
  /** 수신자 캐릭터 ID */
  receiverId: string;
  /** 시작 시간 */
  startedAt: Date;
  /** 종료 시간 */
  endedAt?: Date;
  /** 연결 성공 시간 (수락 시점) */
  connectedAt?: Date;
  /** 통화 상태 */
  status: 'calling' | 'connected' | 'ended' | 'rejected' | 'missed' | 'jammed';
  /** 종료 사유 */
  endReason?: string;
  /** 메시지 로그 */
  messages: MessengerLogEntry[];
}

/** 메시지 로그 엔트리 */
export interface MessengerLogEntry {
  /** 발신자 ID */
  senderId: string;
  /** 발신자 이름 */
  senderName: string;
  /** 메시지 내용 */
  text: string;
  /** 전송 시간 */
  timestamp: Date;
  /** 메시지 타입 */
  type: 'text' | 'emoji' | 'system';
}

/** 사용자 메신저 상태 (메모리 관리용) */
export interface UserMessengerState {
  /** 캐릭터 ID */
  characterId: string;
  /** 소켓 ID */
  socketId: string;
  /** 현재 상태 */
  state: MessengerConnectionState;
  /** 현재 통화 상대 ID (있는 경우) */
  currentPeerId?: string;
  /** 현재 메신저 세션 ID */
  currentSessionId?: string;
  /** 마지막 상태 변경 시간 */
  lastStateChange: Date;
}

/** 상태 변경 알림 페이로드 */
export interface MessengerStateChangePayload {
  /** 대상 캐릭터 ID */
  characterId: string;
  /** 변경된 상태 */
  state: MessengerConnectionState;
  /** 상대방 ID (있는 경우) */
  peerId?: string;
}

/** 에러 페이로드 */
export interface MessengerErrorPayload {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 */
  message: string;
  /** 추가 데이터 */
  data?: Record<string, unknown>;
}

/** 호출 결과 타입 */
export type CallResult = 
  | { success: true; sessionId: string }
  | { success: false; reason: 'busy' | 'offline' | 'blocked' | 'self' | 'error'; message: string };














