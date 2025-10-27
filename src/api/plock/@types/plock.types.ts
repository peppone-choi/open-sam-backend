export interface IPlock {
  id: string;
  sessionId: string;
  type: 'GAME' | 'ETC' | 'TOURNAMENT';
  plock: boolean;
  lockTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
