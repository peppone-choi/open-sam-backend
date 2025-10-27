export interface IEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  ts: Date;
  version: number;
}

export interface ICommandPayload {
  type: string;
  generalId: string;
  data: Record<string, any>;
  submittedAt: number;
}
