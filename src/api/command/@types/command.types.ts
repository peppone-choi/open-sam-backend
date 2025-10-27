/**
 * Command 도메인 타입 정의 (CQRS 패턴)
 */

export enum CommandType {
  MOVE = 'MOVE',
  PRODUCE = 'PRODUCE',
  RECRUIT = 'RECRUIT',
  TRAIN_GENERAL = 'TRAIN_GENERAL',
  EQUIP_ITEM = 'EQUIP_ITEM',
  BUILD = 'BUILD',
  RESEARCH = 'RESEARCH',
  DIPLOMACY = 'DIPLOMACY',
  ESPIONAGE = 'ESPIONAGE',
  ATTACK = 'ATTACK',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ICommand {
  id: string;
  
  // 게임 세션 (중요!)
  sessionId: string; // GameSession ID - 데이터 격리
  
  generalId: string;
  type: CommandType;
  status: CommandStatus;
  
  // 커맨드 페이로드 (타입별로 다름)
  payload: Record<string, any>;
  
  // CP 비용
  cpCost: number;
  cpType: 'PCP' | 'MCP';
  
  // 실행 시간
  startTime?: Date;
  completionTime?: Date;
  executionDuration?: number; // milliseconds
  
  // 결과
  result?: any;
  error?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// TODO: 커맨드 타입별 페이로드 정의
export interface MoveCommandPayload {
  fromCityId: string;
  toCityId: string;
  troops: number;
}

export interface ProduceCommandPayload {
  cityId: string;
  productType: 'WEAPON' | 'FOOD' | 'HORSE';
  amount: number;
}

export interface TrainGeneralCommandPayload {
  statType: 'leadership' | 'strength' | 'intel' | 'politics';
  amount: number;
}

// TODO: DTO 타입 정의
export interface SubmitCommandDto {
  generalId: string;
  type: CommandType;
  payload: Record<string, any>;
}
