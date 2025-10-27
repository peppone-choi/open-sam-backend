export interface IEvent {
  id: string;
  target: 'MONTH' | 'OCCUPY_CITY' | 'DESTROY_NATION' | 'PRE_MONTH' | 'UNITED';
  priority: number;
  condition: Record<string, any>;
  action: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventDto {
  target: 'MONTH' | 'OCCUPY_CITY' | 'DESTROY_NATION' | 'PRE_MONTH' | 'UNITED';
  priority?: number;
  condition: Record<string, any>;
  action: Record<string, any>;
}

export interface UpdateEventDto {
  target?: 'MONTH' | 'OCCUPY_CITY' | 'DESTROY_NATION' | 'PRE_MONTH' | 'UNITED';
  priority?: number;
  condition?: Record<string, any>;
  action?: Record<string, any>;
}
