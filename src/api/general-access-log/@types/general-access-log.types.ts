export interface IGeneralAccessLog {
  id: string;
  sessionId: string;
  generalId: string;
  userId?: string;
  lastRefresh?: Date;
  refresh: number;
  refreshTotal: number;
  refreshScore: number;
  refreshScoreTotal: number;
  createdAt: Date;
  updatedAt: Date;
}
