// 공통 타입 정의

export type CommandType = 
  | 'MOVE'
  | 'PRODUCE'
  | 'RECRUIT'
  | 'TRAIN'
  | 'BUILD'
  | 'RESEARCH'
  | 'DIPLOMACY'
  | 'ESPIONAGE'
  | 'ASSIGN'
  | 'ATTACK';

export type CommandStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

export type BattleStatus = 'ONGOING' | 'ATTACKER_WIN' | 'DEFENDER_WIN';

export interface DomainEvent {
  type: string;
  aggregateId: string;
  timestamp: Date;
  data: any;
}

// TODO: 추가 타입 정의
