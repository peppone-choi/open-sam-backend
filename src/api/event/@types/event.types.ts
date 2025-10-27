export interface IEvent {
  id: string;
  sessionId: string;
  target: 'MONTH' | 'OCCUPY_CITY' | 'DESTROY_NATION' | 'PRE_MONTH' | 'UNITED';
  priority: number;
  condition: any;
  action: any;
  createdAt: Date;
  updatedAt: Date;
}
