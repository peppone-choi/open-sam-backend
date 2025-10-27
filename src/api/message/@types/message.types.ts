/**
 * Message 도메인 타입 정의
 */

export interface IMessage {
  id: string;
  sessionId: string;
  mailbox: number;
  type: 'private' | 'national' | 'public' | 'diplomacy';
  src: string; // General ID
  dest: string; // General ID
  time: Date;
  validUntil: Date;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}
