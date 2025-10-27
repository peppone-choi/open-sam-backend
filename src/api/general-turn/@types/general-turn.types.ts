/**
 * GeneralTurn 도메인 타입 정의
 */

export interface IGeneralTurn {
  id: string;
  sessionId: string;
  generalId: string;
  turnIdx: number;
  action: string;
  arg?: Record<string, any>;
  brief?: string;
  createdAt: Date;
  updatedAt: Date;
}
