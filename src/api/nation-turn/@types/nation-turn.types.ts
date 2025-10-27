export interface INationTurn {
  id: string;
  sessionId: string;
  nationId: string;
  officerLevel: number;
  turnIdx: number;
  action: string;
  arg?: Record<string, any>;
  brief?: string;
  createdAt: Date;
  updatedAt: Date;
}
