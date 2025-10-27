export interface INgBetting {
  id: string;
  sessionId: string;
  bettingId: number;
  generalId: string;
  userId?: string;
  bettingType: any;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}
