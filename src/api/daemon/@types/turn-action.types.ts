/**
 * 턴 액션 타입 (턴 당기기, 미루기 등의 영속화)
 */

export enum TurnActionType {
  ADVANCE = 'ADVANCE', // 턴 진행
  ACCELERATE = 'ACCELERATE', // 턴 당기기
  DELAY = 'DELAY', // 턴 미루기
  SET_TURN = 'SET_TURN', // 턴 번호 설정
}

export interface ITurnAction {
  id: string;
  sessionId: string;
  type: TurnActionType;
  
  // 액션 파라미터
  previousTurn?: number; // 이전 턴 번호
  newTurn?: number; // 새로운 턴 번호
  turnCount?: number; // 당기기/미루기 턴 수
  
  // 메타데이터
  executedBy?: string; // 실행한 사용자/관리자
  reason?: string; // 사유
  affectedCommands?: number; // 영향받은 커맨드 수
  
  createdAt: Date;
}

export interface CreateTurnActionDto {
  sessionId: string;
  type: TurnActionType;
  previousTurn?: number;
  newTurn?: number;
  turnCount?: number;
  executedBy?: string;
  reason?: string;
  affectedCommands?: number;
}
